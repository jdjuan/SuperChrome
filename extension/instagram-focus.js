(() => {
  if (globalThis.superChromeInstagramFocus) return;
  globalThis.superChromeInstagramFocus = true;
  if (!['instagram.com','www.instagram.com'].includes(location.hostname)) return;
  const attribute = 'data-superchrome-instagram-focus';
  let enabled = true, style, lastUrl;
  const selector = `html[${attribute}] main :is(article, [data-pagelet="story_tray"]):not([role="dialog"], [role="dialog"] *)`;
  function update() {
    if (!document.documentElement) return;
    lastUrl = location.href;
    const home = location.pathname === '/';
    document.documentElement.toggleAttribute(attribute, enabled && home);
    if (!style?.isConnected) {
      style = document.createElement('style');
      style.dataset.superchrome = 'instagram-focus';
      style.textContent = `${selector} { display: none !important; }`;
      document.documentElement.append(style);
    }
  }
  chrome.storage.local.get({instagramFocus:true}).then(settings=>{enabled=settings.instagramFocus!==false;update();}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.instagramFocus){enabled=changes.instagramFocus.newValue!==false;update();}});
  // Instagram changes routes without a full document navigation. Watch DOM commits
  // and back/forward navigation without patching the site's history functions.
  const observer = new MutationObserver(()=>{if(location.href!==lastUrl||!style?.isConnected)update();});
  observer.observe(document,{childList:true,subtree:true});
  window.addEventListener('popstate',update);
  // A route can change without a DOM commit (for example cached views).
  setInterval(()=>{if(location.href!==lastUrl)update();},500);
})();
