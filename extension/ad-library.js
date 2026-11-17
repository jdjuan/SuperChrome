(() => {
  if (globalThis.__scAds) return;
  globalThis.__scAds = true;
  let enabled = true, pending, ready=false, activeLookup=null, saveTimer;
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
    const date = s.match(/Started running on\s+([A-Za-z]+ \d{1,2}, \d{4})/i)?.[1];
    const start = Date.parse(date || '');
    const days = Number.isFinite(start) ? Math.max(0, Math.floor((Date.now()-start)/86400000)) : null;
    const reuse = Number(s.match(/(\d+) ads use this creative and text/i)?.[1] || 1);
    const low = /Low impression count|Impressions:\s*<\s*100/i.test(s);
    const inactive = /\bInactive\b/i.test(s);
    return {start,days,reuse,low,inactive};
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
  function render(r) {
    const f=r.facts, a=audience.get(r.id);
    const days=Number.isFinite(f.start)?Math.max(0,Math.floor((Date.now()-f.start)/DAY)):null;
    const count=r.root.querySelector('.days');
    count.textContent=days===null?'':String(days);
    count.title=f.inactive?'Inactive ad. Start date is not a measure of active run time.':`${days??'Unknown'} days since Meta’s start date. Longer running is a research signal, not proof of profitability.`;
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
  function scan() {
    pending=null;
    if(!identityReady)return;
    if(!enabled || !location.pathname.startsWith('/ads/library')) {
      stopLookup();for(const r of records.values()) restore(r); records.clear(); return;
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
    for(const button of document.querySelectorAll('[role=button],button')) {
      if(!/^(See ad details|See summary details)$/i.test(text(button)) || button.closest('[role=dialog]')) continue;
      if([...records.keys()].some(node=>node.contains(button))) continue;
      let header=button.parentElement;
      while(header && !idOf(header.textContent)) header=header.parentElement;
      if(!header || header===document.body || records.has(header)) continue;
      // Leave groups of ads untouched rather than collapsing unrelated content.
      if((text(header).match(/Library ID:/g)||[]).length!==1) continue;
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
      .reuse{color:var(--reuse-fg);background:var(--reuse-bg)}.low{color:var(--low-fg);background:var(--low-bg)}
      .audience{margin-left:auto;display:flex;align-items:center;gap:6px;min-width:0}
      .fact{height:28px;padding:0 9px;border:1px solid var(--chip-border);background:var(--chip-bg);color:var(--sc-text);overflow:hidden;text-overflow:ellipsis}
      .flags{font-size:15px;letter-spacing:1px;max-width:150px}.age svg{color:var(--sc-muted)}.gender{gap:2px;font-size:15px;font-weight:700}.gender .f{color:var(--f)}.gender .m{color:var(--m)}
      button{display:grid;place-items:center;flex:none;cursor:pointer;border:0;border-radius:50%;width:28px;height:28px;padding:0;color:var(--sc-muted);background:transparent;margin-left:auto}
      .audience:not([hidden])+button{margin-left:0}
      button svg{width:16px;height:16px;transition:transform .15s}button[aria-expanded=true] svg{transform:rotate(180deg)}
      button:hover{background:var(--sc-button);color:var(--sc-text)}button:focus-visible,.pill:focus-visible{outline:2px solid var(--sc-accent);outline-offset:2px}
      @media(max-width:600px){:host{padding:0 10px}.row{gap:6px;flex-wrap:wrap;padding:6px 0}.audience{gap:4px}}
      </style><div class="row"><span class="pill duration" tabindex="0"><svg class="ic i-new" viewBox="0 0 24 24"><path d="M12 21v-8m0 0C12 8 8.5 6 4 6c0 4.5 3 7 8 7zm0 0c0-3.5 3-6 8-6 0 4-3.5 6-8 6z"/></svg><svg class="ic i-warm" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8m0 0h-5m5 0v5"/></svg><svg class="ic i-hot" viewBox="0 0 24 24"><path d="M12 22c4 0 7-2.8 7-7 0-4.5-4-7-5-11-2 2-3 4-3 6-1-1-2-2-2.5-3C6 9 5 11.5 5 15c0 4.2 3 7 7 7z"/></svg><svg class="ic i-off" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M10 9v6m4-6v6"/></svg><span class="days"></span><span class="unit">days</span></span><span class="pill reuse" hidden tabindex="0"><svg viewBox="0 0 24 24" aria-label="Creative reused"><path d="M4 8h13l-3-3m6 11H7l3 3M4 8v5m16 3v-5"/></svg><span></span></span><span class="pill low" hidden tabindex="0" title="Low impressions: Meta reports fewer than 100 impressions"><svg viewBox="0 0 24 24" aria-label="Low impressions"><path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20 20 4"/></svg>Low reach</span><div class="audience" hidden><span class="pill fact flags" hidden></span><span class="pill fact age" hidden><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg><span></span></span><span class="pill fact gender" hidden><span class="f">♀</span><span class="m">♂</span></span></div><button aria-label="Expand ad details" aria-expanded="false" title="Show original Meta details"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></div>`;
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
    loadAudience();
  }
  function schedule(){if(!pending)pending=setTimeout(scan,150);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  chrome.storage.local.get({adLibraryEnabled:true,[CACHE_KEY]:{}}).then(s=>{
    enabled=s.adLibraryEnabled!==false;cache=s[CACHE_KEY]||{};
    for(const [id,entry]of Object.entries(cache))if(entry?.value && Date.now()-entry.at<TTL)audience.set(id,entry.value);
    ready=true;schedule();
  }).catch(()=>{ready=true;schedule();});
  chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c.adLibraryEnabled){enabled=c.adLibraryEnabled.newValue!==false;schedule();}});
  setInterval(schedule,3000);
})();
