const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setTimeout(r,35));
const source=fs.readFileSync('extension/instagram-audio.js','utf8');
async function setup(enabled=true,url='https://www.instagram.com/p/test/') {
 const dom=new JSDOM('<video src="https://example.test/first.mp4"></video>',{url,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
 let change;
 w.chrome={storage:{local:{get:async()=>({instagramAutoUnmute:enabled})},onChanged:{addListener:fn=>change=fn}}};
 function prepare(v){Object.defineProperty(v,'paused',{value:false,configurable:true});v.getBoundingClientRect=()=>({width:400,height:600,top:0,bottom:600,left:0,right:400});v.muted=true;return v;}
 const v=prepare(w.document.querySelector('video'));w.eval(source);await tick();
 return {w,v,prepare,change:(value)=>change({instagramAutoUnmute:{newValue:value}},'local')};
}
(async()=>{
 let p=await setup();assert.equal(p.v.muted,false,'existing playing video unmutes');
 p.v.muted=true;p.v.dispatchEvent(new p.w.Event('playing'));await tick();assert.equal(p.v.muted,true,'manual mute persists');
 p.v.src='https://example.test/second.mp4';p.v.volume=0;await tick();assert.equal(p.v.muted,false);assert.equal(p.v.volume,1,'zero volume restored for a new video');
 const v=p.prepare(p.w.document.createElement('video'));p.w.document.body.append(v);await tick();assert.equal(v.muted,false,'SPA inserted video');
 p=await setup(false);const control=p.w.document.createElement('button');control.innerHTML='<svg aria-label="Audio is muted"></svg>';let clicks=0;control.onclick=()=>{clicks++;p.v.muted=false;};p.v.parentElement.append(control);p.change(true);assert.equal(clicks,1,'uses Instagram audio control');assert.equal(p.v.muted,false);
 p=await setup(false);assert.equal(p.v.muted,true);p.change(true);assert.equal(p.v.muted,false);p.change(false);p.v.src='https://example.test/third.mp4';p.v.muted=true;p.v.dispatchEvent(new p.w.Event('playing'));await tick();assert.equal(p.v.muted,true);
 p=await setup(false);const hidden=p.prepare(p.w.document.createElement('video'));hidden.getBoundingClientRect=()=>({width:400,height:600,top:2000,bottom:2600,left:0,right:400});p.w.document.body.append(hidden);p.change(true);assert.equal(hidden.muted,true,'offscreen player stays silent');
 const paused=p.prepare(p.w.document.createElement('video'));Object.defineProperty(paused,'paused',{value:true,configurable:true});p.w.document.body.append(paused);await tick();assert.equal(paused.muted,true);Object.defineProperty(paused,'paused',{value:false});paused.dispatchEvent(new p.w.Event('playing'));await tick();assert.equal(paused.muted,false);
 p=await setup(false);const activation={hasBeenActive:false};Object.defineProperty(p.w.navigator,'userActivation',{value:activation});p.change(true);assert.equal(p.v.muted,true,'no audible autoplay before first gesture');activation.hasBeenActive=true;p.w.document.body.click();await tick();assert.equal(p.v.muted,false,'first gesture enables audio');p.change(false);p.v.muted=true;p.change(true);assert.equal(p.v.muted,false,'re-enabling applies to current player');
 p=await setup(true,'https://example.com/');assert.equal(p.v.muted,true,'other hosts untouched');
 const d=new JSDOM(fs.readFileSync('extension/popup.html','utf8'),{runScripts:'outside-only'});let saved;
 d.window.chrome={storage:{local:{get:async defaults=>defaults,set:async data=>saved=data},onChanged:{addListener:()=>{}}}};d.window.eval(fs.readFileSync('extension/instagram-audio-popup.js','utf8'));await tick();const toggle=d.window.document.querySelector('#instagram-audio-enabled');assert.equal(toggle.checked,true);toggle.checked=false;toggle.dispatchEvent(new d.window.Event('change'));await tick();assert.deepEqual(saved.instagramAutoUnmute,false);
 console.log('PASS: Instagram auto-unmute, manual mute, new sources/players, visibility, paused players, live settings and popup persistence.');
})().catch(e=>{console.error(e);process.exit(1)});
