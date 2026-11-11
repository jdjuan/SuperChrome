(() => {
 const section=document.querySelector('#linkedin-focus-controls'),toggle=document.querySelector('#linkedin-focus'),status=document.querySelector('#linkedin-focus-status');
 (async()=>{
  section.hidden=false;
  const settings=await chrome.storage.local.get({linkedinFocus:true,linkedinNotifications:true,linkedinGameNotifications:true});
  const notifications=document.querySelector('#linkedin-notifications'),notificationStatus=document.querySelector('#linkedin-notifications-status');
  notifications.checked=settings.linkedinNotifications!==false;notifications.disabled=false;
  notifications.addEventListener('change',async()=>{notifications.disabled=true;try{await chrome.storage.local.set({linkedinNotifications:notifications.checked});notificationStatus.textContent='';}catch(error){notifications.checked=!notifications.checked;notificationStatus.textContent=error.message;}finally{notifications.disabled=false;}});
  const games=document.querySelector('#linkedin-game-notifications');
  games.checked=settings.linkedinGameNotifications!==false;games.disabled=false;
  games.addEventListener('change',async()=>{games.disabled=true;try{await chrome.storage.local.set({linkedinGameNotifications:games.checked});notificationStatus.textContent='';}catch(error){games.checked=!games.checked;notificationStatus.textContent=error.message;}finally{games.disabled=false;}});
  toggle.checked=settings.linkedinFocus!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{
   toggle.disabled=true;
   try{await chrome.storage.local.set({linkedinFocus:toggle.checked,linkedinRevealUntil:0});status.textContent='';}
   catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}
   finally{toggle.disabled=false;}
  });
 })().catch(()=>{});
})();
