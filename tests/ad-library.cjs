const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
const dom=new JSDOM(`<body style="background:white"><article><div id="header"><div>Active Library ID: 123 Started running on Jan 1, 2026 </div><div>4 ads use this creative and text</div><button>See ad details</button></div><p>Sponsored creative stays visible</p></article><article><div id="low"><div>Active Library ID: 456 Started running on Jan 1, 2026 Low impression count Impressions: &lt;100</div><button>See ad details</button></div><p>Sponsored</p></article></body>`,{url:'https://www.facebook.com/ads/library/',runScripts:'outside-only'});
const w=dom.window;let changed;w.matchMedia=()=>({matches:true});w.chrome={storage:{local:{get:async x=>x},onChanged:{addListener:f=>changed=f}}};
for(const f of ['theme.js','ad-library.js'])w.eval(fs.readFileSync('extension/'+f,'utf8'));
await new Promise(r=>setTimeout(r,250));
const header=w.document.querySelector('#header'),host=header.firstElementChild,root=host.shadowRoot;
assert.ok(root);assert.equal(root.querySelector('.score').textContent,'90/100');assert.equal(root.querySelector('.fact').textContent,'—');assert.equal(header.lastElementChild.style.display,'none');assert.equal(host.dataset.superchromeTheme,'light');
root.querySelector('button').click();assert.equal(header.lastElementChild.style.display,'');assert.equal(root.querySelector('button').getAttribute('aria-expanded'),'true');
assert.equal(w.document.querySelector('#low').firstElementChild.shadowRoot.querySelector('.score').textContent,'10/100');
w.document.body.insertAdjacentHTML('beforeend',`<div role="dialog">Library ID: 123 <div>EU ad audience <table aria-label="Targeting table"><tr><td>Spain</td><td>Country</td><td>Included</td></tr><tr><td>France</td><td>Country</td><td>Excluded</td></tr></table>Age 20-65+ years old Gender All Advertisers can choose EU ad delivery</div></div>`);
await new Promise(r=>setTimeout(r,250));const fields=[...root.querySelectorAll('.fact')].map(x=>x.textContent);assert.deepEqual(fields,['🇪🇸','20-65+','♀ ♂']);
for(const darkOS of [false,true])for(const darkSite of [false,true]){w.matchMedia=()=>({matches:darkOS});w.document.body.style.background=darkSite?'rgb(18,18,18)':'white';w.SuperChromeTheme.apply(host);assert.equal(host.dataset.superchromeTheme,darkSite?'dark':'light');}
changed({adLibraryEnabled:{newValue:false}},'local');await new Promise(r=>setTimeout(r,250));assert.equal(w.document.querySelector('[data-superchrome="ad-library"]'),null);assert.equal(header.lastElementChild.style.display,'');
dom.window.close();console.log('PASS: ad score/reuse, low impression cap, collapse/restore, scoped audience, excluded countries, missing data, theme mismatches and toggle.');
})();
