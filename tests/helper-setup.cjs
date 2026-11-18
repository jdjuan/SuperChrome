const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const d=new JSDOM(read('popup.html'),{url:'https://extension.test',runScripts:'outside-only'}),w=d.window;let installed=false,copied='',changed;
 w.navigator.clipboard={writeText:async value=>copied=value};w.chrome={runtime:{id:'actual-installed-id',sendMessage:(message,cb)=>cb(installed?{ok:true}:{ok:false,error:'Missing host'})},storage:{local:{get:async()=>({})},onChanged:{addListener:fn=>changed=fn}}};
 w.eval(read('helper-setup.js'));w.eval(read('download-popup.js'));await tick();
 const get=id=>w.document.getElementById(id);
 assert.equal(get('helper-setup').hidden,false,'missing helper shows setup');assert.equal(get('helper-ready').hidden,true);
 get('copy-helper-prompt').click();await tick();assert.match(copied,/actual-installed-id/);assert.match(copied,/def main\(/);assert.match(copied,/NativeMessagingHosts/);assert.match(copied,/4-byte/);assert.match(copied,/never the standalone yt-dlp_macos/);assert.match(copied,/saved_file/);assert.doesNotMatch(copied,/juanherrera|\/opt\/homebrew\/bin\/python3/);assert.doesNotMatch(copied,/Download video/);
 get('dismiss-helper').click();assert.equal(get('helper-setup').hidden,true);assert.equal(get('show-helper-setup').hidden,false);get('show-helper-setup').click();assert.equal(get('helper-setup').hidden,false);
 get('dismiss-helper').click();changed({job:{newValue:{ok:false,needsHelper:true,message:'Need helper'}}});assert.equal(get('helper-setup').hidden,false,'a failed YouTube download reopens setup');
 installed=true;get('check-helper').click();await tick();assert.equal(get('helper-setup').hidden,true);assert.equal(get('helper-ready').hidden,false);
 installed=false;get('check-helper').click();await tick();assert.equal(get('helper-setup').hidden,false);assert.equal(get('helper-ready').hidden,true);
 w.navigator.clipboard.writeText=async()=>{throw Error('Denied')};get('copy-helper-prompt').click();await tick();assert.match(get('helper-setup-status').textContent,/Copy failed/);
 console.log('PASS: YouTube helper setup, missing/connected detection, needs-helper job reopens setup, copyable self-contained prompt, real extension ID, dismissal/reopen, recheck, clipboard failure.');
})().catch(e=>{console.error(e);process.exit(1)});
