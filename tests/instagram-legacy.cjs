const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 for(const initialPath of ['/','/direct/inbox/']){
 const d=new JSDOM('<html><body><nav>Navigation</nav><main><div class="shared-layout">Content</div></main><aside role="dialog">Notifications</aside></body></html>',{url:`https://www.instagram.com${initialPath}`,runScripts:'outside-only'}),w=d.window;let interval,picker;
 w.setInterval=fn=>interval=fn;w.chrome={runtime:{onMessage:{addListener:fn=>picker=fn}},storage:{local:{get:async()=>({'hidden:www.instagram.com':[{id:'legacy',selector:'main, .shared-layout',label:'Old broad hide'}]})},onChanged:{addListener:()=>{}}}};
 w.eval(read('hide-elements.js'));await tick();const selector=w.document.querySelector('style').sheet.cssRules[0].selectorText;
 const hidden=()=>w.document.querySelectorAll(selector).length;
 assert.equal(hidden(),initialPath==='/'?2:0,'legacy rules must not blank the inbox on a fresh load');
 for(const route of ['/direct/inbox/','/direct/t/123/','/accounts/activity/','/jdjuan0/','/p/test/']){
 w.history.pushState({},'',route);w.document.body.append(w.document.createElement('div'));await tick();assert.equal(hidden(),0,route);
 }
 w.history.pushState({},'','/');interval();assert.equal(hidden(),2);
 w.history.pushState({},'','/direct/inbox/');w.dispatchEvent(new w.PopStateEvent('popstate'));assert.equal(hidden(),0);
 let response;picker({type:'hide:pick'},{},r=>response=r);assert.equal(response.ok,false);
 }
 const d=new JSDOM(read('popup.html'),{runScripts:'outside-only'});d.window.chrome={tabs:{query:async()=>[{url:'https://www.instagram.com/direct/inbox/'}]},storage:{local:{get:async()=>({})},onChanged:{addListener:()=>{}}}};d.window.eval(read('hide-popup.js'));await tick();assert.equal(d.window.document.querySelector('#pick-element').disabled,true);assert.match(d.window.document.querySelector('#hide-status').textContent,/Open Instagram Home/);
 console.log('PASS: legacy broad selectors cannot hide Instagram inbox, threads, activity, profiles or posts; Home and SPA navigation remain scoped.');
})().catch(e=>{console.error(e);process.exit(1)});
