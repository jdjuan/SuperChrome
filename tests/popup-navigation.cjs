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
const info=instagram.querySelector('summary[aria-label="About Auto-unmute videos"]');
assert.equal(info.parentElement.open,false);
info.click();
assert.equal(info.parentElement.open,true);
assert.match(info.parentElement.textContent,/manually mute|mute the current video/);

const download=d.getElementById('url');
download.value='https://www.instagram.com/p/example/';
d.getElementById('instagram-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
assert.equal(w.document.activeElement.id,'youtube-tab');
const youtube=active(w,'youtube-tab');
assert.equal(youtube.querySelector('#url'),download);
assert.equal(download.value,'https://www.instagram.com/p/example/');
assert.ok(youtube.querySelector('#video-rewind-enabled'));
d.getElementById('netflix-tab').click();
const netflix=active(w,'netflix-tab');
assert.ok(netflix.querySelector('#video-rewind-enabled'));
assert.equal(netflix.querySelector('#url'),null);
d.getElementById('netflix-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'End',bubbles:true}));
active(w,'tools-tab');
d.getElementById('tools-tab').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
active(w,'instagram-tab');
const ids=[...d.querySelectorAll('[id]')].map(element=>element.id);
assert.equal(new Set(ids).size,ids.length);
console.log('PASS: app routing, keyboard navigation, contextual controls, inline help and shared tool state.');
