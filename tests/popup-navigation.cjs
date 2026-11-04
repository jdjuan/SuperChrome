const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8');
function page(url){const d=new JSDOM(read('popup.html'),{runScripts:'outside-only'}),w=d.window;w.chrome={tabs:{query:(q,cb)=>cb([{url}])}};w.eval(read('policy.js'));w.eval(read('tabs.js'));return w;}
function active(w,id){assert.equal(w.document.querySelector('[role=tab][aria-selected=true]').id,id);assert.equal(w.document.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);assert.equal(w.document.querySelectorAll('[role=tab][tabindex="0"]').length,1);}
let w=page('https://www.linkedin.com/feed/');active(w,'hide-tab');assert.match(w.document.querySelector('#current-site').textContent,/Hide social feeds/);
w.document.querySelector('#hide-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));active(w,'download-tab');assert.equal(w.document.activeElement.id,'download-tab');
w.document.querySelector('#download-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));active(w,'appearance-tab');w.document.querySelector('#appearance-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));active(w,'hide-tab');
for(const tab of w.document.querySelectorAll('[role=tab]')){tab.click();active(w,tab.id);assert.ok(w.document.getElementById(tab.getAttribute('aria-controls')));}
for(const [url,id]of [['https://mail.google.com/mail/u/1/#inbox','appearance-tab'],['https://www.facebook.com/reel/123','reel-tab'],['https://www.youtube.com/watch?v=abc','download-tab'],['https://cineb.st/movie','guard-tab'],['chrome://extensions','hide-tab']])active(page(url),id);
const ids=[...w.document.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length);
console.log('PASS: vertical tool navigation, keyboard focus/wrap, one visible tool, context routing, intact control IDs.');
