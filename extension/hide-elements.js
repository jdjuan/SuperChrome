(() => {
  if (globalThis.superChromeHider) return;
  globalThis.superChromeHider = true;
  const key = `hidden:${location.hostname}`;
  let style, picker;
  const instagram = ['instagram.com','www.instagram.com'].includes(location.hostname);
  const x = ['x.com','www.x.com','twitter.com','www.twitter.com'].includes(location.hostname);
  const social = instagram || x;
  const siteName = x ? 'X' : 'Instagram';
  const routeAttribute = x ? 'data-superchrome-x-home' : 'data-superchrome-instagram-home';
  const isHome = () => x ? ['/','/home','/home/'].includes(location.pathname) : location.pathname === '/';
  let lastUrl;
  function syncRoute() {
    lastUrl = location.href;
    document.documentElement?.toggleAttribute(routeAttribute, isHome());
  }
  if (social) {
    syncRoute();
    new MutationObserver(()=>{if(location.href!==lastUrl)syncRoute();}).observe(document,{childList:true,subtree:true});
    window.addEventListener('popstate',syncRoute);
    setInterval(()=>{if(location.href!==lastUrl)syncRoute();},500);
  }
  const validTarget = el => el && el.nodeType === 1 && !['HTML','BODY','HEAD'].includes(el.tagName);
  function selectorFor(element) {
    const unique = selector => { try { return document.querySelectorAll(selector).length === 1; } catch { return false; } };
    const parts = [];
    for (let el = element; validTarget(el); el = el.parentElement) {
      let segment = el.tagName.toLowerCase();
      if (el.id && !/\d{5}|[a-f0-9]{16}/i.test(el.id)) {
        segment = '#' + CSS.escape(el.id);
        if (unique(segment)) return [segment,...parts].join(' > ');
      }
      const attr = ['data-testid','data-test-id','aria-label','name','href','src'].find(a => el.getAttribute(a) && el.getAttribute(a).length < 250);
      if (attr) segment += `[${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
      else {
        const classes = [...el.classList].filter(c => !/\d{4}|^(active|selected|hover|focus|open|hidden|visible)$/i.test(c)).slice(0,3);
        segment += classes.map(c => '.'+CSS.escape(c)).join('');
      }
      if (unique([segment,...parts].join(' > '))) return [segment,...parts].join(' > ');
      if (el.parentElement) {
        const siblings = [...el.parentElement.children].filter(s => s.tagName === el.tagName);
        if (siblings.length > 1) segment += `:nth-of-type(${siblings.indexOf(el)+1})`;
      }
      parts.unshift(segment);
      if (unique(parts.join(' > '))) return parts.join(' > ');
    }
    return parts.length ? 'body > '+parts.join(' > ') : null;
  }
  async function apply() {
    const data = await chrome.storage.local.get(key);
    if (social) syncRoute();
    if (!document.documentElement) return;
    if (!style?.isConnected) { style = document.createElement('style'); style.dataset.superchrome = 'hidden-elements'; document.documentElement.append(style); }
    while (style.sheet.cssRules.length) style.sheet.deleteRule(0);
    for (const rule of data[key] || []) {
      try { style.sheet.insertRule(`${social ? `html[${routeAttribute}]:not([data-superchrome-${x ? 'x' : 'instagram'}-revealed]) :is(${rule.selector})` : rule.selector} { display: none !important; }`,style.sheet.cssRules.length); } catch { /* Ignore an obsolete selector. */ }
    }
  }
  function startPicker() {
    picker?.remove();
    const host = document.createElement('div');
    host.style.cssText='all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
    const shadow = host.attachShadow({mode:'closed'});
    shadow.innerHTML='<style>:host{font:14px system-ui}.glass{position:fixed;inset:0;cursor:crosshair}.box{position:fixed;pointer-events:none;border:2px solid #254ee5;background:#254ee522;box-sizing:border-box}.bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);background:#17213a;color:white;padding:12px 16px;border-radius:12px;box-shadow:0 4px 20px #0004;font:14px/1.5 system-ui;max-width:85vw}button{margin-left:12px;padding:6px 10px;border:0;border-radius:6px;cursor:pointer}</style><div class="glass"></div><div class="box"></div><div class="bar" role="status">Click to hide · ↑ select parent · ↓ select child · Esc cancel<button>Cancel</button></div>';
    document.documentElement.append(host); picker=host;
    const box=shadow.querySelector('.box'), bar=shadow.querySelector('.bar'); let target,leaf,saving=false,adjusted=false;
    const hitAt=event=>{host.style.setProperty('pointer-events','none','important');const hit=document.elementFromPoint(event.clientX,event.clientY);host.style.removeProperty('pointer-events');return hit;};
    const paint=()=>{if(!validTarget(target)){box.hidden=true;return;}box.hidden=false;const r=target.getBoundingClientRect();Object.assign(box.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});};
    const stop=()=>{host.remove();document.removeEventListener('keydown',keydown,true);if(picker===host)picker=null;};
    const keydown=event=>{if(!['Escape','ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopImmediatePropagation();adjusted=true;if(event.key==='Escape')stop();else if(event.key==='ArrowUp'&&validTarget(target?.parentElement)){target=target.parentElement;paint();}else if(event.key==='ArrowDown'&&target!==leaf&&target?.contains(leaf)){target=[...target.children].find(el=>el===leaf||el.contains(leaf))||target;paint();}};
    document.addEventListener('keydown',keydown,true);
    shadow.querySelector('button').onclick=stop;
    shadow.querySelector('.glass').addEventListener('pointermove',event=>{leaf=hitAt(event);target=leaf;adjusted=false;paint();});
    shadow.querySelector('.glass').addEventListener('click',async event=>{
      event.preventDefault();event.stopImmediatePropagation();if(!adjusted)target=hitAt(event);if(saving||!validTarget(target))return;
      const selector=selectorFor(target);if(!selector)return;
      saving=true;
      try {
        const response=await chrome.runtime.sendMessage({type:'hide:add',selector,label:(target.getAttribute('aria-label')||target.textContent?.trim()||target.tagName).slice(0,80)});
        if(!response?.ok)throw Error(response?.error||'Could not save this choice.');
        await apply();stop();
      } catch(error) {bar.firstChild.textContent=error.message+' ';saving=false;}
    });
  }
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{if(message.type==='hide:pick'){if(social && !isHome()){reply({ok:false,error:`On ${siteName}, use the picker on Home. Saved hides are disabled elsewhere to protect messages.`});return;}startPicker();reply({ok:true});}});
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[key])apply().catch(()=>{});});
  if(document.documentElement)apply().catch(()=>{});else document.addEventListener('DOMContentLoaded',()=>apply().catch(()=>{}),{once:true});
})();
