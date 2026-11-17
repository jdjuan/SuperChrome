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
    count.textContent=days===null?'—':String(days);
    count.title=f.inactive?'Inactive ad. Start date is not a measure of active run time.':`${days??'Unknown'} days since Meta’s start date. Longer running is a research signal, not proof of profitability.`;
    r.root.querySelector('.unit').textContent=f.inactive?'inactive':'days';
    const reuse=r.root.querySelector('.reuse');reuse.hidden=f.reuse<=1;reuse.querySelector('span').textContent=f.reuse;
    reuse.title=`${f.reuse} ads use this creative and text`;
    r.root.querySelector('.low').hidden=!f.low;
    const fields=[
      [a?.flags?.map(x=>x.flag).join(' ') || '—',a?.flags?.length?'Targeted countries: '+a.flags.map(x=>x.name).join(', '):'Country targeting unavailable or loading automatically.'],
      [a?.age || '—','Targeted age range'+(a?.age?': '+a.age:': unavailable or loading')],
      [a?.gender ? (/All/.test(a.gender)?'♀ ♂':/Women|Female/.test(a.gender)?'♀':'♂'):'—','Targeted gender: '+(a?.gender||'not loaded')]
    ];
    r.root.querySelectorAll('.fact').forEach((node,i)=>{node.textContent=fields[i][0];node.title=fields[i][1];node.setAttribute('aria-label',fields[i][1]);});
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
      :host{display:block!important;padding:0 18px;margin:0 0 4px;font:13px/1.25 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--sc-text);background:var(--sc-surface)}
      *{box-sizing:border-box}[hidden]{display:none!important}
      .row{display:flex;align-items:center;gap:10px;min-height:62px;color:var(--sc-text);background:var(--sc-surface)}
      .duration{display:flex;align-items:baseline;gap:4px;white-space:nowrap}.days{font-size:30px;font-weight:750;letter-spacing:-1.2px;font-variant-numeric:tabular-nums}.unit{font-size:11px;color:var(--sc-muted)}
      .signals{display:flex;align-items:center;gap:7px}.signal{display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:650}.signal svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.reuse{color:#17683d}.low{color:#855500}:host([data-superchrome-theme=dark]) .reuse{color:#86dfad}:host([data-superchrome-theme=dark]) .low{color:#ffd17b}
      .audience{margin-left:auto;display:flex;align-items:center;gap:9px;min-width:0}.fact{white-space:nowrap;max-width:90px;overflow:hidden;text-overflow:ellipsis;color:var(--sc-muted);font-size:12px}.fact:first-child{font-size:17px;max-width:65px}.fact:last-child{font-size:16px}
      button{display:grid;place-items:center;flex:none;cursor:pointer;border:0;border-radius:50%;width:25px;height:25px;padding:0;color:var(--sc-muted);background:transparent;font:17px Arial}button:hover{background:var(--sc-button);color:var(--sc-text)}button:focus-visible,.days:focus-visible{outline:2px solid var(--sc-accent);outline-offset:3px}
      @media(max-width:600px){:host{padding:0 12px}.row{gap:7px}.audience{gap:6px}}
      </style><div class="row"><div class="duration"><span class="days" tabindex="0"></span><span class="unit">days</span></div><div class="signals"><span class="signal reuse" hidden tabindex="0"><svg viewBox="0 0 24 24" aria-label="Creative reused"><path d="M4 8h13l-3-3m6 11H7l3 3M4 8v5m16 3v-5"/></svg><span></span></span><span class="signal low" hidden tabindex="0" title="Low impressions: Meta reports fewer than 100 impressions"><svg viewBox="0 0 24 24" aria-label="Low impressions"><path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/><path d="M4 20 20 4"/></svg></span></div><div class="audience"><span class="fact"></span><span class="fact"></span><span class="fact"></span></div><button aria-label="Expand ad details" aria-expanded="false" title="Show original Meta details">⌄</button></div>`;
      const nodes=[];
      for(let node=button;node && node!==header;node=node.parentElement){nodes.push(node);for(let prev=node.previousElementSibling;prev;prev=prev.previousElementSibling)nodes.push(prev);if(node.parentElement===header)break;nodes.pop();}
      const hidden=[...new Set(nodes)].map(node=>[node,node.style.getPropertyValue('display'),node.style.getPropertyPriority('display')]);
      header.prepend(host);
      const r={id,header,host,root,hidden,facts:facts(text(header)),eu:/EU transparency/.test(text(header))}; records.set(header,r);
      const toggle=root.querySelector('button');
      toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Collapse ad details':'Expand ad details');toggle.textContent=open?'⌃':'⌄';for(const [node,value,priority]of hidden){if(open){if(value)node.style.setProperty('display',value,priority);else node.style.removeProperty('display');}else node.style.setProperty('display','none','important');}};
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
