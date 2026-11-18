// In-page download buttons for YouTube and X, and their popup switches.
const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setImmediate(r));
function setup(url,html,stored={}){
 const dom=new JSDOM(html,{url,runScripts:'outside-only'}),w=dom.window;
 let onChange,sent=[];const frames=[];
 w.chrome={storage:{onChanged:{addListener:f=>onChange=f},local:{get:async d=>({...d,...stored})}},runtime:{sendMessage:async m=>{sent.push(m);return {ok:true};}}};
 w.requestAnimationFrame=f=>frames.push(f);w.setInterval=()=>0;w.setTimeout=()=>0;
 w.document.elementFromPoint=()=>null;
 const size=el=>{el.getBoundingClientRect=()=>({width:640,height:360,top:60,left:20,right:660,bottom:420});el.getClientRects=()=>[{}];};
 w.matchMedia=()=>({matches:false});w.eval(fs.readFileSync('extension/brand-icon.js','utf8'));w.eval(fs.readFileSync('extension/theme.js','utf8'));w.eval(fs.readFileSync('extension/video-download.js','utf8'));
 const flush=async()=>{await tick();while(frames.length)frames.shift()();};
 const host=()=>w.document.querySelector('[data-superchrome="video-download"]');
 const buttons=()=>host()?[...host().shadowRoot.querySelectorAll('button')]:[];
 return {w,sent,size,flush,host,buttons,change:(c)=>onChange(c,'local')};
}
(async()=>{
 // YouTube watch page: one button, canonical URL (playlist/time params dropped), helper-needed message surfaced.
 let t=setup('https://www.youtube.com/watch?v=abc123&list=PL1&t=30','<div id="movie_player"><video></video></div>');
 t.size(t.w.document.querySelector('video'));await t.flush();
 assert.equal(t.buttons().length,1);const b=t.buttons()[0];assert.equal(b.title,'Download video · SuperChrome');
 b.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(t.sent.at(-1))),{action:'download',url:'https://www.youtube.com/watch?v=abc123'});
 assert.equal(b.disabled,true);
 t.change({job:{newValue:{url:'https://www.youtube.com/watch?v=abc123',message:'[download]  42.5% of 2MiB'}}});assert.equal(b.title,'Downloading 42.5%');
 t.change({job:{newValue:{url:'https://www.youtube.com/watch?v=other',ok:true}}});assert.equal(b.disabled,true,'other videos do not affect this one');
 t.change({job:{newValue:{url:'https://www.youtube.com/watch?v=abc123',ok:false,needsHelper:true,message:'YouTube downloads need the local helper.'}}});assert.match(b.title,/local helper/);assert.doesNotMatch(b.title,/retry/);assert.equal(b.disabled,false);
 t.change({job:{newValue:{url:'https://www.youtube.com/watch?v=abc123',ok:true}}});assert.equal(b.textContent,'✓');assert.equal(b.title,'Saved to Downloads');
 // Switching it off removes the button; on brings it back.
 t.change({youtubeDownloadButton:{newValue:false}});await t.flush();assert.equal(t.buttons().length,0);
 t.change({youtubeDownloadButton:{newValue:true}});await t.flush();assert.equal(t.buttons().length,1);
 t.w.close();
 // Disabled from storage at load; non-video YouTube pages get nothing.
 t=setup('https://www.youtube.com/watch?v=abc','<video></video>',{youtubeDownloadButton:false});t.size(t.w.document.querySelector('video'));await t.flush();assert.equal(t.buttons().length,0);t.w.close();
 t=setup('https://www.youtube.com/results?search_query=x','<video></video>');t.size(t.w.document.querySelector('video'));await t.flush();assert.equal(t.buttons().length,0);t.w.close();
 t=setup('https://www.youtube.com/shorts/xyz','<div id="movie_player"><video></video></div>');t.size(t.w.document.querySelector('video'));await t.flush();t.buttons()[0].click();await tick();assert.equal(t.sent.at(-1).url,'https://www.youtube.com/shorts/xyz');t.w.close();
 // X: each timeline video gets its own button, using that post's link; posts without video get none.
 const post=(id,video=true)=>`<article><a href="/u/status/${id}"><time>1h</time></a>${video?'<video></video>':'<img>'}</article>`;
 t=setup('https://x.com/home',post('111')+post('222')+post('333',false));
 for(const v of t.w.document.querySelectorAll('video'))t.size(v);await t.flush();
 assert.equal(t.buttons().length,2);t.buttons()[1].click();await tick();assert.equal(t.sent.at(-1).url,'https://x.com/u/status/222');
 t.change({xDownloadButton:{newValue:false}});await t.flush();assert.equal(t.buttons().length,0);t.w.close();
 // The button never covers another layer (a dialog) sitting over the video.
 t=setup('https://x.com/u/status/9',post('9'));const v=t.w.document.querySelector('video');t.size(v);t.w.document.elementFromPoint=()=>t.w.document.body;await t.flush();assert.equal(t.buttons().length,0);t.w.close();

 // Inline mode: YouTube puts the button in the action row, X in the post's action bar; the fallback overlay is not used.
 t=setup('https://www.youtube.com/watch?v=abc','<div id="movie_player"><video></video></div><ytd-watch-metadata><div id="top-level-buttons-computed"><i></i></div></ytd-watch-metadata>');
 {const bar=t.w.document.querySelector('#top-level-buttons-computed');Object.defineProperty(bar,'offsetParent',{get:()=>t.w.document.body});t.size(t.w.document.querySelector('video'));await t.flush();
  const inline=bar.querySelector('[data-superchrome="video-download-inline"]');assert.ok(inline,'host inside the action row');assert.equal(inline.parentElement,bar);
  const ib=inline.shadowRoot.querySelector('button');assert.ok(ib);assert.equal(t.buttons().length,0,'no floating copy');
  assert.match(inline.shadowRoot.querySelector('style').textContent,/data-superchrome-theme="dark"/,'owns light and dark colors');
  assert.ok(ib.querySelector('img.badge')?.src.startsWith('data:image/png'),'wears the SuperChrome badge');
  ib.click();await tick();assert.equal(t.sent.at(-1).url,'https://www.youtube.com/watch?v=abc');
  t.change({youtubeDownloadButton:{newValue:false}});await t.flush();assert.equal(bar.querySelector('[data-superchrome="video-download-inline"]'),null,'switch removes the inline button');}
 t.w.close();
 t=setup('https://x.com/home','<article><a href="/u/status/5"><time>1h</time></a><video></video><div role="group"><div data-testid="like"></div></div></article>');
 t.size(t.w.document.querySelector('video'));await t.flush();
 {const group=t.w.document.querySelector('[role=group]'),inline=group.querySelector('[data-superchrome="video-download-inline"]');assert.ok(inline);inline.shadowRoot.querySelector('button').click();await tick();assert.equal(t.sent.at(-1).url,'https://x.com/u/status/5');}
 t.w.close();

 // Instagram: the video's button joins the row of interaction icons, right after Share.
 {const ig=new JSDOM('<main><article><video id="v"></video><section><div><div role="button"><svg aria-label="Like"></svg></div></div><div><div role="button"><svg aria-label="Comment"></svg></div></div><div id="share"><div role="button"><svg aria-label="Share"></svg></div></div><div id="save"><div role="button"><svg aria-label="Save"></svg></div></div></section></article></main>',{url:'https://www.instagram.com/p/t/',runScripts:'outside-only'}).window;const frames=[];
  ig.chrome={storage:{onChanged:{addListener(){}},local:{get:async d=>d}},runtime:{}};ig.requestAnimationFrame=f=>frames.push(f);
  const v=ig.document.querySelector('#v');v.getBoundingClientRect=()=>({width:500,height:500,top:20,left:20,right:520,bottom:520});v.getClientRects=()=>[{}];ig.document.elementFromPoint=()=>null;
  ig.eval(fs.readFileSync('extension/instagram-images.js','utf8'));await tick();while(frames.length)frames.shift()();
  const inline=ig.document.querySelector('[data-superchrome="instagram-download-inline"]');assert.ok(inline,'inline host');assert.equal(inline.previousElementSibling.id,'share');assert.equal(inline.nextElementSibling.id,'save');
  assert.ok(inline.shadowRoot.querySelector('button'));assert.equal(ig.document.querySelector('[data-superchrome="instagram-images"]').shadowRoot.querySelectorAll('button').length,0);
  ig.close();}
 // Instagram photos get the same inline button after the Share count.
 {const ig=new JSDOM('<main><article><div id="m"><img id="p" src="https://cdn.example/p.jpg"></div><section><div><div role="button"><svg aria-label="Like"></svg></div><span>5</span><div id="share" role="button"><svg aria-label="Share"></svg></div><span id="count">2</span></div></section></article></main>',{url:'https://www.instagram.com/',runScripts:'outside-only'}).window;const frames=[];
  ig.chrome={storage:{onChanged:{addListener(){}},local:{get:async d=>d}},runtime:{}};ig.requestAnimationFrame=f=>frames.push(f);
  const img=ig.document.querySelector('#p');img.getBoundingClientRect=()=>({width:500,height:500,top:20,left:20,right:520,bottom:520});img.getClientRects=()=>[{}];ig.document.elementFromPoint=()=>img;
  ig.eval(fs.readFileSync('extension/brand-icon.js','utf8'));ig.eval(fs.readFileSync('extension/instagram-images.js','utf8'));await tick();while(frames.length)frames.shift()();
  const inline=ig.document.querySelector('[data-superchrome="instagram-download-inline"]');assert.ok(inline,'photo button inline');assert.equal(inline.previousElementSibling.id,'count');
  assert.ok(inline.shadowRoot.querySelector('img.badge'));ig.close();}
 // Popup switches: default on, saved on change, rolled back on failure, synced across changes.
 const popup=new JSDOM(fs.readFileSync('extension/popup.html','utf8'),{runScripts:'outside-only'}).window;let store={},listeners=[],fail=false;
 popup.chrome={storage:{local:{get:async d=>({...d,...store}),set:async o=>{if(fail)throw Error('x');Object.assign(store,o);}},onChanged:{addListener:f=>listeners.push(f)}}};
 popup.eval(fs.readFileSync('extension/video-download-popup.js','utf8'));await tick();
 const el=id=>popup.document.getElementById(id);
 for(const id of ['instagram','youtube','x'])assert.equal(el(id+'-download-button').checked,true,id+' defaults on');
 el('youtube-download-button').click();await tick();assert.equal(store.youtubeDownloadButton,false);assert.equal(store.xDownloadButton,undefined,'sites are independent');
 fail=true;el('x-download-button').click();await tick();assert.equal(el('x-download-button').checked,true);assert.match(el('x-download-status').textContent,/Could not save/);
 listeners.forEach(f=>f({instagramDownloadButton:{newValue:false}},'local'));assert.equal(el('instagram-download-button').checked,false);
 // Instagram's content script honours its switch.
 const ig=new JSDOM('<main><article><img id="p" src="https://cdn.example/p.jpg"></article></main>',{url:'https://www.instagram.com/p/t/',runScripts:'outside-only'}).window;const frames=[];let igChange;
 ig.chrome={storage:{onChanged:{addListener:f=>igChange=f},local:{get:async()=>({instagramDownloadButton:false})}},runtime:{}};ig.requestAnimationFrame=f=>frames.push(f);
 const img=ig.document.querySelector('img');img.getBoundingClientRect=()=>({width:500,height:500,top:20,left:20,right:520,bottom:520});img.getClientRects=()=>[{}];ig.document.elementFromPoint=()=>img;
 ig.eval(fs.readFileSync('extension/instagram-images.js','utf8'));await tick();while(frames.length)frames.shift()();
 const igHost=()=>ig.document.querySelector('[data-superchrome="instagram-images"]').shadowRoot;assert.equal(igHost().querySelectorAll('button').length,0,'off in storage means no button');
 igChange({instagramDownloadButton:{newValue:true}},'local');while(frames.length)frames.shift()();assert.equal(igHost().querySelectorAll('button').length,1);

 console.log('PASS: YouTube and X in-page download buttons (URL, progress, helper message, per-post, overlap, on/off) and inline placement, SuperChrome badge, and popup switches for Instagram, YouTube and X.');
})().catch(e=>{console.error(e);process.exit(1)});
