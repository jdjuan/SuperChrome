(() => {
  if (globalThis.superChromeLinkedInFocus) return;
  globalThis.superChromeLinkedInFocus = true;
  if (!['linkedin.com','www.linkedin.com'].includes(location.hostname)) return;
  const attribute = 'data-superchrome-linkedin-focus';
  const contentAttribute = 'data-superchrome-linkedin-home-content';
  let enabled = true, style, lastUrl, message, timer, revealUntil = 0;
  const setText=(element,text)=>{if(element.textContent!==text)element.textContent=text;};
  async function reveal(minutes) {
    try { await chrome.storage.local.set({linkedinRevealUntil:Date.now()+minutes*60000}); }
    catch { const status=message?.shadowRoot.querySelector('[role="status"]');if(status)setText(status,'Could not start the timer. Try again.'); }
  }
  const selector = `html[${attribute}] main :is(.scaffold-finite-scroll, .scaffold-finite-scroll__content, .feed-shared-update-v2, .occludable-update, [data-urn^="urn:li:activity:"]):not([role="dialog"], [role="dialog"] *, .msg-overlay-container, .msg-overlay-container *)`;
  function update() {
    if (!document.documentElement) return;
    lastUrl = location.href;
    const home = ['/feed','/feed/'].includes(location.pathname);
    const revealing = enabled && home && revealUntil > Date.now();
    const active = enabled && home && !revealing;
    document.documentElement.toggleAttribute('data-superchrome-linkedin-revealed', revealing);
    if (revealing) {
      if (!timer) {
        timer=document.createElement('section');timer.dataset.superchrome='linkedin-timer';
        const shadow=timer.attachShadow({mode:'open'});
        shadow.innerHTML='<style>:host{position:fixed!important;bottom:24px!important;right:24px!important;z-index:2147483646!important;font:14px system-ui!important}.pill{display:flex;align-items:center;gap:18px;padding:12px 16px;border:1px solid #ffffff25;border-radius:999px;background:#20212c;color:#f2f1f7;box-shadow:0 8px 32px #0003}button{background:none;border:0;color:#cab5ff;font:600 13px system-ui;cursor:pointer;padding:6px}button:focus-visible{outline:2px solid #cab5ff;border-radius:4px}</style><div class="pill"><span role="timer" aria-label="LinkedIn time remaining"></span><button>Hide now</button></div>';
        shadow.querySelector('button').onclick=async()=>{try{await chrome.storage.local.set({linkedinRevealUntil:Date.now()});}catch{setText(shadow.querySelector('button'),'Try again');}};
      }
      const seconds=Math.max(0,Math.ceil((revealUntil-Date.now())/1000));
      setText(timer.shadowRoot.querySelector('[role=timer]'),`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} left`);
      if(!timer.isConnected)document.documentElement.append(timer);
    } else timer?.remove();
    document.documentElement.toggleAttribute(attribute, active);
    if (!style?.isConnected) {
      style = document.createElement('style');
      style.dataset.superchrome = 'linkedin-focus';
      style.textContent = `${selector}, html[${attribute}] main [${contentAttribute}] { display: none !important; }`;
      document.documentElement.append(style);
    }
    if (!active) { message?.remove(); return; }
    const main = document.querySelector('main');
    if (!main) return;
    // Only the feed's scrolling region, never main, the composer, navigation,
    // messaging overlays or a modal preview. Individual-post routes are excluded.
    for (const region of main.querySelectorAll('.scaffold-finite-scroll')) {
      if (!region.closest('[role="dialog"], .msg-overlay-container') && !region.querySelector('[role="dialog"], [contenteditable="true"]')) region.setAttribute(contentAttribute,'');
    }
    if (!message) {
      message = document.createElement('section');
      message.dataset.superchrome = 'linkedin-message';
      message.setAttribute('aria-label','LinkedIn focus');
      const shadow = message.attachShadow({mode:'open'});
      shadow.innerHTML = `<style>
        :host{display:block!important;box-sizing:border-box!important;width:100%!important;}
        .canvas{box-sizing:border-box;min-height:72vh;display:grid;place-content:center;padding:64px 28px;text-align:center;color:#ececf2;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}
        .mark{width:36px;height:3px;background:linear-gradient(90deg,#bba5f5,#f1af9c);border-radius:9px;margin:0 auto 32px;}
        h1{font-size:clamp(34px,4vw,64px);font-weight:650;line-height:1.06;letter-spacing:-.055em;margin:0;}
        p{font-size:16px;line-height:1.5;color:#8d909c;margin:28px 0 14px;}
        .limits{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}button{border:1px solid #8883;border-radius:999px;padding:11px 22px;background:#8881;color:inherit;font:600 15px system-ui;cursor:pointer}button:hover{background:#bba5f522;border-color:#bba5f5}button:focus-visible{outline:2px solid #bba5f5;outline-offset:3px}[role=status]:empty{display:none}
        @media(prefers-color-scheme:light){.canvas{color:#222333}p{color:#777989}}
      </style><div class="canvas"><div class="mark" aria-hidden="true"></div><h1>You have better things to do.</h1><p>But if not, set a limit:</p><div class="limits"><button data-minutes="1">1 min</button><button data-minutes="3">3 min</button><button data-minutes="5">5 min</button></div><p role="status"></p></div>`;
      shadow.querySelectorAll('[data-minutes]').forEach(button=>{button.onclick=()=>reveal(Number(button.dataset.minutes));});
    }
    setText(message.shadowRoot.querySelector('h1'),revealUntil>0 && revealUntil<=Date.now() ? 'Time’s up. LinkedIn will survive.' : 'You have better things to do.');
    if (message.parentElement !== main) main.append(message);
  }
  chrome.storage.local.get({linkedinFocus:true,linkedinRevealUntil:0}).then(settings=>{enabled=settings.linkedinFocus!==false;revealUntil=Number(settings.linkedinRevealUntil)||0;update();}).catch(()=>{});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.linkedinFocus)enabled=changes.linkedinFocus.newValue!==false;if(changes.linkedinRevealUntil)revealUntil=Number(changes.linkedinRevealUntil.newValue)||0;if(changes.linkedinFocus||changes.linkedinRevealUntil)update();});
  // Reconcile new Home layouts and loading containers as LinkedIn replaces DOM.
  new MutationObserver(update).observe(document,{childList:true,subtree:true});
  window.addEventListener('popstate',update);
  document.addEventListener('visibilitychange',update);
  window.addEventListener('focus',update);
  setInterval(update,500);
})();
