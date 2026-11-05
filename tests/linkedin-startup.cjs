const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(`extension/${f}`,'utf8'),tick=()=>new Promise(r=>setImmediate(r));
const ready='data-superchrome-linkedin-visibility-ready';
function setup(path='/') {
 const d=new JSDOM('<html><head></head><body><header>Navigation</header><main><button>Composer</button><article class="feed-shared-update-v2">Legacy post</article><div data-testid="mainFeed"><div componentkey="update-card-focusNEW">Modern post</div></div><div role="dialog"><article class="feed-shared-update-v2">Preview</article></div></main><div id="interop-outlet"></div></body></html>',{url:`https://www.linkedin.com${path}`,runScripts:'outside-only'}),w=d.window;
 const css=w.document.createElement('style');css.textContent=read('linkedin-startup.css');w.document.head.append(css);
 let resolve,reject,interval,change;
 w.setInterval=fn=>interval=fn;
 w.chrome={storage:{local:{get:()=>new Promise((yes,no)=>{resolve=yes;reject=no;})},onChanged:{addListener:fn=>change=fn}}};
 w.eval(read('guard.js'));
 const post=w.document.querySelector('main > article'),host=w.document.querySelector('#interop-outlet');
 assert.equal(w.getComputedStyle(post).display,'none','Manifest CSS hides the first post before JS');
 w.eval(read('linkedin-focus.js'));
 return {d,w,post,host,poll:()=>interval(),resolve:s=>resolve(s),reject:()=>reject(Error('Storage unavailable')),change:c=>change(c,'local')};
}
(async()=>{
 for(const path of ['/','/feed/']) {
  const x=setup(path),{w,post,host}=x;
  assert.equal(w.getComputedStyle(post).display,'none','Starting scripts must not expose posts at the root URL');
  assert.ok(!w.document.documentElement.hasAttribute(ready),'Settings unresolved: startup protection stays on');
  for(let i=0;i<3;i++) {x.poll();assert.equal(w.getComputedStyle(post).display,'none');}
  const shadow=host.attachShadow({mode:'open'});
  const shadowPost=w.document.createElement('article');shadowPost.className='feed-shared-update-v2';shadow.append(shadowPost);
  await tick();
  assert.equal(w.getComputedStyle(host).opacity,'0','Shadow host stays covered while settings are unresolved');
  assert.ok(host.hasAttribute('data-superchrome-linkedin-shadow-focus'));
  assert.ok(shadow.querySelector('[data-superchrome="linkedin-shadow-focus"]'));
  x.resolve({linkedinFocus:true,linkedinRevealUntil:0});await tick();
  assert.ok(w.document.documentElement.hasAttribute(ready),'Settings plus installed rules resolve visibility');
  assert.equal(w.getComputedStyle(post).display,'none');
  assert.equal(w.getComputedStyle(w.document.querySelector('[componentkey]')).display,'none');
  assert.notEqual(w.getComputedStyle(host).opacity,'0','Protected shadow host can be shown');
  // Exact recorded sequence: / paints posts before history changes to /feed/.
  w.history.replaceState({},'','/feed/');
  assert.equal(w.getComputedStyle(post).display,'none','URL handoff has no gap even before observers or polling run');
  x.poll();assert.equal(w.getComputedStyle(post).display,'none');
  for(const selector of ['header','main > button','[role=dialog] article'])assert.notEqual(w.getComputedStyle(w.document.querySelector(selector)).display,'none',selector);
  w.history.replaceState({},'','/notifications/');w.dispatchEvent(new w.Event('popstate'));
  assert.notEqual(w.getComputedStyle(post).display,'none','Known non-feed routes restore content');
  assert.ok(!host.hasAttribute('data-superchrome-linkedin-shadow-focus'));
  w.history.replaceState({},'','/');w.dispatchEvent(new w.Event('popstate'));
  assert.equal(w.getComputedStyle(post).display,'none','Returning to root remains protected');
  await tick();w.close();
 }
 for(const settings of [{linkedinFocus:false,linkedinRevealUntil:0},{linkedinFocus:true,linkedinRevealUntil:Date.now()+60000}]) {
  const x=setup();x.resolve(settings);await tick();
  assert.ok(x.w.document.documentElement.hasAttribute(ready));
  assert.notEqual(x.w.getComputedStyle(x.post).display,'none','Disabled focus and saved breaks release startup protection');
  if(settings.linkedinFocus)assert.ok(x.w.document.querySelector('[data-superchrome="linkedin-timer"]'));
  x.w.history.replaceState({},'','/feed/');x.poll();assert.notEqual(x.w.getComputedStyle(x.post).display,'none');
  await tick();x.w.close();
 }
 const failure=setup();failure.reject();await tick();assert.ok(failure.w.document.documentElement.hasAttribute(ready));assert.equal(failure.w.getComputedStyle(failure.post).display,'none','Storage failure keeps safe defaults');failure.w.close();
 const race=setup();race.change({linkedinFocus:{newValue:false}});race.resolve({linkedinFocus:true,linkedinRevealUntil:0});await tick();assert.notEqual(race.w.getComputedStyle(race.post).display,'none','Late initial settings cannot undo a newer preference');race.w.close();
 for(const path of ['/notifications/','/messaging/','/in/example/','/feed/update/urn:li:activity:123/','/feed/?highlightedUpdateUrn=urn:li:activity:123']) {
  const x=setup(path);assert.ok(x.w.document.documentElement.hasAttribute(ready),'Known non-feed destinations do not wait for storage');assert.notEqual(x.w.getComputedStyle(x.post).display,'none',path);await tick();x.w.close();
 }
 // The legacy preload frame must inherit the root URL's pending-feed decision.
 const d=new JSDOM('<iframe src="/preload/"></iframe>',{url:'https://www.linkedin.com/',runScripts:'outside-only'}),w=d.window.document.querySelector('iframe').contentWindow;
 w.document.open();w.document.write('<html><body><main><article class="feed-shared-update-v2">Preload post</article></main></body></html>');w.document.close();
 w.setInterval=()=>{};w.chrome={storage:{local:{get:async defaults=>defaults},onChanged:{addListener:()=>{}}}};
 w.eval(read('linkedin-focus.js'));await tick();assert.equal(w.getComputedStyle(w.document.querySelector('article')).display,'none','Preload frame inherits / as Home');d.window.close();
 console.log('PASS: LinkedIn / cold start, deferred visibility readiness, legacy/modern/shadow/preload posts, / to /feed/ handoff, settings failure/race, saved breaks and non-feed routes.');
})().catch(error=>{console.error(error);process.exit(1)});
