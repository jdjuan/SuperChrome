const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setImmediate(r));
const type='REACTIONS_BY_YOUR_NETWORK';
const url=t=>'/feed/?highlightedUpdateUrn=urn%3Ali%3Aactivity%3A123&highlightedUpdateType='+t;
const row=(id,t,text)=>`<div id="${id}"><div data-display-contents="true"><div><div><a tabindex="0" componentkey="actor" href="/in/someone/">Actor</a><p>${text}</p><button>More options</button><a tabindex="0" componentkey="${id}-link" href="${url(t)}"><div>${text}</div></a></div></div></div></div>`;
(async()=>{
 const html=`<html><body style="background:white"><header><a href="${url(type)}">Bell</a><b id="badge">7</b></header><main><div data-testid="lazy-column">${row('network',type,"Jeff reacted to Lars’s post: your post is great")}${row('reaction','REACTION','Someone reacted to your post')}${row('mention','MENTION','Someone mentioned you')}${row('unknown','UNKNOWN','An unfamiliar alert')}${row('comment','COMMENT','Someone commented on your post')}<div id="shared">${row('nested-network',type,'Network activity')}${row('nested-real','MENTION','Mention')}</div></div><div role="dialog">${row('modal',type,'Preview')}</div></main></body></html>`;
 const d=new JSDOM(html,{url:'https://www.linkedin.com/notifications/',runScripts:'outside-only'}),w=d.window;let change,interval,stored;
 w.setInterval=fn=>interval=fn;w.chrome={storage:{local:{get:async defaults=>defaults,set:async data=>{stored=data;change({linkedinNotifications:{newValue:data.linkedinNotifications}},'local');}},onChanged:{addListener:fn=>change=fn}}};
 w.eval(fs.readFileSync('extension/theme.js','utf8'));w.eval(fs.readFileSync('extension/linkedin-notifications.js','utf8'));await tick();
 const el=id=>w.document.getElementById(id),hidden=id=>el(id).hasAttribute('data-superchrome-linkedin-suggestion');
 assert.equal(hidden('network'),true);assert.equal(w.getComputedStyle(el('network')).display,'none');
 for(const id of ['reaction','mention','unknown','comment','shared','modal'])assert.equal(hidden(id),false,id);
 assert.equal(el('badge').textContent,'7','never fabricate an unread count');
 let summary=w.document.querySelector('[data-superchrome=linkedin-notifications-summary]');assert.match(summary.shadowRoot.textContent,/1 suggested notification hidden/);assert.equal(summary.style.getPropertyValue('--sc-text'),'#182238');
 for(const darkOS of [false,true])for(const darkSite of [false,true]){w.matchMedia=()=>({matches:darkOS});w.document.body.style.background=darkSite?'rgb(12,16,22)':'white';interval();assert.equal(summary.dataset.superchromeTheme,darkSite?'dark':'light');assert.equal(summary.style.getPropertyValue('--sc-text'),darkSite?'#eef3ff':'#182238');}
 w.document.body.style.background='white';interval();
 // Recycled notification changes to a real type. Attribute observation restores it.
 el('network').querySelector('a[href*=highlightedUpdateType]').href=url('MENTION');await tick();assert.equal(hidden('network'),false);assert.equal(summary.isConnected,false);
 el('network').querySelector('a[href*=highlightedUpdateType]').href=url(type);await tick();assert.equal(hidden('network'),true);
 // Newly inserted network alerts are classified without touching unrelated rows.
 const extra=w.document.createElement('div');extra.innerHTML=row('dynamic',type,'Network reaction');w.document.querySelector('[data-testid=lazy-column]').append(extra.firstChild);await tick();assert.equal(hidden('dynamic'),true);
 summary=w.document.querySelector('[data-superchrome=linkedin-notifications-summary]');assert.match(summary.shadowRoot.textContent,/2 suggested notifications hidden/);
 w.history.pushState({},'','/feed/');interval();assert.equal(hidden('network'),false);assert.equal(summary.isConnected,false);
 w.history.pushState({},'','/notifications/');interval();assert.equal(hidden('network'),true);
 summary.shadowRoot.querySelector('button').click();await tick();assert.equal(stored.linkedinNotifications,false);assert.equal(hidden('network'),false);
 change({linkedinNotifications:{newValue:true}},'local');assert.equal(hidden('network'),true);
 const popup=new JSDOM(fs.readFileSync('extension/popup.html','utf8'),{runScripts:'outside-only'});let saved;
 popup.window.chrome={storage:{local:{get:async defaults=>defaults,set:async data=>saved=data}}};popup.window.eval(fs.readFileSync('extension/linkedin-popup.js','utf8'));await tick();const toggle=popup.window.document.getElementById('linkedin-notifications');assert.equal(toggle.checked,true);toggle.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(saved)),{linkedinNotifications:false});

 // Old user-picked broad hiding rules must not blank a specifically opened post.
 const h=new JSDOM('<html><body><main><article class="saved">Post</article></main></body></html>',{url:'https://www.linkedin.com/feed/?highlightedUpdateUrn=urn%3Ali%3Aactivity%3A7523172505327591424',runScripts:'outside-only'}),hw=h.window;let routeTick;hw.setInterval=f=>routeTick=f;hw.chrome={storage:{local:{get:async()=>({'hidden:www.linkedin.com':[{selector:'.saved'}]})},onChanged:{addListener:()=>{}}},runtime:{onMessage:{addListener:()=>{}}}};
 hw.eval(fs.readFileSync('extension/hide-elements.js','utf8'));await tick();const rule=hw.document.querySelector('style').sheet.cssRules[0].selectorText;assert.equal(hw.document.querySelector('.saved').matches(rule),false);hw.history.pushState({},'','/feed/');routeTick();assert.equal(hw.document.querySelector('.saved').matches(rule),true);hw.history.pushState({},'','/feed/update/urn:li:activity:123/');routeTick();assert.equal(hw.document.querySelector('.saved').matches(rule),false);
 console.log('PASS: explicit network alerts hidden, real/unknown notifications preserved, safe row boundaries, dynamic/recycled rows, route/checkbox restoration, unchanged badge, highlighted posts bypass saved hides.');
})().catch(e=>{console.error(e);process.exit(1)});
