(() => {
 const section=document.querySelector('#instagram-focus-controls'),toggle=document.querySelector('#instagram-focus'),status=document.querySelector('#instagram-focus-status');
 (async()=>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!['instagram.com','www.instagram.com'].includes(new URL(tab?.url).hostname))return;
  section.hidden=false;
  const settings=await chrome.storage.local.get({instagramFocus:true});
  toggle.checked=settings.instagramFocus!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{
   toggle.disabled=true;
   try{await chrome.storage.local.set({instagramFocus:toggle.checked,instagramRevealUntil:0});status.textContent=toggle.checked?'Home feed, stories and suggestions hidden. Messages and notifications stay available.':'Home feed, stories and suggestions restored.';}
   catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}
   finally{toggle.disabled=false;}
  });
 })().catch(()=>{});
})();
