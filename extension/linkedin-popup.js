(() => {
 const section=document.querySelector('#linkedin-focus-controls'),toggle=document.querySelector('#linkedin-focus'),status=document.querySelector('#linkedin-focus-status');
 (async()=>{
  section.hidden=false;
  const settings=await chrome.storage.local.get({linkedinFocus:true,linkedinNotifications:true});
  const notifications=document.querySelector('#linkedin-notifications'),notificationStatus=document.querySelector('#linkedin-notifications-status');
  notifications.checked=settings.linkedinNotifications!==false;notifications.disabled=false;
  notifications.addEventListener('change',async()=>{notifications.disabled=true;try{await chrome.storage.local.set({linkedinNotifications:notifications.checked});notificationStatus.textContent='';}catch(error){notifications.checked=!notifications.checked;notificationStatus.textContent=error.message;}finally{notifications.disabled=false;}});
  toggle.checked=settings.linkedinFocus!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{
   toggle.disabled=true;
   try{await chrome.storage.local.set({linkedinFocus:toggle.checked,linkedinRevealUntil:0});status.textContent='';}
   catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}
   finally{toggle.disabled=false;}
  });
 })().catch(()=>{});
})();
