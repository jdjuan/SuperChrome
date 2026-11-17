(() => {
  if (globalThis.__scAds) return;
  globalThis.__scAds = true;
  let enabled = true, pending;
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
    let score = days === null ? null : Math.round(80*(1-Math.exp(-days/30)) + Math.min(20,5*Math.log2(reuse)));
    if (low && score !== null) score=Math.min(10,score);
    if (inactive) score=null;
    return {days,reuse,low,score,inactive};
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
      audience.set(id,{flags,age,gender});
    }
  }
  function restore(r) {
    r.host.remove();
    for(const [node,value,priority] of r.hidden) { if(value) node.style.setProperty('display',value,priority); else node.style.removeProperty('display'); }
  }
  function render(r) {
    const f=r.facts, a=audience.get(r.id);
    const score=r.root.querySelector('.score');
    score.textContent=f.score===null?'—':`${f.score}/100`;
    score.dataset.level=f.score>=60?'high':f.score>=30?'medium':'low';
    score.title=`Research score, not profitability. ${f.days===null?'Start date unavailable':f.days+' days since start'}. Longevity: 80 × (1 − exp(−days/30)); reuse: up to 20 points (5 × log₂ count). ${f.reuse} ads share creative/text. ${f.low?'Low impressions: capped at 10. ':''}${f.inactive?'Inactive: unscored. ':''}No advertiser-relative bonus is applied.`;
    const fields=[
      [a?.flags?.map(x=>x.flag).join(' ') || '—',a?.flags?.length?'Targeted countries: '+a.flags.map(x=>x.name).join(', '):'Country targeting not loaded. Expand details and open Transparency by location.'],
      [a?.age || '—','Targeted age range'+(a?.age?': '+a.age:': unavailable until transparency details are loaded')],
      [a?.gender ? (/All/.test(a.gender)?'♀ ♂':/Women|Female/.test(a.gender)?'♀':'♂'):'—','Targeted gender: '+(a?.gender||'not loaded')]
    ];
    r.root.querySelectorAll('.fact').forEach((node,i)=>{node.textContent=fields[i][0];node.title=fields[i][1];node.setAttribute('aria-label',fields[i][1]);});
    SuperChromeTheme.apply(r.host);
  }
  function scan() {
    pending=null;
    if(!enabled || !location.pathname.startsWith('/ads/library')) {
      for(const r of records.values()) restore(r); records.clear(); return;
    }
    readAudience();
    for(const [header,r] of records) if(!header.isConnected) {restore(r);records.delete(header);}
    for(const button of document.querySelectorAll('[role=button],button')) {
      if(!/^(See ad details|See summary details)$/i.test(text(button)) || button.closest('[role=dialog]')) continue;
      if([...records.keys()].some(node=>node.contains(button))) continue;
      let header=button.parentElement;
      while(header && !idOf(header.textContent)) header=header.parentElement;
      if(!header || header===document.body || records.has(header)) continue;
      // Fail open if the candidate includes the creative or more than one ad.
      if((text(header).match(/Library ID:/g)||[]).length!==1) continue;
      const id=idOf(text(header)), host=document.createElement('div');
      host.dataset.superchrome='ad-library';
      const root=host.attachShadow({mode:'open'});
      root.innerHTML=`<style>:host{display:block!important;margin:0 0 8px;font:14px/1.3 Arial,sans-serif;color:var(--sc-text);background:var(--sc-surface)}.row{display:flex;align-items:center;gap:12px;padding:8px 0;min-height:32px;color:var(--sc-text);background:var(--sc-surface)}.score{font-size:18px;font-weight:700;border-radius:8px;padding:5px 8px;background:#fff0d4;color:#563600}.score[data-level=high]{background:#ddf4e7;color:#13512f}.score[data-level=medium]{background:#e3ebff;color:#203f89}.fact{white-space:nowrap;max-width:100px;overflow:hidden;text-overflow:ellipsis}button{margin-left:auto;cursor:pointer;border:0;border-radius:6px;font:20px Arial;padding:4px 8px;color:var(--sc-text);background:var(--sc-button)}button:focus-visible{outline:2px solid var(--sc-accent)}</style><div class="row"><span class="score" tabindex="0"></span><span class="fact"></span><span class="fact"></span><span class="fact"></span><button aria-label="Expand ad details" aria-expanded="false" title="Show original Meta details">⌄</button></div>`;
      const nodes=[];
      for(let node=button;node && node!==header;node=node.parentElement){nodes.push(node);for(let prev=node.previousElementSibling;prev;prev=prev.previousElementSibling)nodes.push(prev);if(node.parentElement===header)break;nodes.pop();}
      const hidden=[...new Set(nodes)].map(node=>[node,node.style.getPropertyValue('display'),node.style.getPropertyPriority('display')]);
      header.prepend(host);
      const r={id,header,host,root,hidden,facts:facts(text(header))}; records.set(header,r);
      const toggle=root.querySelector('button');
      toggle.onclick=()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Collapse ad details':'Expand ad details');toggle.textContent=open?'⌃':'⌄';for(const [node,value,priority]of hidden){if(open){if(value)node.style.setProperty('display',value,priority);else node.style.removeProperty('display');}else node.style.setProperty('display','none','important');}};
      hidden.forEach(([node])=>node.style.setProperty('display','none','important'));
    }
    for(const r of records.values()) render(r);
  }
  function schedule(){if(!pending)pending=setTimeout(scan,150);}
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  chrome.storage.local.get({adLibraryEnabled:true}).then(s=>{enabled=s.adLibraryEnabled!==false;schedule();});
  chrome.storage.onChanged.addListener((c,area)=>{if(area==='local'&&c.adLibraryEnabled){enabled=c.adLibraryEnabled.newValue!==false;schedule();}});
  setInterval(schedule,3000);
})();
