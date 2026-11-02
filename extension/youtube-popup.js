(() => {
 const section=document.querySelector('#youtube-recovery-controls'),toggle=document.querySelector('#youtube-recovery'),status=document.querySelector('#youtube-recovery-status');
 (async()=>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!['youtube.com','www.youtube.com','m.youtube.com'].includes(new URL(tab?.url).hostname))return;
  section.hidden=false;const settings=await chrome.storage.local.get({youtubeRecovery:true});toggle.checked=settings.youtubeRecovery!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{toggle.disabled=true;try{await chrome.storage.local.set({youtubeRecovery:toggle.checked});status.textContent=toggle.checked?'One automatic retry per video in this tab.':'Automatic retry disabled.';}catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}finally{toggle.disabled=false;}});
 })().catch(()=>{});
})();
