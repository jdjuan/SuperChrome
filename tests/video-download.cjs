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
 w.eval(fs.readFileSync('extension/video-download.js','utf8'));
 const flush=async()=>{await tick();while(frames.length)frames.shift()();};
 const host=()=>w.document.querySelector('[data-superchrome="video-download"]');
 const buttons=()=>host()?[...host().shadowRoot.querySelectorAll('button')]:[];
 return {w,sent,size,flush,host,buttons,change:(c)=>onChange(c,'local')};
}
(async()=>{
 // YouTube watch page: one button, canonical URL (playlist/time params dropped), helper-needed message surfaced.
 let t=setup('https://www.youtube.com/watch?v=abc123&list=PL1&t=30','<div id="movie_player"><video></video></div>');
 t.size(t.w.document.querySelector('video'));await t.flush();
 assert.equal(t.buttons().length,1);const b=t.buttons()[0];assert.equal(b.title,'Download video');
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
 console.log('PASS: YouTube and X in-page download buttons (URL, progress, helper message, per-post, overlap, on/off) and popup switches for Instagram, YouTube and X.');
})().catch(e=>{console.error(e);process.exit(1)});
