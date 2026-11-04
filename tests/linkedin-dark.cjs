const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
const fixture=`<!doctype html><html><head><style>body{background-color:rgb(244,242,238);color:rgb(0,0,0)}.card{background-color:rgb(255,255,255);color:rgb(0,0,0)}</style></head><body><nav class="card"><a href="/feed/">Home</a></nav><main><article class="card"><p>Post</p><img src="photo.png" style="background-color:white"><div id="banner" style="background-image:url(banner.png)"></div><svg><path id="icon" style="fill:rgb(0,0,0)"></path><path id="logo" style="fill:rgb(10,102,194)"></path></svg></article><div contenteditable="true" role="textbox"><p style="color:black">Unsent text</p><svg><path fill="black"></path></svg></div><section data-superchrome="linkedin-message"></section></main><div id="interop-outlet" class="theme--light"></div></body></html>`;
function setup({enabled=true,url='https://www.linkedin.com/feed/',deferred=false,darkOS=true,html=fixture}={}){
 const d=new JSDOM(html,{url,runScripts:'outside-only'}),w=d.window;let listener,resolve;
 const messaging=w.document.querySelector('#interop-outlet');
 if(messaging)messaging.attachShadow({mode:'open'}).innerHTML='<section style="background-color:white;color:black"><button>Messaging</button><div contenteditable="true"><p>Unsent message</p></div></section>';
 const media={matches:darkOS,addEventListener:(type,fn)=>media.listener=fn};w.matchMedia=()=>media;w.eval(read('theme.js'));
 w.chrome={storage:{local:{get:()=>deferred?new Promise(r=>resolve=r):Promise.resolve({linkedinDarkMode:enabled})},onChanged:{addListener:f=>listener=f}}};
 const style=w.document.createElement('style');style.textContent=read('linkedin-dark.css');w.document.head.append(style);w.eval(read('linkedin-dark.js'));
 return {w,d,system:dark=>{media.matches=dark;media.listener?.({matches:dark});},change:(value,area='local')=>listener?.({linkedinDarkMode:{newValue:value}},area),resolve:value=>resolve(value)};
}
(async()=>{
 const system=setup({darkOS:false});await tick();
 assert.ok(!system.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'),'Light system starts without forced dark colors');
 system.system(true);assert.ok(system.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'),'Switches dark without reload');
 system.system(false);assert.ok(!system.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'),'Switches light without reload');
 assert.ok(!system.w.document.querySelector("#interop-outlet").hasAttribute("data-sc-linkedin-dark"));
 system.system(true);system.change(false);system.system(false);system.system(true);
 assert.ok(!system.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'),'Opt-out survives system changes');system.d.window.close();

 for(const darkOS of [true]){
 const x=setup({darkOS}),{w}=x;const editor=w.document.querySelector('[contenteditable]'),draft=editor.outerHTML,photo=w.document.querySelector('img').outerHTML,banner=w.document.querySelector('#banner').style.backgroundImage;
 await tick();const root=w.document.documentElement,card=w.document.querySelector('article'),overlay=w.document.querySelector('[data-superchrome]');
 assert.ok(root.hasAttribute('data-sc-linkedin-dark'));assert.equal(card.getAttribute('data-sc-linkedin-bg'),'surface');assert.equal(w.getComputedStyle(card).backgroundColor,'rgb(32, 33, 36)');assert.equal(overlay.dataset.superchromeTheme,'dark','Focus overlay follows actual dark site independently of OS');
 const messaging=w.document.querySelector('#interop-outlet'),messageRoot=messaging.shadowRoot,messageEditor=messageRoot.querySelector('[contenteditable]'),messageDraft=messageEditor.outerHTML;
 assert.ok(messaging.hasAttribute('data-sc-linkedin-dark'));assert.equal(messaging.className,'theme--light','Native theme preference is unchanged');
 assert.equal(messageRoot.querySelector('section').getAttribute('data-sc-linkedin-bg'),'surface');assert.ok(messageRoot.querySelector('[data-sc-linkedin-style]').textContent.length<5000,'Messaging gets only our small scoped stylesheet');
 const chat=w.document.createElement('div');chat.style.backgroundColor='white';messageRoot.append(chat);await new Promise(r=>setTimeout(r,15));assert.equal(chat.getAttribute('data-sc-linkedin-bg'),'surface','Dynamic messages styled in a scheduled batch');assert.equal(messageEditor.outerHTML,messageDraft,'Embedded message editor remains intact');
 assert.equal(editor.outerHTML,draft,'No editor markup changes');assert.equal(w.document.querySelector('img').outerHTML,photo,'Photos stay untouched');assert.equal(w.document.querySelector('#banner').style.backgroundImage,banner,'Profile banners stay intact');
 assert.equal(w.document.querySelector('#icon').getAttribute('data-sc-linkedin-fill'),'icon');assert.ok(!w.document.querySelector('#logo').hasAttribute('data-sc-linkedin-fill'),'Brand colors are preserved');
 messageRoot.querySelector('[data-sc-linkedin-style]').remove();await new Promise(r=>setTimeout(r,15));assert.ok(messageRoot.querySelector('[data-sc-linkedin-style]'),'Messaging stylesheet recovers when LinkedIn rebuilds its shadow contents');
 const panel=w.document.createElement('section');panel.className='card';panel.innerHTML='<h2>New notification or dialog</h2>';w.document.querySelector('main').append(panel);await new Promise(r=>setTimeout(r,15));assert.equal(panel.getAttribute('data-sc-linkedin-bg'),'surface','Dynamic panels are dark after the scheduled batch');assert.equal(w.getComputedStyle(panel).backgroundColor,'rgb(32, 33, 36)');
 card.style.backgroundColor='rgb(200,220,255)';await new Promise(r=>setTimeout(r,15));assert.equal(card.getAttribute('data-sc-linkedin-bg'),'accent','Runtime theme/state changes are reclassified');
 w.history.pushState({},'','/notifications/');const notification=w.document.createElement('div');notification.className='card';w.document.body.append(notification);await new Promise(r=>setTimeout(r,15));assert.equal(notification.getAttribute('data-sc-linkedin-bg'),'surface','Works across SPA routes');
 x.change(false,'sync');assert.ok(root.hasAttribute('data-sc-linkedin-dark'));x.change(false);assert.ok(!root.hasAttribute('data-sc-linkedin-dark'));assert.ok(!messaging.hasAttribute('data-sc-linkedin-dark'),'Messaging restores its native theme');assert.equal(w.getComputedStyle(panel).backgroundColor,'rgb(255, 255, 255)');assert.equal(overlay.dataset.superchromeTheme,'light','Overlay follows the restored underlying theme');
 notification.style.backgroundColor='rgb(20,20,20)';x.change(true);assert.ok(root.hasAttribute('data-sc-linkedin-dark'));assert.equal(notification.getAttribute('data-sc-linkedin-bg'),'base','Enabling re-reads changes made while off');assert.equal(editor.outerHTML,draft);
 w.eval(read('linkedin-dark.js'));await tick();assert.equal(w.document.querySelectorAll('[data-sc-linkedin-dark]').length,2);x.d.window.close();
 }
 for(const url of ['https://linkedin.com/in/example/','https://www.linkedin.com/preload/','https://www.linkedin.com/jobs/','https://www.linkedin.com/messaging/']){const x=setup({url});await tick();assert.ok(x.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'));x.d.window.close();}
 for(const url of ['https://example.test/','https://www.linkedin.com.evil.test/']){const x=setup({url});await tick();assert.ok(!x.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'));x.d.window.close();}
 const native=setup({html:fixture.replace('244,242,238','18,18,18')});await tick();native.change(false);assert.equal(native.w.getComputedStyle(native.w.document.body).backgroundColor,'rgb(18, 18, 18)','An existing native dark theme is restored');assert.equal(native.w.document.querySelector('[data-superchrome]').dataset.superchromeTheme,'dark');native.d.window.close();
 const off=setup({enabled:false});await tick();assert.ok(!off.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'));off.d.window.close();
 const race=setup({deferred:true});race.change(false);race.resolve({linkedinDarkMode:true});await tick();assert.ok(!race.w.document.documentElement.hasAttribute('data-sc-linkedin-dark'));race.d.window.close();
 // A large mutation yields between bounded batches, with reads before writes.
 const load=setup();await tick();const lw=load.w,queue=[];lw.setTimeout=fn=>queue.push(fn);
 lw.SuperChromeTheme.apply=()=>{};
 let reads=0,wrote=false,interleaved=false;const computed=lw.getComputedStyle.bind(lw);
 lw.getComputedStyle=element=>{if(!element.closest('[data-superchrome]')){reads++;if(wrote)interleaved=true;}return computed(element);};
 const set=lw.Element.prototype.setAttribute;
 lw.Element.prototype.setAttribute=function(name,value){if(/^data-sc-linkedin-(bg|fg|fill|stroke)$/.test(name))wrote=true;return set.call(this,name,value);};
 const big=lw.document.createElement('div');big.innerHTML='<div class="card">Panel</div>'.repeat(650);lw.document.body.append(big);
 await Promise.resolve();assert.equal(reads,0,'Mutation delivery does not synchronously scan styles');assert.equal(queue.length,1,'Mutations coalesce');
 queue.shift()();assert.ok(reads<=200,'Style reads are capped per task');assert.equal(interleaved,false,'Reads precede attribute writes');assert.ok(queue.length,'Large changes yield for browser input');
 while(queue.length){wrote=false;queue.shift()();}assert.equal(big.lastElementChild.getAttribute('data-sc-linkedin-bg'),'surface');load.d.window.close();
 // All visible palette text/surface combinations meet the project contrast rule.
 const css=read('linkedin-dark.css'),foregrounds=[...css.matchAll(/fg="(?:text|muted|link)"\] \{ color:(#[a-f0-9]{6})/g)].map(m=>m[1]),backgrounds=[...css.matchAll(/bg="\w+"\] \{ background-color:(#[a-f0-9]{6})/g)].map(m=>m[1]);assert.equal(foregrounds.length,3);assert.equal(backgrounds.length,4);
 const lum=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
 for(const fg of foregrounds)for(const bg of backgrounds)assert.ok((lum(fg)+.05)/(lum(bg)+.05)>=4.5,`${fg} on ${bg}`);
 const popup=new JSDOM(read('popup.html'),{runScripts:'outside-only'}),p=popup.window;let saved,fail=false,listener;
 p.chrome={storage:{local:{get:async()=>({linkedinDarkMode:false,gmailDarkMode:true}),set:async value=>{if(fail)throw Error('Failed');saved=value;}},onChanged:{addListener:f=>listener=f}}};p.eval(read('linkedin-dark-popup.js'));await tick();const toggle=p.document.querySelector('#linkedin-dark-mode');assert.equal(toggle.checked,false);assert.equal(toggle.disabled,false);toggle.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(saved)),{linkedinDarkMode:true},'Preference is independent from Gmail and LinkedIn focus');fail=true;toggle.click();await tick();assert.equal(toggle.checked,true);assert.match(p.document.querySelector('#linkedin-dark-status').textContent,/Could not save/);listener({linkedinDarkMode:{newValue:false}},'local');assert.equal(toggle.checked,false);popup.window.close();
 const manifest=JSON.parse(read('manifest.json')),entry=manifest.content_scripts.find(s=>s.js.includes('linkedin-dark.js'));assert.ok(entry.all_frames);assert.equal(entry.run_at,'document_start');assert.ok(entry.css.includes('linkedin-dark.css'));assert.deepEqual(entry.matches,['https://www.linkedin.com/*','https://linkedin.com/*']);
 console.log('PASS: LinkedIn dark mode, bounded read/write batches, dynamic panels, routes/frames, restored site theme, independent toggle/rollback, media/editor integrity, focus theme integration, contrast and isolation.');
})().catch(e=>{console.error(e);process.exit(1)});
