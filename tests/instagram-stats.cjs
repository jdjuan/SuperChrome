const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync('extension/'+f,'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const intervals=[];
 function load(url,{enabled=true,response}={}){
  const dom=new JSDOM('<html><body style="background:rgb(0,0,0)"></body></html>',{url,runScripts:'outside-only'}),w=dom.window;
  w.matchMedia=()=>({matches:false});w.setInterval=fn=>intervals.push(fn);
  let listener;const calls=[];
  w.chrome={storage:{local:{get:async()=>({instagramStats:enabled})},onChanged:{addListener:fn=>listener=fn}}};
  w.fetch=async(path,init)=>{calls.push({path,init});return response||{ok:true,status:200,json:async()=>({items:[{taken_at:1793914984,play_count:230604,like_count:21906,comment_count:1542,reshare_count:438,video_duration:36.2,media_type:2}]})};};
  w.eval(read('theme.js'));w.eval(read('instagram-stats.js'));
  return {w,calls,change:v=>listener({instagramStats:{newValue:v}},'local'),host:()=>w.document.querySelector('[data-superchrome="instagram-stats"]')};
 }
 // Shortcodes decode to Instagram media IDs.
 let t=load('https://www.instagram.com/reels/DfYBSnvsqJb/');
 assert.equal(t.w.SuperChromeInstagramStats.mediaId('DfYBSnvsqJb'),'4023971944728797787');
 for(const [u,c] of [['/p/abc_-1/','abc_-1'],['/someone/reel/XYZ/','XYZ'],['/reels/','null'],['/explore/','null']])assert.equal(String(t.w.SuperChromeInstagramStats.shortcodeOf('https://www.instagram.com'+u)),c);
 await tick();await tick();
 const bar=t.host().shadowRoot.querySelector('.bar');
 assert.equal(bar.hidden,false);
 assert.equal(t.calls[0].path,'/api/v1/media/4023971944728797787/info/');assert.equal(t.calls[0].init.credentials,'include');
 const plays=t.host().shadowRoot.querySelector('.plays');assert.match(plays.title,/230/);assert.equal(plays.hidden,false);
 assert.match(t.host().shadowRoot.querySelector('.likes').title,/21/);
 // The overlay owns colors from the page's actual background.
 assert.equal(t.host().dataset.superchromeTheme,'dark');
 // Popup text formatting.
 assert.match(t.w.SuperChromeInstagramStats.text(await t.w.SuperChromeInstagramStats.fetchStats('DfYBSnvsqJb')),/Plays: 230.604|Plays: 230,604/);
 assert.equal(t.calls.length,1,'stats are cached per post');
 // Dismiss hides for that post only; turning off hides everywhere.
 t.host().shadowRoot.querySelector('.close').click();assert.equal(bar.hidden,true);
 t.change(true);await tick();await tick();assert.equal(bar.hidden,false);
 t.change(false);await tick();assert.equal(bar.hidden,true);
 // Non-post pages show nothing and do not call Instagram.
 t=load('https://www.instagram.com/');await tick();await tick();assert.equal(t.calls.length,0);assert.ok(!t.host()||t.host().shadowRoot.querySelector('.bar').hidden);
 // Disabled by setting.
 t=load('https://www.instagram.com/p/abc/',{enabled:false});await tick();await tick();assert.equal(t.calls.length,0);
 // Signed-out errors are explained.
 t=load('https://www.instagram.com/p/abc/',{response:{ok:false,status:401,json:async()=>({})}});await tick();await tick();await tick();
 assert.match(t.host().shadowRoot.querySelector('.when').textContent,/Sign in/);
 // Profile grid tiles get chips; feed articles, tiny links and non-grid pages do not.
 {
  const dom=new JSDOM('<html><body><main><a id="t1" href="/jdjuan0/reel/DfYBSnvsqJb/"><img></a><a id="t2" href="/p/abc/"><div style="background-image:url(x)"></div></a><a id="small" href="/p/zzz/"><img></a><article><a id="feed" href="/p/feed/"><img></a></article></main></body></html>',{url:'https://www.instagram.com/jdjuan0/reels/',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  w.matchMedia=()=>({matches:false});w.chrome={storage:{local:{get:async d=>d},onChanged:{addListener(){}}}};
  w.HTMLElement.prototype.getBoundingClientRect=function(){const big=this.id!=='small';return {width:big?300:40,height:big?400:40,top:0,left:0,right:0,bottom:0};};
  const paths=[];w.fetch=async p=>{paths.push(p);return {ok:true,status:200,json:async()=>({items:[{taken_at:1793914984,play_count:5000,like_count:24,comment_count:4,media_type:2}]})};};
  w.eval(read('theme.js'));w.eval(read('instagram-stats.js'));
  await new Promise(r=>setTimeout(r,900));
  const chipOf=id=>w.document.querySelector('#'+id+' > [data-superchrome="instagram-grid-stats"]');
  assert.ok(chipOf('t1'),'reel tile chip');assert.ok(chipOf('t2'),'background-image tile chip');
  assert.ok(!chipOf('small')&&!chipOf('feed'),'no chips on small links or feed posts');
  assert.ok(paths.every(p=>!/zzz|feed/.test(p)));
  const chip=chipOf('t1').shadowRoot;assert.match(chip.querySelector('.counts').textContent,/5K.*24.*4/);assert.match(chip.querySelector('.date').textContent,/Nov|11/);
  assert.match(chip.querySelector('style').textContent,/rgb\(0 0 0 \/ \.74\)/);
  assert.equal(w.document.querySelectorAll('[data-superchrome="instagram-grid-stats"]').length,2);
 }
 console.log('PASS: Instagram stats badge, profile grid chips, decoding, fetch, theme, dismiss, toggle and errors.');process.exit(0);
})().catch(e=>{console.error(e);process.exit(1);});
