(() => {
 const section=document.querySelector('#x-focus-controls'),toggle=document.querySelector('#x-focus'),status=document.querySelector('#x-focus-status');
 (async()=>{
  section.hidden=false;
  const settings=await chrome.storage.local.get({xFocus:true});
  toggle.checked=settings.xFocus!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{
   toggle.disabled=true;
   try{await chrome.storage.local.set({xFocus:toggle.checked,xRevealUntil:0});status.textContent='';}
   catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}
   finally{toggle.disabled=false;}
  });
 })().catch(()=>{});
})();
