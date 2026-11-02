const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 let now=1000000;const state={instagramFocus:true,instagramRevealUntil:0},listeners=[];
 function page(){const dom=new JSDOM('<html><body><nav>Messages / Notifications</nav><main><div id="layout"><div data-pagelet="story_tray">Stories</div><article>Feed</article><a href="/explore/people/">Suggestions</a></div></main></body></html>',{url:'https://www.instagram.com/',runScripts:'outside-only'}),w=dom.window;let interval;
 w.Date.now=()=>now;w.setInterval=f=>interval=f;w.chrome={storage:{local:{get:async defaults=>typeof defaults==='object'?{...defaults,...state}:{[defaults]:[{selector:'main',label:'Legacy hide'}]},set:async value=>{const changes={};for(const [k,v]of Object.entries(value)){state[k]=v;changes[k]={newValue:v};}listeners.forEach(f=>f(changes,'local'));}},onChanged:{addListener:f=>listeners.push(f)}},runtime:{onMessage:{addListener:()=>{}}}};
 w.eval(read('hide-elements.js'));w.eval(read('instagram-focus.js'));return{w,advance:()=>interval(),message:()=>w.document.querySelector('[data-superchrome="instagram-message"]'),timer:()=>w.document.querySelector('[data-superchrome="instagram-timer"]'),active:()=>w.document.documentElement.hasAttribute('data-superchrome-instagram-focus')};}
 for(const minutes of [1,3,5]){
 state.instagramRevealUntil=0;const p=page();await tick();assert.equal(p.active(),true);p.message().shadowRoot.querySelector(`[data-minutes="${minutes}"]`).click();await tick();assert.equal(state.instagramRevealUntil,now+minutes*60000);assert.equal(p.active(),false);assert.equal(p.message(),null);assert.equal(p.timer().shadowRoot.querySelector('[role=timer]').textContent,`${minutes}:00 left`);
 // Saved legacy selectors must not keep content hidden during the allowance.
 const legacy=p.w.document.querySelector('style[data-superchrome="hidden-elements"]').sheet.cssRules[0].selectorText;assert.equal(p.w.document.querySelectorAll(legacy).length,0);
 const refreshed=page();await tick();assert.equal(refreshed.active(),false);assert.ok(refreshed.timer());
 now+=minutes*60000-1;p.advance();assert.equal(p.active(),false);now+=1;p.advance();refreshed.advance();await tick();assert.equal(p.active(),true);assert.equal(refreshed.active(),true);assert.equal(p.timer(),null);assert.equal(p.message().shadowRoot.querySelector('h1').textContent,'Time’s up. Instagram will survive.');
 }
 // One tab starting an allowance updates other tabs; Hide now ends it everywhere.
 const a=page(),b=page();await tick();a.message().shadowRoot.querySelector('[data-minutes="3"]').click();await tick();assert.ok(a.timer());assert.ok(b.timer());b.timer().shadowRoot.querySelector('button').click();await tick();assert.equal(a.active(),true);assert.equal(b.active(),true);
 // Away from Home, no overlay or timer affects direct messages. The allowance
 // still expires by wall clock while the page is backgrounded.
 a.message().shadowRoot.querySelector('[data-minutes="1"]').click();await tick();a.w.history.pushState({},'','/direct/inbox/');a.w.document.body.append(a.w.document.createElement('span'));await tick();assert.equal(a.active(),false);assert.equal(a.timer(),null);assert.equal(a.message(),null);now+=61000;a.w.history.pushState({},'','/');a.w.document.dispatchEvent(new a.w.Event('visibilitychange'));await tick();assert.equal(a.active(),true);
 // A failed save must leave content hidden and expose a useful error.
 a.w.chrome.storage.local.set=async()=>{throw Error('storage unavailable')};a.message().shadowRoot.querySelector('[data-minutes="5"]').click();await tick();assert.equal(a.active(),true);assert.match(a.message().shadowRoot.querySelector('[role=status]').textContent,/Could not start/);
 console.log('PASS: 1/3/5-minute allowances, countdown, refresh persistence, cross-tab updates, legacy rule suspension, exact expiry, Hide now, messages routing, save failure.');
})().catch(e=>{console.error(e);process.exit(1)});
