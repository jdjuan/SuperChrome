(() => {
  let queue=Promise.resolve();
  function videoId(value){try{const url=new URL(value);if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname))return null;return url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/live\/([\w-]+)/)?.[1];}catch{return null;}}
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(message.type!=='youtube:retry')return;
    const tabId=sender.tab?.id,id=message.videoId;
    if(tabId==null||sender.frameId!==0||typeof id!=='string'||!/^[\w-]{6,64}$/.test(id)||videoId(sender.url)!==id){reply({ok:false});return;}
    queue=queue.catch(()=>{}).then(async()=>{
      const {youtubeRecovery=true}=await chrome.storage.local.get({youtubeRecovery:true});
      if(!youtubeRecovery){reply({ok:false});return;}
      const frame=await chrome.webNavigation.getFrame({tabId,frameId:0});
      if(videoId(frame?.url)!==id){reply({ok:false});return;}
      const key=`youtubeRetry:${tabId}`,data=await chrome.storage.session.get(key),retried=data[key]||[];
      if(retried.includes(id)){reply({ok:true,reloaded:false});return;}
      // Persist BEFORE reload. A new document or restarted worker cannot loop.
      await chrome.storage.session.set({[key]:[...retried,id]});
      const latest=await chrome.webNavigation.getFrame({tabId,frameId:0});
      if(videoId(latest?.url)!==id){reply({ok:false});return;}
      await chrome.tabs.reload(tabId);
      reply({ok:true,reloaded:true});
    }).catch(()=>reply({ok:false}));
    return true;
  });
  chrome.tabs.onRemoved.addListener(tabId=>{queue=queue.catch(()=>{}).then(()=>chrome.storage.session.remove(`youtubeRetry:${tabId}`)).catch(()=>{});});
})();
