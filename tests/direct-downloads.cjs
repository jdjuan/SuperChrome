// Instagram and X save directly through chrome.downloads; the helper is only a fallback.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../extension'),tick=()=>new Promise(r=>setTimeout(r,5));
function background({helper=false,fetchJson,tabReply}={}){
 const handlers=[],downloads=[],jobs=[],native=[],fetched=[];let changed;
 const context={URL,console,setInterval,clearInterval,Promise,
  fetch:async url=>{fetched.push(url);return{ok:true,json:async()=>fetchJson};},
  chrome:{runtime:{lastError:null,onMessage:{addListener:f=>handlers.push(f)},connectNative:()=>{const port={l:{},onMessage:{addListener:f=>port.l.msg=f},onDisconnect:{addListener:f=>port.l.dc=f},postMessage:m=>{native.push(m);setTimeout(()=>{if(helper)port.l.msg({ok:true,message:'Saved'});else{context.chrome.runtime.lastError={message:'Specified native messaging host not found.'};port.l.dc();context.chrome.runtime.lastError=null;}});}};return port;}},
   downloads:{download:async o=>{downloads.push(o);return downloads.length;},search:async({id})=>[{id,state:'complete',bytesReceived:10,totalBytes:10}],onChanged:{addListener:f=>changed=f,removeListener:()=>{}}},
   tabs:{query:async()=>[{id:7}],sendMessage:async(id,m)=>{if(!tabReply)throw Error('Could not establish connection. Receiving end does not exist.');return tabReply(m);}},
   storage:{local:{set:async d=>jobs.push(d.job)}}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(dir,'download-background.js'),'utf8'),context);
 const send=m=>new Promise(r=>handlers[0](m,{},r));
 return{send,downloads,jobs,native,fetched};
}
(async()=>{
 const tweet={mediaDetails:[{video_info:{variants:[{content_type:'application/x-mpegURL',url:'https://video.twimg.com/a.m3u8'},{content_type:'video/mp4',bitrate:256000,url:'https://video.twimg.com/low.mp4'},{content_type:'video/mp4',bitrate:2176000,url:'https://video.twimg.com/high.mp4'}]}}]};
 let b=background({fetchJson:tweet});assert.equal((await b.send({action:'download',url:'https://x.com/user/status/1585341984679469056'})).ok,true);await tick();
 assert.match(b.fetched[0],/^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result\?id=1585341984679469056&token=/);
 assert.deepEqual(b.downloads.map(d=>[d.url,d.filename]),[['https://video.twimg.com/high.mp4','x-1585341984679469056.mp4']]);assert.equal(b.jobs.at(-1).ok,true);assert.equal(b.native.length,0);
 // Untrusted media hosts are refused and fall back to the helper.
 b=background({helper:true,fetchJson:{mediaDetails:[{video_info:{variants:[{content_type:'video/mp4',bitrate:1,url:'https://evil.test/v.mp4'}]}}]}});await b.send({action:'download',url:'https://x.com/u/status/1'});await tick();assert.equal(b.downloads.length,0);assert.equal(b.native.length,1);assert.equal(b.jobs.at(-1).ok,true);
 // Instagram button supplies resolved media.
 b=background();await b.send({action:'download',url:'https://www.instagram.com/p/ABC/',media:[{url:'https://scontent.cdninstagram.com/v.mp4',filename:'instagram-ABC.mp4'}]});await tick();assert.equal(b.downloads[0].filename,'instagram-ABC.mp4');assert.equal(b.jobs.at(-1).ok,true);
 // Popup Instagram link asks the active Instagram tab to resolve it.
 b=background({tabReply:m=>({media:[{url:'https://instagram.fbog1-1.fna.fbcdn.net/v.mp4',filename:'instagram-XYZ.mp4'}]})});await b.send({action:'download',url:'https://www.instagram.com/reel/XYZ/'});await tick();assert.equal(b.downloads[0].filename,'instagram-XYZ.mp4');
 // Not on Instagram and no helper: explain both and ask for the helper.
 b=background();await b.send({action:'download',url:'https://www.instagram.com/reel/XYZ/'});await tick();assert.equal(b.jobs.at(-1).ok,false);assert.equal(b.jobs.at(-1).needsHelper,true);assert.match(b.jobs.at(-1).message,/Open instagram\.com.*helper is not set up/);
 // YouTube without helper asks for setup.
 b=background();await b.send({action:'download',url:'https://www.youtube.com/watch?v=a'});await tick();assert.equal(b.downloads.length,0);assert.equal(b.jobs.at(-1).needsHelper,true);assert.match(b.jobs.at(-1).message,/YouTube downloads need the local helper/);
 console.log('PASS: X direct MP4 selection, media host allowlist, Instagram button/popup direct downloads, helper fallback and setup prompts.');
})().catch(e=>{console.error(e);process.exit(1)});
