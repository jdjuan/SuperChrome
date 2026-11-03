const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const html=fs.readFileSync('extension/popup.html','utf8'),source=fs.readFileSync('extension/updates.js','utf8');
const release=v=>({tag_name:'v'+v,assets:[{name:'SuperChrome.zip',browser_download_url:`https://github.com/jdjuan/SuperChrome/releases/download/v${v}/SuperChrome.zip`}]});
const tick=async()=>{for(let i=0;i<5;i++)await new Promise(r=>setImmediate(r));};
async function setup(r,cache){const d=new JSDOM(html,{runScripts:'outside-only'}),w=d.window;let calls=0,copied='',saved;w.AbortSignal={timeout:()=>undefined};w.fetch=async()=>{calls++;return{ok:true,json:async()=>r}};w.navigator.clipboard={writeText:async s=>copied=s};w.chrome={runtime:{id:'stable-id',getManifest:()=>({version:'3.3.0'})},storage:{local:{get:async()=>({superChromeUpdateCache:cache}),set:async s=>saved=s}}};w.eval(source);await tick();return {w,get calls(){return calls},get copied(){return copied},get saved(){return saved},close:()=>w.close()};}
(async()=>{
 let t=await setup(release('3.10.0'));assert.equal(t.w.document.getElementById('copy-update-prompt').hidden,false);t.w.document.getElementById('copy-update-prompt').click();await tick();assert.match(t.copied,/3.10.0/);assert.match(t.copied,/IN PLACE/);assert.match(t.copied,/stable-id/);assert.match(t.copied,/SHA-256/);t.close();
 for(const v of ['3.3.0','3.2.0','2.99.0']){t=await setup(release(v));assert.equal(t.w.document.getElementById('copy-update-prompt').hidden,true);t.close();}
 t=await setup(release('3.4.0'),{checkedAt:Date.now(),release:release('3.4.0')});assert.equal(t.calls,0);t.w.document.getElementById('check-updates').click();await tick();assert.equal(t.calls,1);t.close();
 for(const r of [{...release('3.4.0'),prerelease:true},{...release('3.4.0'),assets:[{name:'SuperChrome.zip',browser_download_url:'https://evil.test/file.zip'}]},release('not-a-version')]){t=await setup(r);assert.equal(t.w.document.getElementById('copy-update-prompt').hidden,true);assert.match(t.w.document.getElementById('update-status').textContent,/Couldn’t check/);t.close();}
 console.log('PASS: numeric version comparison, trusted release assets, daily cache, retry, no downgrade, update prompt preserves settings and ID.');
})().catch(e=>{console.error(e);process.exit(1)});
