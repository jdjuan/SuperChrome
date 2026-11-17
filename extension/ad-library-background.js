// One inactive tab at a time; Meta disallows framing its Ad Library.
(() => {
 const queue=[], waiting=new Map();let active=null;
 const validId=id=>typeof id==='string' && /^\d{5,30}$/.test(id);
 const allowed=sender=>{try{const u=new URL(sender.url||sender.tab?.url);return u.protocol==='https:' && ['www.facebook.com','facebook.com'].includes(u.hostname) && u.pathname.startsWith('/ads/library');}catch{return false;}};
 function finish(value){const task=active;if(!task)return;active=null;clearTimeout(task.timer);if(task.tabId!=null)chrome.tabs.remove(task.tabId).catch(()=>{});waiting.delete(task.id);task.replies.forEach(reply=>reply(value));next();}
 async function next(){if(active || !queue.length)return;const task=queue.shift();active=task;
  task.timer=setTimeout(()=>finish({error:'Audience lookup timed out'}),25000);
  try{const tab=await chrome.tabs.create({url:`https://www.facebook.com/ads/library/?id=${task.id}`,active:false});
   if(active!==task){chrome.tabs.remove(tab.id).catch(()=>{});return;}task.tabId=tab.id;
  }catch{finish({error:'Audience lookup unavailable'});}
 }
 chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!['adAudienceLookup','adAudienceWorker','adAudienceResult'].includes(message.action))return;
  if(message.action==='adAudienceWorker'){const authorized=allowed(sender)&&active?.tabId===sender.tab?.id;reply({authorized,id:authorized?active.id:null});return;}
  if(!allowed(sender)||!validId(message.id)){reply({error:'Invalid audience request'});return;}
  if(message.action==='adAudienceLookup'){
   if(active?.tabId===sender.tab?.id){reply({error:'Nested lookup'});return;}
   if(waiting.has(message.id))waiting.get(message.id).replies.push(reply);
   else{const task={id:message.id,replies:[reply]};waiting.set(message.id,task);queue.push(task);next();}return true;
  }
  const authorized=active?.id===message.id && active?.tabId===sender.tab?.id;
  if(authorized)finish({value:message.value});reply({ok:authorized});
 });
 chrome.tabs.onRemoved.addListener(id=>{if(active?.tabId===id)finish({error:'Audience lookup closed'});});
})();
