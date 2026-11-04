(() => {
  const root=document.querySelector('#guard-panel'),find=id=>root.querySelector('#'+id);
  const site=find('site'),master=find('enabled'),status=find('guard-status'),list=find('guard-sites');
  let tab,host='',settings={enabled:true,sites:{}},saving=false;
  const defaults=[['cuevana','Cuevana','All Cuevana domains'],['cineb','Cineb','cineb.st']];
  const siteName=value=>({'cineb.st':'Cineb','youtube.com':'YouTube','mail.google.com':'Gmail','linkedin.com':'LinkedIn','instagram.com':'Instagram','x.com':'X'}[value.replace(/^www\./,'')]||value.replace(/^www\./,''));
  function render(){
    master.checked=settings.enabled!==false;master.disabled=saving;
    site.disabled=!host||saving;site.textContent=host?(guardPolicy.siteEnabled(host,settings.sites)?'Stop blocking on ':'Block popups on ')+siteName(host):'Open a website to add it';
    find('host').textContent=host||'No website selected';
    list.replaceChildren();
    function row(title,detail,remove){
      const li=document.createElement('li'),text=document.createElement('div'),name=document.createElement('strong'),small=document.createElement('small'),button=document.createElement('button');
      name.textContent=title;small.textContent=detail;text.append(name,small);button.textContent='Remove';button.setAttribute('aria-label','Remove '+title);button.disabled=saving;button.onclick=()=>save(remove);li.append(text,button);list.append(li);
    }
    for(const [key,name,detail] of defaults)if(settings.sites['@'+key]!==false)row(name,detail+' · Included by default'+(Object.keys(settings.sites).some(h=>guardPolicy.family(h)===key&&settings.sites[h]===false)?' · Has site exceptions':''),sites=>{sites['@'+key]=false;for(const keyHost of Object.keys(sites))if(guardPolicy.family(keyHost)===key)sites[keyHost]=false;});
    for(const [value,on] of Object.entries(settings.sites))if(on===true&&!value.startsWith('@')&&!(guardPolicy.family(value)&&settings.sites['@'+guardPolicy.family(value)]!==false))row(siteName(value),value,sites=>{sites[value]=false;});
    find('guard-count').textContent=String(list.children.length);
    if(!list.children.length){const li=document.createElement('li');li.textContent='No websites added. Add the open website above.';list.append(li);}
    list.setAttribute('aria-description',master.checked?'Popup protection is active.':'Popup protection is paused for all listed websites.');
  }
  async function save(change){
    if(saving)return;saving=true;render();
    try{
      const latest=await chrome.storage.local.get({sites:{}}),sites={...latest.sites};change(sites);
      await chrome.storage.local.set({sites});settings.sites=sites;status.textContent='Website list updated.';
    }catch{status.textContent='Could not save. Try again.';}
    finally{saving=false;render();}
  }
  site.addEventListener('click',()=>save(sites=>{const on=guardPolicy.siteEnabled(host,sites);const family=guardPolicy.family(host);if(on&&family&&sites['@'+family]!==false){sites['@'+family]=false;for(const value of Object.keys(sites))if(guardPolicy.family(value)===family)sites[value]=false;}sites[host]=!on;}));
  master.addEventListener('change',async()=>{
    const value=master.checked;saving=true;render();
    try{await chrome.storage.local.set({enabled:value});settings.enabled=value;status.textContent=value?'Protection resumed.':'Protection paused for all websites.';}
    catch{status.textContent='Could not save. Try again.';}finally{saving=false;render();}
  });
  find('reload').onclick=()=>chrome.tabs.reload(tab.id);
  chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local')return;if(changes.sites)settings.sites=changes.sites.newValue||{};if(changes.enabled)settings.enabled=changes.enabled.newValue!==false;render();});
  (async()=>{[tab]=await chrome.tabs.query({active:true,currentWindow:true});host=guardPolicy.hostname(tab?.url);settings=await chrome.storage.local.get({enabled:true,sites:{}});find('reload').disabled=!host;render();})().catch(()=>{status.textContent='Could not read settings. Reopen SuperChrome to retry.';});
})();
