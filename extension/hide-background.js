// Serialize saved rule changes across tabs so simultaneous picks cannot overwrite each other.
let hideQueue = Promise.resolve();
chrome.runtime.onMessage.addListener((message,sender,reply) => {
  if(message.type!=='hide:add')return;
  let url;try{url=new URL(sender.tab?.url);}catch{return;}
  if(!/^https?:$/.test(url.protocol)||sender.frameId!==0)return;
  if(typeof message.selector!=='string'||message.selector.length>4000){reply({ok:false,error:'This element is too complex to remember. Try selecting its parent.'});return;}
  const key=`hidden:${url.hostname}`;
  hideQueue=hideQueue.catch(()=>{}).then(async()=>{
    const data=await chrome.storage.local.get(key),rules=data[key]||[];
    if(!rules.some(rule=>rule.selector===message.selector)) {
      if(rules.length>=200)throw Error('This site has 200 hidden elements. Restore some before adding more.');
      rules.push({id:crypto.randomUUID(),selector:message.selector,label:String(message.label||'Element').slice(0,80)});
      await chrome.storage.local.set({[key]:rules});
    }
    reply({ok:true});
  }).catch(error=>reply({ok:false,error:error.message}));
  return true;
});
