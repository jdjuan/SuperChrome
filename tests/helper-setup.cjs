const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const d=new JSDOM(read('popup.html'),{url:'https://extension.test',runScripts:'outside-only'}),w=d.window;let installed=false,copied='',changed,downloads=0;
 w.navigator.clipboard={writeText:async value=>copied=value};w.chrome={tabs:{query:(q,cb)=>cb([{url:'https://www.youtube.com/watch?v=test'}])},runtime:{id:'actual-installed-id',sendMessage:(message,cb)=>{if(message.action==='ping')cb(installed?{ok:true}:{ok:false,error:'Missing host'});else{downloads++;cb({ok:true});}}},storage:{local:{get:async()=>({job:{message:'Old download'}})},onChanged:{addListener:fn=>changed=fn}}};
 w.eval(read('helper-setup.js'));w.eval(read('download-popup.js'));await tick();
 const get=id=>w.document.getElementById(id);assert.equal(get('helper-setup').hidden,false);assert.equal(get('download').disabled,true);get('download').click();assert.equal(downloads,0);changed({});await tick();assert.match(get('download-status').textContent,/YouTube downloads need the local helper/);
 const url=get('url');url.value='https://www.instagram.com/reel/abc/';url.dispatchEvent(new w.Event('input'));await tick();assert.equal(get('helper-setup').hidden,true);assert.equal(get('download').disabled,false);get('download').click();assert.equal(downloads,1);
 changed({job:{newValue:{ok:false,needsHelper:true,message:'Need helper'}}});await tick();assert.equal(get('helper-setup').hidden,false);
 url.value='https://www.youtube.com/watch?v=test';url.dispatchEvent(new w.Event('input'));await tick();
 get('copy-helper-prompt').click();await tick();assert.match(copied,/actual-installed-id/);assert.match(copied,/def main\(/);assert.match(copied,/NativeMessagingHosts/);assert.match(copied,/4-byte/);assert.match(copied,/never the standalone yt-dlp_macos/);assert.match(copied,/saved_file/);assert.doesNotMatch(copied,/juanherrera|\/opt\/homebrew\/bin\/python3/);
 get('dismiss-helper').click();assert.equal(get('helper-setup').hidden,true);assert.equal(get('show-helper-setup').hidden,false);get('show-helper-setup').click();assert.equal(get('helper-setup').hidden,false);
 installed=true;get('check-helper').click();await tick();assert.equal(get('helper-setup').hidden,true);assert.equal(get('download').disabled,false);get('download').click();assert.equal(downloads,2);
 installed=false;get('check-helper').click();await tick();assert.equal(get('helper-setup').hidden,false);assert.equal(get('download').disabled,true);
 w.navigator.clipboard.writeText=async()=>{throw Error('Denied')};get('copy-helper-prompt').click();await tick();assert.match(get('helper-setup-status').textContent,/Copy failed/);
 console.log('PASS: helper only required for YouTube, Instagram link skips setup, needs-helper job reopens setup, missing/connected helper detection, copyable self-contained prompt, real extension ID, dismissal/reopen, recheck, disabled downloads, clipboard failure.');
})().catch(e=>{console.error(e);process.exit(1)});
