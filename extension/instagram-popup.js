(() => {
 const section=document.querySelector('#instagram-focus-controls'),toggle=document.querySelector('#instagram-focus'),status=document.querySelector('#instagram-focus-status');
 (async()=>{
  section.hidden=false;
  const settings=await chrome.storage.local.get({instagramFocus:true});
  toggle.checked=settings.instagramFocus!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{
   toggle.disabled=true;
   try{await chrome.storage.local.set({instagramFocus:toggle.checked,instagramRevealUntil:0});status.textContent='';}
   catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}
   finally{toggle.disabled=false;}
  });
 })().catch(()=>{});
})();
