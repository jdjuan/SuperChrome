importScripts('policy.js');
async function stateFor(tabId) {
  const [top, settings] = await Promise.all([
    chrome.webNavigation.getFrame({ tabId, frameId: 0 }),
    chrome.storage.local.get({ enabled: true, sites: {} })
  ]);
  const host = guardPolicy.hostname(top?.url);
  return { host, enabled: guardPolicy.enabledFor(host, settings) };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'guardState' || sender.tab?.id == null) return;
  stateFor(sender.tab.id).then(respond, () => respond({ enabled: false }));
  return true;
});
chrome.webNavigation.onCreatedNavigationTarget.addListener(async details => {
  try {
    if ((await stateFor(details.sourceTabId)).enabled) await chrome.tabs.remove(details.tabId);
  } catch { /* The source or target tab may already have closed. */ }
});

let port=null;
chrome.runtime.onMessage.addListener((message,sender,reply)=>{
 if(message.action==='ping'){chrome.runtime.sendNativeMessage('io.jdjuan.local_video',{action:'ping'},r=>{reply(chrome.runtime.lastError?{ok:false,error:chrome.runtime.lastError.message}:r)});return true;}
 if(message.action!=='download')return;
 if(port){reply({error:'A download is already running.'});return;}
 try{const url=new URL(message.url);if(url.protocol!=='https:'||!['youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(url.hostname))throw Error('Enter a YouTube, Instagram, or X HTTPS video URL.');}catch(e){reply({error:e.message});return;}
 chrome.storage.local.set({job:{message:'Starting download…'}});
 let finished=false;
 port=chrome.runtime.connectNative('io.jdjuan.local_video');
 port.onMessage.addListener(result=>{if(typeof result.ok==='boolean')finished=true;chrome.storage.local.set({job:result});});
 port.onDisconnect.addListener(()=>{const error=chrome.runtime.lastError;if(error&&!finished)chrome.storage.local.set({job:{message:error.message}});port=null;});
 port.postMessage({action:'download',url:message.url});reply({ok:true});
});
importScripts('hide-background.js');
