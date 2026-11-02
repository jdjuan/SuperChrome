const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
function lum(hex){const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function ratio(a,b){const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
(async()=>{
 for(const darkOS of [false,true])for(const darkSite of [false,true]){
 const d=new JSDOM(`<html><body style="background:${darkSite?'rgb(12,16,22)':'rgb(244,242,238)'}"><main><section id="host"></section></main></body></html>`,{runScripts:'outside-only'}),w=d.window;w.matchMedia=()=>({matches:darkOS});w.eval(read('theme.js'));const host=w.document.querySelector('#host'),shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<div class="canvas"><h1>Heading</h1><p>Supporting copy</p><button>1 min</button></div>';w.SuperChromeTheme.attach(host,shadow);
 assert.equal(host.dataset.superchromeTheme,darkSite?'dark':'light',`site ${darkSite}, system ${darkOS}`);
 const value=key=>host.style.getPropertyValue('--sc-'+key);for(const [a,b]of [['text','surface'],['muted','surface'],['text','button'],['accent','surface']])assert.ok(ratio(value(a),value(b))>=4.5,`${a}/${b} contrast`);
 assert.match(shadow.querySelector('style').textContent,/background:var\(--sc-surface/);
 // Runtime site theme changes must update without an extension reload.
 w.document.body.style.background=darkSite?'white':'rgb(12,16,22)';w.SuperChromeTheme.apply(host);assert.equal(host.dataset.superchromeTheme,darkSite?'light':'dark');
 }
 // Backgrounds on the content column override the body, including translucent layers.
 const nested=new JSDOM('<html><body style="background:black"><main style="background:rgba(255,255,255,.95)"><section></section></main></body></html>',{runScripts:'outside-only'});nested.window.matchMedia=()=>({matches:true});nested.window.eval(read('theme.js'));const host=nested.window.document.querySelector('section');nested.window.SuperChromeTheme.apply(host);assert.equal(host.dataset.superchromeTheme,'light');
 // Exercise real focus components with theme mismatches and runtime changes.
 for(const [file,url,main]of [['instagram','https://www.instagram.com/','<main><article>Post</article></main>'],['x','https://x.com/home','<main><div data-testid="primaryColumn"><section role="region">Feed</section></div></main>'],['linkedin','https://www.linkedin.com/feed/','<main><div class="scaffold-finite-scroll">Feed</div></main>']]){
 const d=new JSDOM(`<html><body style="background:white">${main}</body></html>`,{url,runScripts:'outside-only'}),w=d.window;let interval;w.matchMedia=()=>({matches:true});w.setInterval=f=>interval=f;w.chrome={storage:{local:{get:async defaults=>defaults},onChanged:{addListener:()=>{}}}};w.eval(read('theme.js'));w.eval(read(file+'-focus.js'));await tick();const message=w.document.querySelector(`[data-superchrome="${file}-message"]`);assert.equal(message.dataset.superchromeTheme,'light');w.document.body.style.background='rgb(12,16,22)';interval();assert.equal(message.dataset.superchromeTheme,'dark');assert.ok(ratio(message.style.getPropertyValue('--sc-text'),message.style.getPropertyValue('--sc-surface'))>=4.5);
 }
 console.log('PASS: light/dark site and OS combinations, 4.5:1 text/button contrast, alpha background composition, runtime theme changes, real focus components.');
})().catch(e=>{console.error(e);process.exit(1)});
