(() => {
const root=document.querySelector('#download-panel'); const find=id=>root.querySelector('#'+id);
const input=root.querySelector('#url'),status=root.querySelector('#download-status');
chrome.tabs.query({active:true,currentWindow:true},tabs=>{input.value=tabs[0]?.url||''});
async function refresh(){const {job}=await chrome.storage.local.get('job');status.textContent=job?.message||'Ready. Downloads continue if you close this popup.';}
chrome.runtime.sendMessage({action:'ping'},r=>{if(chrome.runtime.lastError)status.textContent=chrome.runtime.lastError.message;else if(!r?.ok)status.textContent=r?.error||'Helper unavailable';else refresh()});
chrome.storage.onChanged.addListener(refresh);
root.querySelector('#download').onclick=()=>{chrome.runtime.sendMessage({action:'download',url:input.value},r=>{status.textContent=chrome.runtime.lastError?.message||r?.error||'Download started…'});};

})();
