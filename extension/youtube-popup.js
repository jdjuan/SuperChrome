(() => {
 const section=document.querySelector('#youtube-recovery-controls'),toggle=document.querySelector('#youtube-recovery'),status=document.querySelector('#youtube-recovery-status');
 (async()=>{
  section.hidden=false;const settings=await chrome.storage.local.get({youtubeRecovery:true});toggle.checked=settings.youtubeRecovery!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{toggle.disabled=true;try{await chrome.storage.local.set({youtubeRecovery:toggle.checked});status.textContent='';}catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}finally{toggle.disabled=false;}});
 })().catch(()=>{});
})();
