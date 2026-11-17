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
 const card=(id,text,media)=>`<div class="card"><div><span>Library ID: ${id} ${text}</span><button>See ad details</button></div><img src="a.jpg">${media||'<img src="b.jpg">'}</div>`;
 const d=new JSDOM(`<body style="background:white"><div>~4,000 results</div><div id="wrap"><div id="grid">${card(1,'Active Started running on Nov 1, 2026')}${card(2,'Active Started running on Jan 5, 2024','<video></video>')}${card(3,'Inactive Jul 11, 2024 - Feb 23, 2026','<img src="b.jpg"><img src="c.jpg">')}${card(4,'Active Started running on Jun 1, 2026 2 ads use this creative and text')}<div id="other">group</div></div></div></body>`,{url:'https://www.facebook.com/ads/library/',runScripts:'outside-only'});
 const w=d.window;let store={adLibrarySortOldest:true},changed;w.matchMedia=()=>({matches:false});
 w.chrome={runtime:{sendMessage:async()=>({authorized:false})},storage:{local:{get:async x=>({...x,...store}),set:async x=>{Object.assign(store,x);}},onChanged:{addListener:f=>changed=f}}};
 for(const f of ['theme.js','ad-library.js'])w.eval(fs.readFileSync('extension/'+f,'utf8'));
 await new Promise(r=>setTimeout(r,250));
 const cards=[...w.document.querySelectorAll('.card')],bar=w.document.querySelector('[data-superchrome="ad-library-bar"]'),$=s=>bar.shadowRoot.querySelector(s);
 const set=async(k,v)=>{const el=$(`[data-k=${k}]`);if(el.type==='checkbox')el.checked=v;else el.value=v;el.dispatchEvent(new w.Event('change'));await new Promise(r=>setTimeout(r,20));};
 const shown=()=>cards.filter(c=>c.style.display!=='none').map(c=>c.querySelector('span').textContent.match(/ID: (\d)/)[1]).join('');
 assert.ok(bar,'filter bar shown');assert.equal(bar.nextElementSibling,w.document.querySelector('#grid'),'bar sits above results');
 assert.equal($('[data-k=sort]').value,'longest','old oldest-first choice migrates');
 assert.deepEqual(cards.map(c=>c.style.order),['3','0','1','2']);assert.equal(w.document.querySelector('#grid').children[0],cards[0],'DOM nodes are never moved');
 assert.equal(cards[2].querySelector('[data-superchrome]').shadowRoot.querySelector('.days').textContent,'592','inactive range uses start to end dates');
 assert.ok(cards[1].hasAttribute('data-sc-winner'),'1000+ day active ad is a winner');assert.ok(!cards[0].hasAttribute('data-sc-winner'));assert.ok(!cards[2].hasAttribute('data-sc-winner'),'inactive ads are never winners');
 assert.equal(cards[1].querySelector('[data-superchrome]').shadowRoot.querySelector('.winner').hidden,false);
 assert.match($('.stats').textContent,/Showing 4 of 4 loaded ads \(~4,000 results\).*2 winners/);
 await set('sort','reuse');assert.equal(cards[3].style.order,'0','most reused first');
 await set('sort','longest');Object.defineProperty(w,'scrollY',{value:600,configurable:true});
 w.document.querySelector('#grid').insertAdjacentHTML('beforeend',card(5,'Active Started running on Jan 1, 2020'));await new Promise(r=>setTimeout(r,150));
 const late=w.document.querySelectorAll('.card')[4];assert.equal(late.style.order,'4','new card queues at the end while reading');
 assert.equal($('.fresh').hidden,false);assert.equal($('.fresh').textContent,'↻ Sort 1 new');
 $('.fresh').click();assert.equal(late.style.order,'0','sorting new cards places them');assert.equal($('.fresh').hidden,true);
 late.remove();Object.defineProperty(w,'scrollY',{value:0,configurable:true});await new Promise(r=>setTimeout(r,150));
 await set('format','video');assert.equal(shown(),'2');await set('format','carousel');assert.equal(shown(),'3');await set('format','image');assert.equal(shown(),'14');await set('format','all');
 await set('min','180');assert.equal(shown(),'23');await set('active',true);assert.equal(shown(),'2');assert.equal(w.document.querySelector('#other').style.display,'none');
 await set('active',false);await set('min','0');await set('winners',true);assert.equal(shown(),'24');assert.equal(store.adLibraryView.winners,true);
 await set('winners',false);await set('sort','meta');assert.equal(shown(),'1234');assert.deepEqual(cards.map(c=>c.style.order),['','','','']);assert.equal(w.document.querySelector('#other').style.display,'');
 await set('min','30');changed({adLibraryFilterBar:{newValue:false}},'local');await new Promise(r=>setTimeout(r,250));
 assert.equal(w.document.querySelector('[data-superchrome="ad-library-bar"]'),null,'popup toggle hides bar');assert.equal(shown(),'1234','turning the bar off resets filters');
 changed({adLibraryEnabled:{newValue:false}},'local');await new Promise(r=>setTimeout(r,250));assert.equal(w.document.querySelector('[data-sc-winner]'),null,'disabling removes highlights');
 d.window.close();console.log('PASS: filter bar sort/running/format/active/winners, winner highlight, stats, migration, restore and popup toggle.');
})();
