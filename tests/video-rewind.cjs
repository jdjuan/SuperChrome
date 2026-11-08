const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('extension/video-rewind.js','utf8');
function setup(url='https://www.youtube.com/watch?v=test') {
 const dom=new JSDOM('<video></video><input><div role="textbox" tabindex="0"></div>',{url,runScripts:'outside-only'}),w=dom.window,v=w.document.querySelector('video');
 Object.defineProperty(v,'readyState',{value:1});v.getBoundingClientRect=()=>({width:640,height:360});v.currentTime=30;
 w.eval(source);let native=0;w.document.addEventListener('keydown',()=>native++);
 return {w,v,native:()=>native,key:(target=v,opts={})=>{const e=new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true,cancelable:true,composed:true,...opts});target.dispatchEvent(e);return e}};
}
let p=setup();assert.equal(p.key().defaultPrevented,true);assert.equal(p.v.currentTime,25);assert.equal(p.native(),0,'site shortcut must not also rewind');
p.key(p.v,{repeat:true});assert.equal(p.v.currentTime,20);
p.v.currentTime=2;p.key();assert.equal(p.v.currentTime,0);
for(const opts of [{ctrlKey:true},{altKey:true},{metaKey:true},{shiftKey:true},{isComposing:true},{key:'ArrowRight'}]){p=setup();p.key(p.v,opts);assert.equal(p.v.currentTime,30);assert.equal(p.native(),1)}
for(const selector of ['input','[role="textbox"]']){p=setup();p.key(p.w.document.querySelector(selector));assert.equal(p.v.currentTime,30)}
for(const url of ['https://www.youtube.com/','https://www.netflix.com/browse']){p=setup(url);p.key();assert.equal(p.v.currentTime,30)}
p=setup();p.v.getBoundingClientRect=()=>({width:0,height:0});assert.equal(p.key().defaultPrevented,false);
p=setup('https://www.netflix.com/watch/123');let sought;const player={getCurrentTime:()=>30000,seek:t=>sought=t};p.w.netflix={appContext:{state:{playerApp:{getAPI:()=>({videoPlayer:{getAllPlayerSessionIds:()=>['preview','watch-123'],getVideoPlayerBySessionId:()=>player}})}}}};
p.key();assert.equal(sought,25000);assert.equal(p.v.currentTime,30,'Netflix uses managed timeline');assert.equal(p.native(),0);
player.getCurrentTime=()=>2000;p.key();assert.equal(sought,0);
player.seek=()=>{throw Error('API changed')};p.key();assert.equal(p.v.currentTime,25,'standard media fallback');
p=setup('https://www.netflix.com/watch/123');p.key();assert.equal(p.v.currentTime,25);
p=setup();Object.defineProperty(p.v,'currentTime',{get:()=>30,set:()=>{throw Error('unseekable')}});assert.equal(p.key().defaultPrevented,false);assert.equal(p.native(),1);
const manifest=JSON.parse(fs.readFileSync('extension/manifest.json'));assert.ok(manifest.content_scripts.some(c=>c.js.includes('video-rewind.js')&&c.world==='MAIN'&&c.run_at==='document_start'));
console.log('PASS: five-second rewind, native interception, modifiers, editing, routes, hidden video, Netflix managed seek/fallback, failures.');
for(const url of ['https://www.youtube.com/embed/test','https://www.youtube-nocookie.com/embed/test']) {
 p=setup(url);p.key();assert.equal(p.v.currentTime,25,'embedded YouTube player');
 p.w.document.dispatchEvent(new p.w.CustomEvent('__superchrome_rewind_state',{detail:false}));p.key();assert.equal(p.v.currentTime,25,'disabled immediately');
 p.w.document.dispatchEvent(new p.w.CustomEvent('__superchrome_rewind_state',{detail:true}));p.key();assert.equal(p.v.currentTime,20,'enabled immediately');
}
(async()=>{
 const tick=()=>new Promise(r=>setImmediate(r));
 const dom=new JSDOM(fs.readFileSync('extension/popup.html','utf8'),{runScripts:'outside-only'}),w=dom.window;
 let change,saved,fail=false;
 w.chrome={storage:{local:{get:async()=>({videoRewindEnabled:false}),set:async data=>{if(fail)throw Error();saved=data}},onChanged:{addListener:fn=>change=fn}}};
 w.eval(fs.readFileSync('extension/video-rewind-popup.js','utf8'));await tick();
 const toggle=w.document.querySelector('#video-rewind-enabled');assert.equal(toggle.checked,false);assert.equal(toggle.disabled,false);
 toggle.click();await tick();assert.equal(saved.videoRewindEnabled,true);
 fail=true;toggle.click();await tick();assert.equal(toggle.checked,true);assert.match(w.document.querySelector('#video-rewind-status').textContent,/Could not save/);
 change({videoRewindEnabled:{newValue:false}},'local');assert.equal(toggle.checked,false);
 const player=setup();let onChange,resolve;player.w.chrome={storage:{local:{get:()=>new Promise(r=>resolve=r)},onChanged:{addListener:fn=>onChange=fn}}};
 player.w.eval(fs.readFileSync('extension/video-rewind-settings.js','utf8'));
 onChange({videoRewindEnabled:{newValue:false}},'local');resolve({videoRewindEnabled:true});await tick();player.key();assert.equal(player.v.currentTime,30,'late read must not overwrite newer disabled state');
 onChange({videoRewindEnabled:{newValue:true}},'local');player.key();assert.equal(player.v.currentTime,25);
 assert.equal(manifest.content_scripts.find(c=>c.js.includes('video-rewind.js')).all_frames,true);
 console.log('PASS: embedded players, popup preference, save rollback, live settings bridge and startup race.');
})().catch(e=>{console.error(e);process.exit(1)});
