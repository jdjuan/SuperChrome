const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');
function page(url) {
  const {window}=new JSDOM(read('popup.html'),{runScripts:'outside-only'});
  window.chrome={tabs:{query:(_,callback)=>callback([{url}])}};
  window.eval(read('tabs.js'));
  return window;
}
function active(window,id) {
  const doc=window.document;
  assert.equal(doc.querySelector('[role=tab][aria-selected=true]').id,id);
  assert.equal(doc.querySelectorAll('[role=tabpanel]:not([hidden])').length,1);
  assert.equal(doc.querySelectorAll('[role=tab][tabindex="0"]').length,1);
  return doc.querySelector('[role=tabpanel]:not([hidden])');
}

for(const [url,id] of [
  ['https://www.instagram.com/reels/','instagram-tab'],
  ['https://www.linkedin.com/feed/','linkedin-tab'],
  ['https://mail.google.com/mail/u/1/#inbox','gmail-tab'],
  ['https://www.facebook.com/reel/123','facebook-tab'],
  ['https://www.facebook.com/ads/library/','facebook-tab'],
  ['https://youtu.be/abc','youtube-tab'],
  ['https://www.netflix.com/watch/123','netflix-tab'],
  ['https://twitter.com/home','x-tab'],
  ['https://cineb.st/movie','tools-tab'],
  ['chrome://extensions','tools-tab']
]) active(page(url),id);

const w=page('https://www.instagram.com/p/example/');
const d=w.document;
const instagram=active(w,'instagram-tab');
assert.ok(instagram.querySelector('#instagram-audio-enabled'));
assert.equal(instagram.querySelector('#download, #inspect'),null);
for(const tab of d.querySelectorAll('[role=tab]:not(#tools-tab)')){
  const logo=tab.querySelector('img');
  assert.ok(logo && fs.existsSync(path.join(__dirname,'../extension',logo.getAttribute('src'))));
}
{const {document}=page('https://www.youtube.com/watch?v=test');assert.equal(document.getElementById('inspect').closest('#youtube-app'),null,'YouTube stats are on the page, not a popup button');assert.ok(document.getElementById('youtube-stats-enabled'));}
for(const url of ['https://x.com/user/status/123']){
  const {document}=page(url);
  assert.equal(document.getElementById('inspect').closest('details, [hidden]'),null);
  assert.equal(document.getElementById('download'),null,'download lives on the page, not in the popup');
  assert.equal(document.getElementById('url'),null,'no paste-a-link download');
}
for(const id of ['instagram','youtube','x']){
  const toggle=d.getElementById(id+'-download-button');
  assert.ok(toggle&&toggle.closest('#'+id+'-app'),id+' has a download button switch');
}
assert.equal(d.querySelector('#tools-app #download-panel, #tools-app #url'),null);
assert.ok(d.querySelector('#tools-app #guard-panel #enabled'));
assert.ok(d.querySelector('#guard-panel #site'),'current-site switch lives inside the popup blocker card');
const info=instagram.querySelector('summary[aria-label="About Auto-unmute videos"]');
assert.equal(info.parentElement.open,false);
info.click();
assert.equal(info.parentElement.open,true);
assert.match(info.parentElement.textContent,/manually mute|mute the current video/);

d.getElementById('instagram-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
assert.equal(w.document.activeElement.id,'youtube-tab');
const youtube=active(w,'youtube-tab');
assert.ok(youtube.querySelector('#helper-setup'));
assert.ok(youtube.querySelector('#video-rewind-enabled'));
d.getElementById('netflix-tab').click();
const netflix=active(w,'netflix-tab');
assert.ok(netflix.querySelector('#video-rewind-enabled'));
d.getElementById('netflix-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));
active(w,'tools-tab');
d.getElementById('tools-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
active(w,'instagram-tab');
const ids=[...d.querySelectorAll('[id]')].map(element=>element.id);
assert.equal(new Set(ids).size,ids.length);
console.log('PASS: app routing, keyboard navigation, contextual controls, inline help and shared tool state.');
