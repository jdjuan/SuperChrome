(() => {
  if (globalThis.superChromeInstagramFocus) return;
  globalThis.superChromeInstagramFocus = true;
  if (!['instagram.com','www.instagram.com'].includes(location.hostname)) return;
  const attribute = 'data-superchrome-instagram-focus';
  const contentAttribute = 'data-superchrome-instagram-home-content';
  let enabled = true, style, lastUrl, message;
  const selector = `html[${attribute}] main :is(article, [data-pagelet="story_tray"]):not([role="dialog"], [role="dialog"] *)`;
  function update() {
    if (!document.documentElement) return;
    lastUrl = location.href;
    const active = enabled && location.pathname === '/';
    document.documentElement.toggleAttribute(attribute, active);
    if (!style?.isConnected) {
      style = document.createElement('style');
      style.dataset.superchrome = 'instagram-focus';
      style.textContent = `${selector}, html[${attribute}] main > [${contentAttribute}] { display: none !important; }`;
      document.documentElement.append(style);
    }
    if (!active) { message?.remove(); return; }
    const main = document.querySelector('main');
    if (!main) return;
    // Mark only the Home layout discovered from feed/stories or the suggestions
    // destination. Never hide main itself, navigation, dialogs or a chat editor.
    for (const signal of main.querySelectorAll('article, [data-pagelet="story_tray"], a[href="/explore/people/"]')) {
      if (signal.closest('[role="dialog"]')) continue;
      let root = signal;
      while (root.parentElement && root.parentElement !== main) root = root.parentElement;
      if (root.parentElement !== main || root.querySelector('[role="dialog"], [contenteditable="true"], a[href^="/direct/"]') || root.matches('[role="dialog"]')) continue;
      root.setAttribute(contentAttribute, '');
    }
    if (!message) {
      message = document.createElement('section');
      message.dataset.superchrome = 'instagram-message';
      message.setAttribute('aria-label','Instagram focus');
      const shadow = message.attachShadow({mode:'open'});
      shadow.innerHTML = `<style>
        :host{display:block!important;box-sizing:border-box!important;width:100%!important;}
        .canvas{box-sizing:border-box;min-height:72vh;display:grid;place-content:center;padding:64px 28px;text-align:center;color:#ececf2;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .mark{width:36px;height:3px;background:linear-gradient(90deg,#bba5f5,#f1af9c);border-radius:9px;margin:0 auto 32px;}
        h1{font-size:clamp(38px,5.4vw,78px);font-weight:650;line-height:1.06;letter-spacing:-.055em;margin:0;}
        p{font-size:clamp(25px,3.4vw,48px);line-height:1.2;letter-spacing:-.04em;color:#8d909c;margin:14px 0 0;}
        @media(prefers-color-scheme:light){.canvas{color:#222333}p{color:#777989}}
      </style><div class="canvas"><div class="mark" aria-hidden="true"></div><h1>You’re all caught up.</h1><p>With absolutely nothing.</p></div>`;
    }
    if (message.parentElement !== main) main.append(message);
  }
  chrome.storage.local.get({instagramFocus:true}).then(settings=>{enabled=settings.instagramFocus!==false;update();}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.instagramFocus){enabled=changes.instagramFocus.newValue!==false;update();}});
  // Reconcile new Home layouts and loading containers as Instagram replaces DOM.
  new MutationObserver(update).observe(document,{childList:true,subtree:true});
  window.addEventListener('popstate',update);
  setInterval(()=>{if(location.href!==lastUrl)update();},500);
})();
