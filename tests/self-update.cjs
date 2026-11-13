// Background self-reload: reloads only when the manifest on disk stays at a different version.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('extension/self-update-background.js','utf8');
async function run(diskVersions){
 let reloads=0,i=0;const listeners={};const on=n=>({addListener:f=>listeners[n]=f});
 const ctx={setTimeout:(f)=>f(),Date,fetch:async()=>({json:async()=>{const v=diskVersions[Math.min(i++,diskVersions.length-1)];if(v===null)throw Error('partial');return{version:v};}}),
  chrome:{runtime:{getManifest:()=>({version:'3.14.0'}),getURL:p=>p,reload:()=>reloads++},windows:{WINDOW_ID_NONE:-1,onFocusChanged:on('focus')},tabs:{onActivated:on('tab')},webNavigation:{onCommitted:on('nav')}}};
 ctx.globalThis=ctx;vm.runInNewContext(src,ctx);for(let k=0;k<10;k++)await new Promise(r=>setImmediate(r));
 return {reloads,listeners};
}
(async()=>{
 assert.equal((await run(['3.14.0'])).reloads,0);
 assert.equal((await run(['3.15.0','3.15.0'])).reloads,1);
 assert.equal((await run(['3.15.0','3.15.1'])).reloads,0);
 assert.equal((await run([null])).reloads,0);
 const r=await run(['3.14.0']);assert.ok(r.listeners.focus&&r.listeners.tab&&r.listeners.nav);
 console.log('PASS: self-reload only when new files are fully on disk; idle when versions match or manifest is mid-copy; wakes on focus, tab switch and navigation.');
})().catch(e=>{console.error(e);process.exit(1)});
