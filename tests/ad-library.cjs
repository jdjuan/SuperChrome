const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM(`<body style="background:white"><article><div id="header"><div>Active Library ID: 123 Started running on Jan 1, 2026 </div><div>4 ads use this creative and text</div><button>See ad details</button></div><p>Sponsored creative stays visible</p></article><article><div id="low"><div>Active Library ID: 456 Started running on Jan 1, 2026 Low impression count Impressions: &lt;100</div><button>See ad details</button></div><p>Sponsored</p></article></body>`,{url:'https://www.facebook.com/ads/library/',runScripts:'outside-only'});
const w=dom.window;let changed;w.matchMedia=()=>({matches:true});w.chrome={runtime:{sendMessage:async()=>({authorized:false})},storage:{local:{get:async x=>x,set:async()=>{}},onChanged:{addListener:f=>changed=f}}};
for(const f of ['theme.js','ad-library.js'])w.eval(fs.readFileSync('extension/'+f,'utf8'));
await new Promise(r=>setTimeout(r,250));
const header=w.document.querySelector('#header'),host=header.firstElementChild,root=host.shadowRoot;
assert.ok(root);assert.equal(Number(root.querySelector('.days').textContent)>100,true);assert.equal(root.querySelector('.audience').hidden,true,'no dashes when audience is missing');assert.equal(header.lastElementChild.style.display,'none');assert.equal(host.dataset.superchromeTheme,'light');
const initialDays=Number(root.querySelector('.days').textContent),clock=w.Date.now;w.Date.now=()=>clock()+86400000;header.insertAdjacentHTML('beforeend','<i></i>');await new Promise(r=>setTimeout(r,220));assert.equal(Number(root.querySelector('.days').textContent),initialDays+1,'day count advances without fetching');w.Date.now=clock;
root.querySelector('button').click();assert.equal(header.lastElementChild.style.display,'');assert.equal(root.querySelector('button').getAttribute('aria-expanded'),'true');
assert.equal(w.document.querySelector('#low').firstElementChild.shadowRoot.querySelector('.low').hidden,false);assert.equal(root.querySelector('.reuse').hidden,false);assert.equal(root.querySelector('.reuse span').textContent,'×4');
w.document.body.insertAdjacentHTML('beforeend',`<div role="dialog">Library ID: 123 <div>EU ad audience <table aria-label="Targeting table"><tr><td>Spain</td><td>Country</td><td>Included</td></tr><tr><td>France</td><td>Country</td><td>Excluded</td></tr></table>Age 20-65+ years old Gender All Advertisers can choose EU ad delivery</div></div>`);
await new Promise(r=>setTimeout(r,250));const fields=[...root.querySelectorAll('.fact')].map(x=>x.textContent);assert.deepEqual(fields,['🇪🇸','20–65+','♀♂']);assert.equal(root.querySelector('.audience').hidden,false);
for(const darkOS of [false,true])for(const darkSite of [false,true]){w.matchMedia=()=>({matches:darkOS});w.document.body.style.background=darkSite?'rgb(18,18,18)':'white';w.SuperChromeTheme.apply(host);assert.equal(host.dataset.superchromeTheme,darkSite?'dark':'light');}
changed({adLibraryEnabled:{newValue:false}},'local');await new Promise(r=>setTimeout(r,250));assert.equal(w.document.querySelector('[data-superchrome="ad-library"]'),null);assert.equal(header.lastElementChild.style.display,'');
dom.window.close();console.log('PASS: days running/reuse, low impression cue, collapse/restore, scoped audience, excluded countries, missing data, theme mismatches and toggle.');
})();

