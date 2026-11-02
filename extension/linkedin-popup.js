(() => {
 const section=document.querySelector('#linkedin-focus-controls'),toggle=document.querySelector('#linkedin-focus'),status=document.querySelector('#linkedin-focus-status');
 (async()=>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!['linkedin.com','www.linkedin.com'].includes(new URL(tab?.url).hostname))return;
  section.hidden=false;
  const settings=await chrome.storage.local.get({linkedinFocus:true});
  toggle.checked=settings.linkedinFocus!==false;toggle.disabled=false;
  toggle.addEventListener('change',async()=>{
   toggle.disabled=true;
   try{await chrome.storage.local.set({linkedinFocus:toggle.checked,linkedinRevealUntil:0});status.textContent=toggle.checked?'Home feed hidden. Messages and notifications stay available.':'Home feed restored.';}
   catch(error){toggle.checked=!toggle.checked;status.textContent=error.message;}
   finally{toggle.disabled=false;}
  });
 })().catch(()=>{});
})();
