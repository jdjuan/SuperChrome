(() => {
  if (globalThis.__scAds) return;
  globalThis.__scAds = true;
  let resortNow=false, resultsText=null, resultsAt=0, topCache=0, topAt=0, lastScan=0, rankSeq=0, freshCount=0, viewKey=null, memory={}, memoryTimer;
  const seen=new WeakSet(), ranks=new Map(), MEMORY_KEY='adLibraryViewsV1';
  let enabled = true, filterBar = true, view = {sort:'meta',min:0,format:'all',active:false,winners:false}, bar = null, loading = null, pending, ready=false, activeLookup=null, saveTimer;
  const DAY=86400000, TTL=21*DAY, CACHE_KEY='adLibraryAudienceV2';
  let cache={};
  let workerId=null, worker=false, workerAuthorized=false, identityReady=false;
  chrome.runtime.sendMessage({action:'adAudienceWorker'}).then(r=>{
    workerAuthorized=r?.authorized===true;worker=workerAuthorized;workerId=r?.id||null;
    identityReady=true;schedule();
  }).catch(()=>{identityReady=true;schedule();});
  function saveCache(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{
    const entries=Object.entries(cache).filter(([,v])=>Date.now()-v.at<TTL).sort((a,b)=>b[1].at-a[1].at).slice(0,500);
    cache=Object.fromEntries(entries);chrome.storage.local.set({[CACHE_KEY]:cache}).catch(()=>{});
  },300);}
  function remember(id,value){
    const previous=cache[id];
    if(previous && JSON.stringify(previous.value)===JSON.stringify(value) && Date.now()-previous.at<DAY)return;
    audience.set(id,value);cache[id]={at:Date.now(),value};saveCache();
  }
  function stopLookup(){activeLookup=null;}
  function loadAudience(){
    if(worker || !ready || !enabled || activeLookup)return;
    const r=[...records.values()].find(r=>r.eu && !audience.has(r.id) && (!r.attempted || Date.now()-r.attempted>DAY));
    if(!r)return;
    r.attempted=Date.now();const task={id:r.id};activeLookup=task;
    chrome.runtime.sendMessage({action:'adAudienceLookup',id:r.id}).then(result=>{
      if(result?.value){const a=result.value;
        if(Array.isArray(a.flags) && a.flags.length<=100 && a.flags.every(f=>typeof f.name==='string' && typeof f.flag==='string') && (!a.age || /^\d{1,2}[-–]\d{1,2}\+?$/.test(a.age)) && (!a.gender || /^(All|Women|Men|Female|Male)$/.test(a.gender)))remember(r.id,a);
      }
    }).catch(()=>{}).finally(()=>{if(activeLookup===task)activeLookup=null;schedule();});
  }
  const records = new Map(), audience = new Map();
  const text = node => (node?.innerText || node?.textContent || '').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const idOf = s => s.match(/Library ID:\s*(\d+)/i)?.[1];
  const names = new Intl.DisplayNames(['en'], {type:'region'});
  const countries = new Map();
  for(let a=65;a<=90;a++) for(let b=65;b<=90;b++) {
    const code=String.fromCharCode(a,b), name=names.of(code);
    if(name && name!==code) countries.set(name, String.fromCodePoint(127397+a,127397+b));
  }
  function facts(s) {
    const D='([A-Z][a-z]+ \\d{1,2}, \\d{4})';
    const range = s.match(new RegExp(D+'\\s*[-–]\\s*'+D));
    const date = s.match(/Started running on\s+([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1] || range?.[1];
    const start = Date.parse(date || ''), end = Date.parse(range?.[2] || '');
    const days = Number.isFinite(start) ? Math.max(0, Math.floor((Date.now()-start)/86400000)) : null;
    const reuse = Number(s.match(/(\d+) ads use this creative and text/i)?.[1] || 1);
    const low = /Low impression count|Impressions:\s*<\s*100/i.test(s);
    const inactive = /\bInactive\b/i.test(s);
    return {start,end,days,reuse,low,inactive};
  }
  function readAudience() {
    for(const table of document.querySelectorAll('table,[role=table]')) {
      if(!/Targeting table/i.test(table.getAttribute('aria-label')||'')) continue;
      let scope=table.parentElement;
      while(scope && !/EU ad audience/.test(text(scope))) scope=scope.parentElement;
      if(!scope) continue;
      let dialog=scope;
      while(dialog && !idOf(text(dialog))) dialog=dialog.parentElement;
      const id=idOf(text(dialog)); if(!id) continue;
      const s=text(scope).split('EU ad delivery')[0];
      const flags=[];
      for(const row of table.querySelectorAll('tr,[role=row]')) {
        const cells=[...row.querySelectorAll('td,[role=cell]')].map(text);
        if(cells[1]==='Country' && cells[2]==='Included' && countries.has(cells[0])) flags.push({name:cells[0],flag:countries.get(cells[0])});
      }
      const age=s.match(/Age\s+(\d{1,2}\s*[-–]\s*\d{1,2}\+?)\s*years old/i)?.[1];
      const gender=s.match(/Gender\s+(All|Women|Men|Female|Male)\b/i)?.[1];
      if(worker && id===workerId){if(workerAuthorized)chrome.runtime.sendMessage({action:'adAudienceResult',id,value:{flags,age,gender}}).catch(()=>{});}else if(!worker)remember(id,{flags,age,gender});
    }
  }
  function restore(r) {
    r.host.remove();
    for(const [node,value,priority] of r.hidden) { if(value) node.style.setProperty('display',value,priority); else node.style.removeProperty('display'); }
  }
  const daysOf=f=>Number.isFinite(f.start)?Math.max(0,Math.floor(((Number.isFinite(f.end)?f.end:Date.now())-f.start)/DAY)):null;
  // A winner is still active, is not low reach and has run long enough to suggest it pays for itself.
  const isWinner=f=>{const d=daysOf(f);return !f.inactive && !f.low && d!==null && (d>=180 || (d>=90 && f.reuse>=2));};
  function render(r) {
    const f=r.facts, a=audience.get(r.id);
    const key=JSON.stringify([f,a,Math.floor(Date.now()/DAY)]);
    if(r.key===key && Date.now()-(r.themeAt||0)<5000)return;
    r.themeAt=Date.now();
    if(r.key===key){SuperChromeTheme.apply(r.host);return;}
    r.key=key;
    const days=daysOf(f);
    const win=r.root.querySelector('.winner');win.hidden=!isWinner(f);r.host.toggleAttribute('data-winner',!win.hidden);
    const count=r.root.querySelector('.days');
    count.textContent=days===null?'':String(days);
    count.title=f.inactive?(Number.isFinite(f.end)?`Inactive ad. Ran ${days} days between Meta’s start and end dates; it may not have run continuously.`:'Inactive ad. Start date is not a measure of active run time.'):`${days??'Unknown'} days since Meta’s start date. Longer running is a research signal, not proof of profitability.`;
    r.root.querySelector('.unit').textContent=f.inactive?'days · inactive':days===1?'day':'days';
    r.root.querySelector('.duration').title=count.title;
    const reuse=r.root.querySelector('.reuse');reuse.hidden=f.reuse<=1;
    reuse.title=`${f.reuse} ads use this creative and text`;reuse.querySelector('span').textContent='×'+f.reuse;
    r.root.querySelector('.low').hidden=!f.low;
    const tier=days>=180?'fire':days>=90?'hot':days>=30?'warm':'new';
    r.root.querySelector('.duration').dataset.tier=tier;
    r.root.querySelector('.duration').dataset.inactive=String(!!f.inactive);
    r.root.querySelector('.duration').hidden=days===null;
    const [flags,age,gender]=r.root.querySelectorAll('.fact');
    const list=a?.flags||[];
    flags.hidden=!list.length;
    flags.textContent=list.slice(0,4).map(x=>x.flag).join(' ')+(list.length>4?` +${list.length-4}`:'');
    flags.title=list.length?'Targeted countries: '+list.map(x=>x.name).join(', '):'';
    age.hidden=!a?.age;
    age.querySelector('span').textContent=(a?.age||'').replace(/\s*[-–]\s*/,'–');
    age.title=a?.age?'Targeted age range: '+a.age:'';
    gender.hidden=!a?.gender;
    const g=a?.gender||'';
    gender.querySelector('.f').hidden=/^(Men|Male)$/i.test(g);
    gender.querySelector('.m').hidden=/^(Women|Female)$/i.test(g);
    gender.title=g?'Targeted gender: '+g:'';
    for(const node of [flags,age,gender])node.setAttribute('aria-label',node.title);
    r.root.querySelector('.audience').hidden=flags.hidden&&age.hidden&&gender.hidden;
    SuperChromeTheme.apply(r.host);
  }
  function cardOf(r){
    if(r.card?.isConnected && r.card.contains(r.host))return r.card;
    let c=r.header;
    while(c.parentElement && c.parentElement!==document.body && c.parentElement.querySelectorAll('[data-superchrome="ad-library"]').length<=1)c=c.parentElement;
    return r.card=c;
  }
  function formatOf(r){
    const c=cardOf(r);
    if(c.querySelector('video'))return 'video';
    const images=c.querySelectorAll('img').length-1; // the first image is the advertiser avatar
    return images>=2?'carousel':images===1?'image':'unknown';
  }
  const filtering=()=>view.min>0||view.format!=='all'||view.active||view.winners;
  function matches(r){
    const f=r.facts,d=daysOf(f);
    if(view.min>0 && (d===null || d<view.min))return false;
    if(view.active && f.inactive)return false;
    if(view.winners && !isWinner(f))return false;
    if(view.format!=='all' && formatOf(r)!==view.format)return false;
    return true;
  }
  function clearView(){
    for(const node of document.querySelectorAll('[data-sc-order]')){node.style.removeProperty('order');node.removeAttribute('data-sc-order');}
    for(const node of document.querySelectorAll('[data-sc-filtered]')){node.style.removeProperty('display');node.removeAttribute('data-sc-filtered');}
    for(const node of document.querySelectorAll('[data-sc-winner]'))node.removeAttribute('data-sc-winner');
  }
  function winnerStyle(){
    if(document.getElementById('sc-ad-winner-style-v4'))return;
    const style=document.createElement('style');style.id='sc-ad-winner-style-v4';
    // Box shadow only: positioning or re-bordering the card would disturb Meta's layout and sticky header.
    style.textContent=`[data-sc-winner]{align-self:start!important;box-shadow:0 0 0 1px rgba(20,134,74,.45)!important}`;
    (document.head||document.documentElement).append(style);
  }
  function applyView(){
    const list=[...records.values()].filter(r=>r.host.isConnected);
    const containers=new Set(list.map(r=>cardOf(r).parentElement).filter(c=>c && c!==document.body && c!==document.documentElement && list.length>1));
    const mark=(node,attr,prop,value)=>{if(node.style.getPropertyValue(prop)!==value)node.style.setProperty(prop,value,prop==='display'?'important':'');if(!node.hasAttribute(attr))node.setAttribute(attr,'');};
    const unmark=(node,attr,prop)=>{if(node.hasAttribute(attr)){node.style.removeProperty(prop);node.removeAttribute(attr);}};
    winnerStyle();
    const shown=[];
    for(const r of list){
      const c=cardOf(r);
      if(isWinner(r.facts))c.setAttribute('data-sc-winner','');else c.removeAttribute('data-sc-winner');
      if(!containers.has(c.parentElement))continue;
      if(matches(r)){unmark(c,'data-sc-filtered','display');shown.push(r);}else mark(c,'data-sc-filtered','display','none');
    }
    const owned=new Set(list.map(cardOf));
    for(const c of containers)for(const child of c.children){
      if(owned.has(child))continue;
      if(filtering())mark(child,'data-sc-filtered','display','none');else unmark(child,'data-sc-filtered','display');
      if(view.sort!=='meta')mark(child,'data-sc-order','order','100000');else unmark(child,'data-sc-order','order');
    }
    if(view.sort==='meta'){ranks.clear();freshCount=0;for(const r of list)unmark(cardOf(r),'data-sc-order','order');}
    else{
      const time=r=>Number.isFinite(r.facts.start)?r.facts.start:Infinity;
      const run=r=>daysOf(r.facts)??-1;
      const sorted=list.slice().sort(view.sort==='reuse'?(a,b)=>b.facts.reuse-a.facts.reuse||run(b)-run(a):(a,b)=>run(b)-run(a)||time(a)-time(b));
      // While the reader is inside the results, keep sorted cards where they are and queue new ones at the end.
      const reading=bar?.isConnected && bar.getBoundingClientRect().top<=topCache+2 && scrollY>0;
      if(!ranks.size || !reading || loading===null && resortNow){ranks.clear();rankSeq=0;for(const r of sorted)ranks.set(r.id,rankSeq++);freshCount=0;resortNow=false;}
      else{let fresh=0;for(const r of sorted)if(!ranks.has(r.id)){ranks.set(r.id,rankSeq++);fresh++;}freshCount+=fresh;}
      for(const r of list)mark(cardOf(r),'data-sc-order','order',String(ranks.get(r.id)));
    }
    renderBar(list,shown,containers);
  }
  function stickyTop(){
    // Meta stacks a fixed nav and a sticky search/filter header; sit below every layer.
    if(!document.elementsFromPoint)return 0;
    const x=Math.max(8,(bar?.getBoundingClientRect().left||0)+12);
    let top=0;
    for(let i=0;i<5;i++){
      let next=top;
      for(const el of document.elementsFromPoint(x,top+1)){
        if(bar && (el===bar || bar.contains(el)))continue;
        for(let n=el;n && n!==document.body && n!==document.documentElement;n=n.parentElement){
          const pos=getComputedStyle(n).position;
          if(pos==='fixed'||pos==='sticky'){const rect=n.getBoundingClientRect();if(rect.top<=top+1 && rect.bottom>next)next=rect.bottom;break;}
        }
      }
      if(next<=top)break;top=next;
    }
    return Math.round(Math.min(top,280));
  }
  function buildBar(){
    const host=document.createElement('div');host.dataset.superchrome='ad-library-bar';
    const root=host.attachShadow({mode:'open'});
    const opts=(k,list)=>`<select data-k="${k}">${list.map(([v,t])=>`<option value="${v}">${t}</option>`).join('')}</select>`;
    root.innerHTML=`<style>
    :host{display:block!important;position:sticky!important;top:var(--sc-top,0px);z-index:20;margin:0 0 16px;font:13px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    *{box-sizing:border-box}[hidden]{display:none!important}
    .bar{color:var(--sc-text);background:var(--sc-surface);border:1px solid var(--sc-border);border-radius:14px;padding:10px 14px;box-shadow:0 8px 24px -14px rgba(0,0,0,.45)}
    .controls{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px}
    .brand{display:inline-flex;align-items:center;gap:7px;font-weight:750;font-size:14px}.brand svg{width:20px;height:20px}
    label{display:inline-flex;align-items:center;gap:6px;color:var(--sc-muted);font-weight:550}
    select{appearance:none;font-weight:600;font-size:13px;font-family:inherit;color:var(--sc-text);background:var(--sc-button) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23889' stroke-width='2.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") no-repeat right 8px center/12px;border:1px solid var(--sc-border);border-radius:9px;height:32px;padding:0 28px 0 10px;cursor:pointer}
    .check{height:32px;padding:0 11px;border:1px solid var(--sc-border);border-radius:9px;background:var(--sc-button);color:var(--sc-text);cursor:pointer}
    .check input{margin:0;accent-color:var(--sc-accent);width:15px;height:15px}
    .win svg{fill:#127a43}.win:has(input:checked){color:#fff;background:#127a43;border-color:#127a43}.win:has(input:checked) input{accent-color:#fff}.win:has(input:checked) svg{fill:#fff}
    .fresh{height:32px;padding:0 12px;border:1px solid var(--sc-accent);border-radius:9px;background:transparent;color:var(--sc-accent);font-weight:700;font-size:13px;font-family:inherit;cursor:pointer}.memory{white-space:nowrap}
    .win svg{width:14px;height:14px}
    .load{margin-left:auto;height:34px;padding:0 16px;border:0;border-radius:10px;font-weight:700;font-size:13px;font-family:inherit;color:var(--sc-surface);background:var(--sc-accent);cursor:pointer}
    .load[aria-pressed=true]{color:var(--sc-text);background:var(--sc-button);border:1px solid var(--sc-border)}
    select:focus-visible,.check:has(input:focus-visible),.load:focus-visible{outline:2px solid var(--sc-accent);outline-offset:2px}
    .stats{margin-top:8px;color:var(--sc-muted);font-size:12px}.stats b{color:var(--sc-text)}
    @media(max-width:700px){.load{margin-left:0}}
    </style><div class="bar" role="toolbar" aria-label="SuperChrome ad filters"><div class="controls">
    <span class="brand"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#ffb020"/><path d="M12 5.5l2 4.2 4.6.6-3.4 3.2.9 4.5-4.1-2.2-4.1 2.2.9-4.5-3.4-3.2 4.6-.6z" fill="#fff"/></svg>SuperChrome</span>
    <label>Sort ${opts('sort',[['meta','Meta order'],['longest','Longest running'],['reuse','Most reused']])}</label>
    <label>Running ${opts('min',[['0','Any'],['7','7+ days'],['30','30+ days'],['90','90+ days'],['180','180+ days']])}</label>
    <label>Format ${opts('format',[['all','All'],['video','Video'],['image','Image'],['carousel','Carousel']])}</label>
    <label class="check"><input type="checkbox" data-k="active">Active only</label>
    <label class="check win"><input type="checkbox" data-k="winners"><svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>Winners only</label>
    <button class="fresh" type="button" hidden></button>
    <button class="load" type="button" aria-pressed="false">Load all results</button>
    </div><div class="stats" role="status"></div></div>`;
    for(const el of root.querySelectorAll('[data-k]'))el.addEventListener('change',()=>{
      const k=el.dataset.k;view={...view,[k]:el.type==='checkbox'?el.checked:k==='min'?Number(el.value):el.value};
      chrome.storage.local.set({adLibraryView:view}).catch(()=>{});resortNow=true;applyView();
    });
    root.querySelector('.load').onclick=()=>loading?stopLoading():loadAll();
    root.querySelector('.fresh').onclick=()=>{resortNow=true;applyView();bar?.scrollIntoView?.({block:'start'});};
    return host;
  }
  function stopLoading(){if(loading){loading.stop=true;}}
  async function loadAll(){
    const task=loading={stop:false};const wait=ms=>new Promise(r=>setTimeout(r,ms));
    let last=-1,still=0;
    while(!task.stop && still<5 && records.size<2000 && enabled){
      scrollTo(0,document.documentElement.scrollHeight);await wait(1300);scan();
      if(records.size===last)still++;else{still=0;last=records.size;}
    }
    loading=null;resortNow=true;applyView();rememberView(true);bar?.scrollIntoView?.({block:'start'});
  }
  function currentViewKey(){
    const q=new URLSearchParams(location.search);
    const page=q.get('view_all_page_id');
    return page?`page:${page}:${q.get('country')||''}:${q.get('active_status')||''}`:q.get('q')?`q:${q.get('q').toLowerCase()}:${q.get('country')||''}:${q.get('active_status')||''}`:null;
  }
  // Remembers, per advertiser page or search, how many ads were loaded and how many were winners.
  function rememberView(done,list=[...records.values()],winners=list.filter(r=>isWinner(r.facts)).length){
    viewKey=currentViewKey();if(!viewKey)return;
    const past=memory[viewKey];
    if(!done && past && past.loaded>=list.length)return;
    if(!done && list.length<10)return;
    memory[viewKey]={at:Date.now(),loaded:list.length,winners};
    clearTimeout(memoryTimer);memoryTimer=setTimeout(()=>{
      const kept=Object.entries(memory).filter(([,v])=>Date.now()-v.at<TTL).sort((a,b)=>b[1].at-a[1].at).slice(0,200);
      memory=Object.fromEntries(kept);chrome.storage.local.set({[MEMORY_KEY]:memory}).catch(()=>{});
    },1000);
  }
  function renderBar(list,shown,containers){
    const show=enabled && filterBar && !worker && list.length>1 && containers.size>0;
    if(!show){bar?.remove();bar=null;return;}
    const grid=[...containers][0];
    if(!bar)bar=buildBar();
    if(bar.nextElementSibling!==grid)grid.parentElement.insertBefore(bar,grid);
    const root=bar.shadowRoot;
    for(const el of root.querySelectorAll('[data-k]')){const v=view[el.dataset.k];if(el.type==='checkbox')el.checked=!!v;else el.value=String(v);}
    if(Date.now()-topAt>2000){topAt=Date.now();topCache=stickyTop();}
    bar.style.setProperty('--sc-top',topCache+'px');
    const days=shown.map(r=>daysOf(r.facts)).filter(d=>d!==null).sort((a,b)=>a-b);
    const median=days.length?days[Math.floor((days.length-1)/2)]:null,min=view.min||30;
    if(Date.now()-resultsAt>3000){resultsAt=Date.now();const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);resultsText=null;for(let n;(n=w.nextNode());){const m=n.data.match(/^\s*[~>]?\s?[\d.,]+K?\s+results?\s*$/);if(m){resultsText=m[0].trim();break;}}}
    const total=resultsText;
    const winners=shown.filter(r=>isWinner(r.facts)).length;
    root.querySelector('.stats').innerHTML=`Showing <b>${shown.length}</b> of ${list.length} loaded ads${total?` (${total.replace(/\s+/g,' ').trim()})`:''}${median!==null?` · median <b>${median} days</b> running`:''} · <b>${days.filter(d=>d>=min).length}</b> at ${min}+ days · <b>${winners}</b> ${winners===1?'winner':'winners'}`;
    rememberView(false,list,winners);
    const past=viewKey&&memory[viewKey];
    if(past && past.loaded>list.length){const ago=Math.max(0,Math.round((Date.now()-past.at)/DAY));root.querySelector('.stats').insertAdjacentHTML('beforeend',` <span class="memory">· Last visit${ago?` (${ago===1?'yesterday':ago+' days ago'})`:''}: <b>${past.winners}</b> ${past.winners===1?'winner':'winners'} in ${past.loaded} ads</span>`);}
    const fresh=root.querySelector('.fresh');fresh.hidden=!(freshCount>0 && view.sort!=='meta');fresh.textContent=`↻ Sort ${freshCount} new`;
    const load=root.querySelector('.load');load.setAttribute('aria-pressed',String(!!loading));load.textContent=loading?`Loading… ${list.length} ads · Stop`:'Load all results';
    SuperChromeTheme.apply(bar);
  }
  function scan() {
    pending=null;lastScan=performance.now();
    if(!identityReady)return;
    if(!enabled || !location.pathname.startsWith('/ads/library')) {
      stopLookup();stopLoading();for(const r of records.values()) restore(r); records.clear(); clearView(); bar?.remove(); bar=null; return;
    }
    readAudience();
    if(worker){
      if(!workerAuthorized)return;
      const links=[...document.querySelectorAll('button,[role=button],a,[role=link]')];
      const belongs=n=>{for(let p=n.parentElement;p;p=p.parentElement){const id=idOf(text(p));if(id)return id===workerId;}return false;};
      const transparency=links.find(n=>/^Transparency by location$/.test(text(n)) && belongs(n));
      const details=links.find(n=>/^See ad details$/.test(text(n)) && belongs(n));
      if(!document.querySelector('table[aria-label="Targeting table"]')) {
        const target=transparency||details;
        if(target && !target.dataset.scOpened){target.dataset.scOpened='true';target.click();}
      }
      return;
    }
    for(const [header,r] of records) if(!header.isConnected) {restore(r);records.delete(header);}
    // Each button is classified once; rescanning every button against every ad made large pages slow.
    for(const button of document.querySelectorAll('[role=button],button')) {
      if(seen.has(button))continue;
      if(!/^(See ad details|See summary details)$/i.test((button.textContent||'').trim()) || button.closest('[role=dialog]')) {seen.add(button);continue;}
      let header=button.parentElement;
      while(header && !idOf(header.textContent)) header=header.parentElement;
      if(!header || header===document.body) continue;
      if(records.has(header)){seen.add(button);continue;}
      // Leave groups of ads untouched rather than collapsing unrelated content.
      if((header.textContent.match(/Library ID:/g)||[]).length!==1) {seen.add(button);continue;}
      seen.add(button);
      const id=idOf(text(header)), host=document.createElement('div');
      host.dataset.superchrome='ad-library';
      const root=host.attachShadow({mode:'open'});
      root.innerHTML=`<style>
      :host{display:block!important;padding:0 16px;margin:0;font:13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--sc-text);background:var(--sc-surface);
        --t-new-fg:#a1251a;--t-new-bg:#ffe5df;--t-warm-fg:#874600;--t-warm-bg:#fff0d4;--t-hot-fg:#4a6600;--t-hot-bg:#eef7d4;--t-fire-fg:#136a39;--t-fire-bg:#dcf3e5;
        --reuse-fg:#136a39;--reuse-bg:#e1f4e8;--low-fg:#874600;--low-bg:#fff0d4;--chip-bg:#f2f4f8;--chip-border:#dfe4ec;--f:#b0215f;--m:#1d5cbd}
      :host([data-superchrome-theme=dark]){--t-new-fg:#ffb6aa;--t-new-bg:#47211c;--t-warm-fg:#ffd68c;--t-warm-bg:#3e2d0e;--t-hot-fg:#d6f28f;--t-hot-bg:#2e3911;--t-fire-fg:#a3f0c4;--t-fire-bg:#173a2a;
        --reuse-fg:#a3f0c4;--reuse-bg:#173a2a;--low-fg:#ffd68c;--low-bg:#3e2d0e;--chip-bg:#253150;--chip-border:#3a4767;--f:#ffa3cf;--m:#a5c8ff}
      *{box-sizing:border-box}[hidden]{display:none!important}
      .row{display:flex;align-items:center;gap:8px;padding:10px 0 2px;color:var(--sc-text);background:var(--sc-surface)}
      .pill{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:650;white-space:nowrap}
      svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .duration{height:34px;padding:0 12px 0 10px;gap:6px;color:var(--t-new-fg);background:var(--t-new-bg)}
      .duration[data-tier=warm]{color:var(--t-warm-fg);background:var(--t-warm-bg)}.duration[data-tier=hot]{color:var(--t-hot-fg);background:var(--t-hot-bg)}
      .duration[data-tier=fire]{color:var(--t-fire-fg);background:var(--t-fire-bg)}
      .duration svg{width:17px;height:17px}.duration .ic{display:none}.duration[data-tier=new] .i-new,.duration[data-tier=warm] .i-warm,.duration[data-tier=hot] .i-hot,.duration[data-tier=fire] .i-hot{display:block}.duration[data-inactive=true] .ic{display:none!important}.duration[data-inactive=true] .i-off{display:block!important}
      .duration[data-tier=fire] .i-hot{fill:currentColor;fill-opacity:.25}
      .days{font-size:20px;font-weight:780;letter-spacing:-.5px;font-variant-numeric:tabular-nums}.unit{font-size:11px;font-weight:600}
      .winner{color:#fff;background:#127a43;font-size:12px;font-weight:750;letter-spacing:.2px;padding:0 11px 0 9px}.winner svg{fill:currentColor;stroke:none;width:13px;height:13px}
      :host([data-winner]){background:#e9f8ef!important;border-radius:8px 8px 0 0}:host([data-winner]) .row{background:#e9f8ef}:host([data-winner][data-superchrome-theme=dark]),:host([data-winner][data-superchrome-theme=dark]) .row{background:#173a2a!important}:host([data-winner][data-superchrome-theme=dark]) .winner{color:#0d2a1b;background:#7fdca6}
      .reuse{color:var(--reuse-fg);background:var(--reuse-bg)}.low{color:var(--low-fg);background:var(--low-bg)}
      .audience{margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}
      .fact{height:28px;padding:0 9px;border:1px solid var(--chip-border);background:var(--chip-bg);color:var(--sc-text);overflow:hidden;text-overflow:ellipsis}
      .flags{font-size:15px;letter-spacing:1px;max-width:150px}.age svg{color:var(--sc-muted)}.gender{gap:2px;font-size:15px;font-weight:700}.gender .f{color:var(--f)}.gender .m{color:var(--m)}
      button{display:grid;place-items:center;flex:none;cursor:pointer;border:0;border-radius:50%;width:28px;height:28px;padding:0;color:var(--sc-muted);background:transparent;margin-left:auto}
      .audience:not([hidden])+button{margin-left:0}
      button svg{width:16px;height:16px;transition:transform .15s}button[aria-expanded=true] svg{transform:rotate(180deg)}
      button:hover{background:var(--sc-button);color:var(--sc-text)}button:focus-visible,.pill:focus-visible{outline:2px solid var(--sc-accent);outline-offset:2px}
      @media(max-width:600px){:host{padding:0 10px}.row{gap:6px;flex-wrap:wrap;padding:6px 0}.audience{gap:4px}}
      </style><div class="row"><span class="pill duration" tabindex="0"><svg class="ic i-new" viewBox="0 0 24 24"><path d="M12 21v-8m0 0C12 8 8.5 6 4 6c0 4.5 3 7 8 7zm0 0c0-3.5 3-6 8-6 0 4-3.5 6-8 6z"/></svg><svg class="ic i-warm" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"/></svg><svg class="ic i-hot" viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2.5-3C6 9 5 11.5 5 15c0 4.2 3 7 7 7z"/></svg><svg class="ic i-off" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 9v6m4-6v6"/></svg><span class="days"></span><span class="unit">days</span></span><span class="pill winner" hidden tabindex="0" title="Winner: still active, not low reach, and running 180+ days (or 90+ days with reused creative). A research signal, not proof of profit."><svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z"/></svg>Winner</span><span class="pill reuse" hidden tabindex="0"><svg viewBox="0 0 24 24" aria-label="Creative reused"><path d="M4 8h13l-3-3m6 11H7l3 3M4 8v5m16 3v-5"/></svg><span></span></span><span class="pill low" hidden tabindex="0" title="Low impressions: Meta reports fewer than 100 impressions"><svg viewBox="0 0 24 24" aria-label="Low impressions"><path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20 20 4"/></svg>Low reach</span><div class="audience" hidden><span class="pill fact flags" hidden></span><span class="pill fact age" hidden><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg><span></span></span><span class="pill fact gender" hidden><span class="f">♀</span><span class="m">♂</span></span></div><button aria-label="Expand ad details" aria-expanded="false" title="Show original Meta details"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div>`;
      const nodes=[];
      for(let node=button;node && node!==header;node=node.parentElement){nodes.push(node);for(let prev=node.previousElementSibling;prev;prev=prev.previousElementSibling)nodes.push(prev);if(node.parentElement===header)break;nodes.pop();}
      const hidden=[...new Set(nodes)].map(node=>[node,node.style.getPropertyValue('display'),node.style.getPropertyPriority('display')]);
      header.prepend(host);
      const r={id,header,host,root,hidden,facts:facts(text(header)),eu:/EU transparency/.test(text(header))}; records.set(header,r);
      const toggle=root.querySelector('button');
      toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Collapse ad details':'Expand ad details');for(const [node,value,priority]of hidden){if(open){if(value)node.style.setProperty('display',value,priority);else node.style.removeProperty('display');}else node.style.setProperty('display','none','important');}};
      hidden.forEach(([node])=>node.style.setProperty('display','none','important'));
    }
    for(const r of records.values()) render(r);
    applyView();
    loadAudience();
  }
  // Process new cards in the next animation frame, before the browser paints them, so rows and
  // filters never flash. Back-to-back scans are spaced out to keep busy pages responsive.
  function schedule(){
    if(pending)return;
    const raf=globalThis.requestAnimationFrame && !document.hidden ? globalThis.requestAnimationFrame : f=>setTimeout(f,16);
    const gap=performance.now()-lastScan;
    pending=gap>=80 ? (raf(scan),true) : setTimeout(()=>raf(scan),80-gap);
  }
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  chrome.storage.local.get({adLibraryEnabled:true,adLibraryFilterBar:true,adLibraryView:null,adLibrarySortOldest:false,[CACHE_KEY]:{},[MEMORY_KEY]:{}}).then(s=>{
    memory=s[MEMORY_KEY]&&typeof s[MEMORY_KEY]==='object'?s[MEMORY_KEY]:{};viewKey=currentViewKey();
    enabled=s.adLibraryEnabled!==false;filterBar=s.adLibraryFilterBar!==false;
    if(s.adLibraryView && typeof s.adLibraryView==='object')view={...view,...s.adLibraryView};else if(s.adLibrarySortOldest===true)view.sort='longest';
    if(!filterBar)view={sort:'meta',min:0,format:'all',active:false,winners:false};cache=s[CACHE_KEY]||{};
    for(const [id,entry]of Object.entries(cache))if(entry?.value && Date.now()-entry.at<TTL)audience.set(id,entry.value);
    ready=true;schedule();
  }).catch(()=>{ready=true;schedule();});
  chrome.storage.onChanged.addListener((c,area)=>{if(area!=='local')return;if(c.adLibraryEnabled)enabled=c.adLibraryEnabled.newValue!==false;if(c.adLibraryFilterBar){filterBar=c.adLibraryFilterBar.newValue!==false;if(!filterBar){view={sort:'meta',min:0,format:'all',active:false,winners:false};chrome.storage.local.set({adLibraryView:view}).catch(()=>{});}}if(c.adLibraryEnabled||c.adLibraryFilterBar)schedule();});
  setInterval(schedule,3000);
})();
