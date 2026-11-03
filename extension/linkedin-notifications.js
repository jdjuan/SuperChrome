(() => {
 if(globalThis.superChromeLinkedInNotifications||!['linkedin.com','www.linkedin.com'].includes(location.hostname))return;
 globalThis.superChromeLinkedInNotifications=true;
 const attr='data-superchrome-linkedin-suggestion';
 let enabled=true,style,summary,scheduled=false;
 function update(){
  scheduled=false;if(!document.documentElement)return;
  const active=enabled&&/^\/notifications\/?$/.test(location.pathname);
  document.documentElement.toggleAttribute('data-superchrome-linkedin-notifications',active);
  // Reclassify recycled rows and restore everything on route/preference changes.
  const previous=new Set(document.querySelectorAll(`[${attr}]`)),hidden=new Set();
  if(active){
   for(const link of document.querySelectorAll('a[href*="highlightedUpdateType="]')){
    if(link.closest('header,nav,[role="dialog"],.msg-overlay-container'))continue;
    let url;try{url=new URL(link.href);}catch{continue;}
    if(!['www.linkedin.com','linkedin.com'].includes(url.hostname)||url.searchParams.get('highlightedUpdateType')!=='REACTIONS_BY_YOUR_NETWORK')continue;
    // Only the observed, explicit network recommendation type. Do not infer
    // relevance from quoted post text or change real notifications server-side.
    const list=link.closest('[data-testid="lazy-column"]');
    if(!list)continue;
    let row=link;while(row.parentElement&&row.parentElement!==list)row=row.parentElement;
    if(row.parentElement!==list||row===link)continue;
    // Never hide a shared ancestor containing other notification cards.
    const destinations=[...row.querySelectorAll('a[componentkey][tabindex="0"]')].filter(a=>{try{return !/^\/(in|company)\//.test(new URL(a.href).pathname);}catch{return true;}});
    if(destinations.length!==1||destinations[0]!==link)continue;
    hidden.add(row);
   }
  }
  for(const row of previous)if(!hidden.has(row))row.removeAttribute(attr);
  for(const row of hidden)if(!row.hasAttribute(attr))row.setAttribute(attr,'');
  if(!style?.isConnected){style=document.createElement('style');style.dataset.superchrome='linkedin-notifications';style.textContent=`html[data-superchrome-linkedin-notifications] [${attr}]{display:none!important}`;document.documentElement.append(style);}
  if(!hidden.size){summary?.remove();return;}
  const first=[...hidden][0],list=first.parentElement;
  if(!summary){
   summary=document.createElement('section');summary.dataset.superchrome='linkedin-notifications-summary';
   const shadow=summary.attachShadow({mode:'open'});
   shadow.innerHTML='<style>:host{display:block;margin:12px 0}.note{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#f2f5fa;color:#18243a;border:1px solid #ccd5e3;border-radius:12px;font:13px/1.5 system-ui}button{background:#254fd1;color:#fff;border:0;border-radius:7px;padding:7px 12px;font:600 12px system-ui;cursor:pointer}button:focus-visible{outline:2px solid #254fd1;outline-offset:3px}@media(prefers-color-scheme:dark){.note{background:#1c2940;color:#eef3ff;border-color:#495c7a}button{background:#aec3ff;color:#142346}}.note{background:var(--sc-surface,#fff);color:var(--sc-text,#182238);border-color:var(--sc-border,#bdc8da)}</style><div class="note"><span role="status"></span><button>Show</button></div>';
   globalThis.SuperChromeTheme?.attach(summary,shadow);
   shadow.querySelector('button').onclick=async()=>{try{await chrome.storage.local.set({linkedinNotifications:false});}catch{shadow.querySelector('button').textContent='Try again';}};
  }
  const text=`${hidden.size} suggested notification${hidden.size===1?'':'s'} hidden`;
  const status=summary.shadowRoot.querySelector('[role=status]');if(status.textContent!==text)status.textContent=text;
  if(list.firstElementChild!==summary)list.prepend(summary);
  globalThis.SuperChromeTheme?.apply(summary);
 }
 function schedule(){if(!scheduled){scheduled=true;queueMicrotask(update);}}
 chrome.storage.local.get({linkedinNotifications:true}).then(s=>{enabled=s.linkedinNotifications!==false;update();}).catch(()=>{});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.linkedinNotifications){enabled=changes.linkedinNotifications.newValue!==false;update();}});
 new MutationObserver(schedule).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['href']});
 window.addEventListener('popstate',update);setInterval(update,500);
})();
