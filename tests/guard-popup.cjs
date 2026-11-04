const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict'),tick=()=>new Promise(r=>setImmediate(r)),read=f=>fs.readFileSync('extension/'+f,'utf8');
async function setup(url='https://www.youtube.com/watch?v=1',initial={}){
 const d=new JSDOM(read('popup.html'),{runScripts:'outside-only'}),w=d.window;let settings={enabled:true,sites:{},...initial},listener,fail=false;
 w.chrome={tabs:{query:async()=>[{id:1,url,title:'A video - YouTube'}],reload:()=>{}},storage:{local:{get:async defaults=>({...defaults,...settings}),set:async data=>{if(fail)throw Error('offline');settings={...settings,...data};}},onChanged:{addListener:fn=>listener=fn}}};
 w.eval(read('policy.js'));w.eval(read('guard-popup.js'));await tick();
 return {d,w,get:()=>settings,fail:value=>fail=value,change:data=>listener(data,'local'),find:id=>w.document.getElementById(id)};
}
(async()=>{
 const x=await setup(),names=()=>x.find('guard-sites').textContent;
 assert.match(names(),/Cuevana/);assert.match(names(),/Cineb/);assert.equal(x.find('guard-count').textContent,'2');
 assert.equal(x.find('site').textContent,'Block popups on YouTube');x.find('site').click();await tick();assert.equal(x.get().sites['www.youtube.com'],true);assert.match(names(),/YouTube/);assert.equal(x.find('guard-count').textContent,'3');
 x.find('guard-sites').querySelector('[aria-label="Remove YouTube"]').click();await tick();assert.equal(x.get().sites['www.youtube.com'],false);assert.ok(!names().includes('YouTube'));
 x.find('guard-sites').querySelector('[aria-label="Remove Cuevana"]').click();await tick();assert.equal(x.w.guardPolicy.enabledFor('cuevana3.example',x.get()),false);assert.equal(x.w.guardPolicy.enabledFor('cineb.st',x.get()),true);
 x.find('enabled').click();await tick();assert.equal(x.get().enabled,false);assert.match(names(),/Cineb/);assert.match(x.find('guard-status').textContent,/paused/);
 x.fail(true);x.find('site').click();await tick();assert.equal(x.get().sites['www.youtube.com'],false);assert.match(x.find('guard-status').textContent,/Could not save/);assert.equal(x.find('site').disabled,false);
 x.change({sites:{newValue:{'example.org':true,'@cineb':false,'@cuevana':false}}});assert.equal(x.find('guard-count').textContent,'1');assert.match(names(),/example.org/);x.d.window.close();
 const defaultSite=await setup('https://cineb.st/');defaultSite.find('site').click();await tick();assert.equal(defaultSite.get().sites['@cineb'],false);assert.ok(!defaultSite.find('guard-sites').textContent.includes('Cineb'));
 defaultSite.find('site').click();await tick();assert.equal(defaultSite.w.guardPolicy.enabledFor('cineb.st',defaultSite.get()),true);assert.match(defaultSite.find('guard-sites').textContent,/Cineb/);defaultSite.d.window.close();
 const invalid=await setup('chrome://extensions');assert.equal(invalid.find('site').disabled,true);invalid.d.window.close();
 console.log('PASS: protected default families, named current-site add/remove, persistent family removal, global pause, storage sync, rollback and invalid tabs.');
})().catch(e=>{console.error(e);process.exit(1)});
