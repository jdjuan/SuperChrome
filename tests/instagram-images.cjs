const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const dom=new JSDOM('<main><article><div class="_aagu"><div><img id="photo" src="https://cdn.example/photo.jpg"></div><div id="interaction-layer"></div></div><img id="avatar"></article></main>',{url:'https://www.instagram.com/p/test/',runScripts:'outside-only'}),w=dom.window;
 const frames=[];w.requestAnimationFrame=fn=>frames.push(fn);
 const img=w.document.querySelector('#photo');img.getBoundingClientRect=()=>({width:500,height:500,top:20,left:20,right:520,bottom:520});img.getClientRects=()=>[{}];
 let fetched,download;w.fetch=async url=>{fetched=url;return {ok:true,blob:async()=>({type:'image/jpeg'})}};
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};w.setTimeout=()=>{};
 w.HTMLAnchorElement.prototype.click=function(){download=this.download;};
 w.document.elementFromPoint=()=>w.document.querySelector('#interaction-layer');
 w.eval(fs.readFileSync('extension/instagram-images.js','utf8'));frames.shift()();
 const host=w.document.querySelector('[data-superchrome="instagram-images"]');let button=host.shadowRoot.querySelector('button');assert.ok(button);assert.equal(host.shadowRoot.querySelectorAll('button').length,1);
 button.click();await new Promise(setImmediate);assert.equal(fetched,img.src);assert.match(download,/^instagram-\d+\.jpg$/);assert.equal(button.textContent,'✓');assert.equal(button.disabled,false);
 w.fetch=async()=>{throw Error('blocked')};button.click();await new Promise(setImmediate);assert.match(button.title,/retry/);assert.equal(button.disabled,false);
 img.remove();await new Promise(setImmediate);while(frames.length)frames.shift()();assert.equal(host.shadowRoot.querySelector('button'),null);
 dom.window.close();console.log('PASS: Instagram image button targeting, direct image save, retry, and dynamic cleanup.');
})().catch(e=>{console.error(e);process.exit(1)});