(async()=>{
 const source=fs.readFileSync('extension/ad-library.js','utf8');
 async function page(entry){
  const d=new JSDOM('<body><article><div><span>Active Library ID: 789 Started running on Nov 13, 2026 EU transparency</span><button>See ad details</button></div><p>Sponsored</p></article></body>',{url:'https://www.facebook.com/ads/library/',runScripts:'outside-only'});
  const w=d.window;let saves=[],lookups=[],resolveLookup;w.chrome={runtime:{sendMessage:msg=>{if(msg.action==='adAudienceWorker')return Promise.resolve({authorized:false});lookups.push(msg);return new Promise(resolve=>resolveLookup=resolve);}},storage:{local:{get:async defaults=>({...defaults,adLibraryAudienceV2:entry||{}}),set:async x=>saves.push(x)},onChanged:{addListener(){}}}};w.eval(fs.readFileSync('extension/theme.js','utf8'));w.eval(source);await new Promise(r=>setTimeout(r,220));return {d,w,saves,lookups,resolve:value=>resolveLookup(value),root:w.document.querySelector('[data-superchrome]').shadowRoot};
 }
 const a={flags:[{name:'Spain',flag:'🇪🇸'}],age:'20-65+',gender:'All'};
 let p=await page({'789':{at:Date.now()-20*86400000,value:a}});assert.equal(p.root.querySelector('.fact').textContent,'🇪🇸');assert.equal(p.lookups.length,0,'fresh cache needs no network');p.d.window.close();
 p=await page({'789':{at:Date.now()-22*86400000,value:a}});assert.equal(p.lookups.length,1,'stale audience refreshes automatically');assert.equal(p.lookups[0].id,'789');
 p.resolve({value:a});await new Promise(r=>setTimeout(r,500));assert.equal(p.root.querySelector('.fact').textContent,'🇪🇸');assert.ok(p.saves.length,'audience persisted');p.d.window.close();
 console.log('PASS: 21-day audience cache, automatic stale refresh, background lookup and persisted results.');
})();

(async()=>{
 const card=(id,date)=>`<div class="card"><div><span>Active Library ID: ${id} ${date}</span><button>See ad details</button></div><p>Sponsored</p></div>`;
 const d=new JSDOM(`<body style="background:white"><div id="grid">${card(1,'Started running on Nov 1, 2026')}${card(2,'Started running on Jan 5, 2024')}${card(3,'Inactive Jul 11, 2024 - Feb 23, 2026')}<div id="other">group</div></div></body>`,{url:'https://www.facebook.com/ads/library/',runScripts:'outside-only'});
 const w=d.window;let store={},changed;w.matchMedia=()=>({matches:false});
 w.chrome={runtime:{sendMessage:async()=>({authorized:false})},storage:{local:{get:async x=>({...x,...store}),set:async x=>{Object.assign(store,x);}},onChanged:{addListener:f=>changed=f}}};
 for(const f of ['theme.js','ad-library.js'])w.eval(fs.readFileSync('extension/'+f,'utf8'));
 await new Promise(r=>setTimeout(r,250));
 const cards=[...w.document.querySelectorAll('.card')],host=w.document.querySelector('[data-superchrome="ad-library-sort"]');
 assert.ok(host,'oldest first button shown');assert.equal(cards[0].style.order,'','Meta order by default');
 const inactive=cards[2].querySelector('[data-superchrome]').shadowRoot;
 assert.equal(inactive.querySelector('.days').textContent,'592','inactive range uses start to end dates');
 host.shadowRoot.querySelector('button').click();
 assert.deepEqual(cards.map(c=>c.style.order),['2','0','1']);assert.equal(w.document.querySelector('#other').style.order,'100000');
 assert.equal(store.adLibrarySortOldest,true);assert.equal(host.shadowRoot.querySelector('button').getAttribute('aria-pressed'),'true');
 assert.equal(w.document.querySelector('#grid').children[0],cards[0],'DOM nodes are never moved');
 host.shadowRoot.querySelector('button').click();assert.deepEqual(cards.map(c=>c.style.order),['','','']);
 changed({adLibrarySortButton:{newValue:false}},'local');await new Promise(r=>setTimeout(r,250));
 assert.equal(w.document.querySelector('[data-superchrome="ad-library-sort"]'),null,'popup toggle hides button');
 d.window.close();console.log('PASS: oldest-first ordering without DOM moves, inactive run length, restore and popup toggle.');
})();
