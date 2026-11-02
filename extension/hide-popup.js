(() => {
 const status=document.querySelector('#hide-status'),list=document.querySelector('#hidden-list'),pick=document.querySelector('#pick-element'),restore=document.querySelector('#restore-hidden');
 let tab,key,socialAway=false,siteName='Instagram';
 async function render(){
  const data=await chrome.storage.local.get(key),rules=data[key]||[];list.replaceChildren();restore.disabled=!rules.length;
  status.textContent=rules.length?`${rules.length} hidden element${rules.length===1?'':'s'} on ${new URL(tab.url).hostname}.`:'';
  if(socialAway)status.textContent+=`Open ${siteName} Home to pick elements.`;
  for(const rule of rules){const row=document.createElement('li'),label=document.createElement('span'),button=document.createElement('button');label.textContent=rule.label;label.title=rule.selector;button.textContent='Restore';button.addEventListener('click',async()=>{try{const data=await chrome.storage.local.get(key);await chrome.storage.local.set({[key]:(data[key]||[]).filter(r=>r.id!==rule.id)});await render();}catch(e){status.textContent=e.message;}});row.append(label,button);list.append(row);}
 }
 (async()=>{[tab]=await chrome.tabs.query({active:true,currentWindow:true});let url;try{url=new URL(tab?.url);}catch{throw Error('Open a website to pick elements.');}if(!/^https?:$/.test(url.protocol))throw Error('Open a website to hide elements.');key=`hidden:${url.hostname}`;const isX=['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname);siteName=isX?'X':'Instagram';socialAway=isX?!['/','/home','/home/'].includes(url.pathname):['instagram.com','www.instagram.com'].includes(url.hostname)&&url.pathname!=='/';pick.disabled=socialAway;await render();})().catch(e=>{status.textContent=e.message;});
 pick.onclick=async()=>{try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['theme.js','hide-elements.js']});const response=await chrome.tabs.sendMessage(tab.id,{type:'hide:pick'},{frameId:0});if(!response?.ok)throw Error(response?.error||'Could not start picker.');window.close();}catch(e){status.textContent='Cannot select elements on this page. Reload it and try again. '+e.message;}};
 restore.onclick=async()=>{try{await chrome.storage.local.set({[key]:[]});await render();}catch(e){status.textContent=e.message;}};
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&key&&changes[key])render().catch(()=>{});});
})();
