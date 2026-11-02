const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const sessions={},reloads=[];let enabled=true,frameUrl='https://www.youtube.com/watch?v=AAAAAAAAAAA',failSave=false;
 function worker(){let handler,closed;const context={URL,chrome:{runtime:{onMessage:{addListener:fn=>handler=fn}},storage:{local:{get:async()=>({youtubeRecovery:enabled})},session:{get:async key=>({[key]:sessions[key]}),set:async data=>{if(failSave)throw Error('Storage unavailable');Object.assign(sessions,data);},remove:async key=>delete sessions[key]}},webNavigation:{getFrame:async()=>({url:frameUrl})},tabs:{reload:async id=>{assert.ok(sessions[`youtubeRetry:${id}`].length,'must persist before reload');reloads.push(id);},onRemoved:{addListener:fn=>closed=fn}}}};vm.createContext(context);vm.runInContext(read('youtube-recovery-background.js'),context);return{send:(id='AAAAAAAAAAA',tabId=1,url=frameUrl,frameId=0)=>new Promise(resolve=>handler({type:'youtube:retry',videoId:id},{tab:{id:tabId},url,frameId},resolve)),close:id=>closed(id)};}
 let bg=worker();await Promise.all([bg.send(),bg.send(),bg.send()]);assert.equal(reloads.length,1,'simultaneous requests reload once');
 bg=worker();await bg.send();assert.equal(reloads.length,1,'worker restart and document reload do not reset retry');
 await bg.send('AAAAAAAAAAA',2);assert.equal(reloads.length,2,'independent tabs');
 frameUrl='https://www.youtube.com/watch?v=BBBBBBBBBBB';await bg.send('BBBBBBBBBBB');assert.equal(reloads.length,3,'a different video has one retry');frameUrl='https://www.youtube.com/watch?v=AAAAAAAAAAA';await bg.send();assert.equal(reloads.length,3,'returning to a retried video does not reset');
 enabled=false;await bg.send('AAAAAAAAAAA',3);assert.equal(reloads.length,3);enabled=true;failSave=true;await bg.send('AAAAAAAAAAA',3);assert.equal(reloads.length,3,'storage failure must never reload');failSave=false;
 await bg.send('AAAAAAAAAAA',4,'https://evil.example/watch?v=AAAAAAAAAAA');await bg.send('AAAAAAAAAAA',4,frameUrl,1);await bg.send('BBBBBBBBBBB',4,'https://www.youtube.com/watch?v=BBBBBBBBBBB');assert.equal(reloads.length,3,'untrusted, subframe, and stale requests rejected');
 bg.close(2);await tick();assert.equal(sessions['youtubeRetry:2'],undefined);
 // Content detection: visible warning only, once per video, and no unrelated errors.
 function content(markup,url='https://www.youtube.com/watch?v=AAAAAAAAAAA',brave=true){
 const d=new JSDOM(`<html><body>${markup}</body></html>`,{url,runScripts:'outside-only'}),w=d.window;let timeout;const sent=[];
 w.navigator.brave={isBrave:async()=>brave};w.HTMLElement.prototype.getClientRects=function(){return[{}]};w.setTimeout=fn=>{timeout=fn;return 1};w.chrome={runtime:{sendMessage:async message=>{sent.push(message);return{ok:true};}},storage:{local:{get:async defaults=>defaults},onChanged:{addListener:()=>{}}}};w.eval(read('youtube-recovery.js'));return{w,sent,check:async()=>{timeout?.();await tick();}};}
 let p=content('<div id="error-screen">Ad blockers violate YouTube’s Terms of Service</div>');await tick();await p.check();assert.equal(p.sent.length,1);await p.check();assert.equal(p.sent.length,1);
 p.w.history.pushState({},'','/watch?v=BBBBBBBBBBB');p.w.document.dispatchEvent(new p.w.Event('yt-navigate-finish'));await p.check();assert.equal(p.sent.length,2);
 for(const [markup,url]of [
 ['<div class="ytp-error">This video is unavailable</div>','https://www.youtube.com/watch?v=AAAAAAAAAAA'],
 ['<div id="error-screen" hidden>Ad blockers violate YouTube\'s Terms of Service</div>','https://www.youtube.com/watch?v=AAAAAAAAAAA'],
 ['<div style="display:none"><div class="ytp-error">Ad blockers violate YouTube\'s Terms of Service</div></div>','https://www.youtube.com/watch?v=AAAAAAAAAAA'],
 ['<p>Comment: Ad blockers violate YouTube\'s Terms of Service</p>','https://www.youtube.com/watch?v=AAAAAAAAAAA'],
 ['<div class="ytp-error">Ad blockers violate YouTube\'s Terms of Service</div>','https://www.youtube.com/'],
 ['<ytd-watch-flexy video-id="BBBBBBBBBBB"></ytd-watch-flexy><div class="ytp-error">Ad blockers violate YouTube\'s Terms of Service</div>','https://www.youtube.com/watch?v=AAAAAAAAAAA']
 ]){p=content(markup,url);await tick();await p.check();assert.equal(p.sent.length,0,markup);}
 p=content('<div id="error-screen">Ad blockers violate YouTube’s Terms of Service</div>',undefined,false);await tick();await p.check();assert.equal(p.sent.length,0,'Chrome must not run Brave recovery');
 // Async insertion triggers detection, and the popup preference is persistent.
 p=content('');await tick();await p.check();p.w.document.body.innerHTML='<ytd-enforcement-message-view-model>Ad blockers violate YouTube\'s Terms of Service</ytd-enforcement-message-view-model>';await tick();await p.check();assert.equal(p.sent.length,1);
 const d=new JSDOM(read('popup.html'),{runScripts:'outside-only'});let saved;d.window.chrome={tabs:{query:async()=>[{url:'https://www.youtube.com/watch?v=AAAAAAAAAAA'}]},storage:{local:{get:async defaults=>defaults,set:async value=>saved=value}}};d.window.eval(read('youtube-popup.js'));await tick();assert.equal(d.window.document.querySelector('#youtube-recovery-controls').hidden,false);const toggle=d.window.document.querySelector('#youtube-recovery');toggle.checked=false;toggle.dispatchEvent(new d.window.Event('change'));await tick();assert.equal(saved.youtubeRecovery,false);
 console.log('PASS: once per video/tab across reload and worker restart, concurrency, stale requests, disabled preference, storage failure, hidden/unrelated warnings, SPA videos, popup control.');
})().catch(e=>{console.error(e);process.exit(1)});
