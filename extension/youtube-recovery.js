(() => {
  if(globalThis.superChromeYouTubeRecovery)return;
  globalThis.superChromeYouTubeRecovery=true;
  const requested=new Set();let enabled=true,pending;
  function videoId(){const url=new URL(location.href);return url.pathname==='/watch'?url.searchParams.get('v'):url.pathname.match(/^\/live\/([\w-]+)/)?.[1];}
  function visible(element){
    if(!element.getClientRects().length)return false;
    for(let node=element;node;node=node.parentElement){const css=getComputedStyle(node);if(node.hidden||css.display==='none'||css.visibility==='hidden'||css.opacity==='0')return false;}
    return true;
  }
  function warningVisible(){
    return [...document.querySelectorAll('ytd-enforcement-message-view-model, yt-playability-error-supported-renderers, .ytp-error, #error-screen')].some(element=>{
      const text=(element.textContent||'').replace(/\s+/g,' ');
      return visible(element)&&(/ad\s*blockers? violate youtube[’\x27]s terms of service/i.test(text)||/ad\s*blocker[\s\S]*video playback is blocked/i.test(text)||/bloqueadores? de anuncios[\s\S]*(infringen|violan|no (se )?permiten)/i.test(text));
    });
  }
  async function check(){
    pending=null;const id=videoId();
    if(!enabled||!id||requested.has(id))return;
    // Don't act on an old video's warning while YouTube changes videos in place.
    const rendered=document.querySelector('ytd-watch-flexy[video-id]')?.getAttribute('video-id');
    if(rendered&&rendered!==id)return;
    if(!warningVisible())return;
    requested.add(id);
    try{await chrome.runtime.sendMessage({type:'youtube:retry',videoId:id});}catch{/* Fail closed: never retry repeatedly if storage or messaging fails. */}
  }
  function schedule(){if(!pending)pending=setTimeout(check,750);}
  chrome.storage.local.get({youtubeRecovery:true}).then(settings=>{enabled=settings.youtubeRecovery!==false;if(enabled)schedule();}).catch(()=>{enabled=false;});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.youtubeRecovery){enabled=changes.youtubeRecovery.newValue!==false;if(enabled)schedule();}});
  new MutationObserver(schedule).observe(document,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','style','class','video-id']});
  document.addEventListener('yt-navigate-finish',schedule);
  window.addEventListener('popstate',schedule);
})();
