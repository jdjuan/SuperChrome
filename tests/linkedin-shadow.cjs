const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(`extension/${f}`,'utf8'),tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const d=new JSDOM('<html><head></head><body><main></main><div id="interop-outlet"></div></body></html>',{url:'https://www.linkedin.com/feed/',runScripts:'outside-only'}),w=d.window;
 const startup=w.document.createElement('style');startup.textContent=read('linkedin-startup.css');w.document.head.append(startup);
 let interval,changed;w.setInterval=fn=>interval=fn;w.chrome={storage:{local:{get:async defaults=>defaults},onChanged:{addListener:fn=>changed=fn}}};
 let host=w.document.querySelector('#interop-outlet');
 assert.equal(w.getComputedStyle(host).opacity,'0','startup CSS covers shadow host before scripts');
 w.eval(read('linkedin-focus.js'));await tick();
 assert.equal(w.getComputedStyle(host).opacity,'0','host stays covered when shadow root has not attached');
 w.eval(read('guard.js'));
 const root=host.attachShadow({mode:'open'});
 assert.ok(root.querySelector('[data-superchrome="linkedin-shadow-focus"]'),'shadow styles installed synchronously at attachment');
 root.innerHTML='<main><div class="scaffold-finite-scroll"><article class="feed-shared-update-v2">Startup post</article></div><button>Start a post</button><div role="dialog"><article class="feed-shared-update-v2">Preview</article></div></main><div class="msg-overlay-container"><button>Messages</button></div>';
 // Page replacement removes our sheet; the shadow observer repairs it before paint.
 interval();await tick();
 const sheet=root.querySelector('[data-superchrome="linkedin-shadow-focus"]');assert.ok(sheet);
 assert.ok(host.hasAttribute('data-superchrome-linkedin-shadow-ready'));assert.ok(host.hasAttribute('data-superchrome-linkedin-shadow-focus'));
 assert.notEqual(w.getComputedStyle(host).opacity,'0','host returns only after scoped stylesheet is installed');
 const selector=sheet.textContent.slice(sheet.textContent.indexOf(' :is(')+1).split(' {')[0];
 assert.ok(root.querySelector('article').matches(selector));
 assert.equal(root.querySelector('[role=dialog] article').matches(selector),false);
 assert.equal(root.querySelector('.msg-overlay-container').matches(selector),false);
 assert.equal(root.querySelector('button').matches(selector),false);
 sheet.remove();await tick();assert.ok(sheet.isConnected,'removed shadow stylesheet restored before next paint');
 const fresh=w.document.createElement('article');fresh.className='feed-shared-update-v2';root.querySelector('main').append(fresh);await tick();assert.ok(fresh.matches(selector));
 changed({linkedinRevealUntil:{newValue:Date.now()+60000}},'local');assert.equal(host.hasAttribute('data-superchrome-linkedin-shadow-focus'),false,'timed breaks restore shadow posts');
 changed({linkedinRevealUntil:{newValue:0}},'local');assert.ok(host.hasAttribute('data-superchrome-linkedin-shadow-focus'));
 changed({linkedinFocus:{newValue:false}},'local');assert.equal(host.hasAttribute('data-superchrome-linkedin-shadow-focus'),false);
 changed({linkedinFocus:{newValue:true}},'local');
 for(const route of ['/notifications/','/messaging/','/feed/update/urn:li:activity:123/','/feed/?highlightedUpdateUrn=urn:li:activity:123']){
  w.history.replaceState({},'',route);interval();assert.equal(host.hasAttribute('data-superchrome-linkedin-shadow-focus'),false,route);
 }
 w.history.replaceState({},'','/feed/');interval();assert.ok(host.hasAttribute('data-superchrome-linkedin-shadow-focus'));
 host.remove();const replacement=w.document.createElement('div');replacement.id='interop-outlet';w.document.body.append(replacement);await tick();assert.equal(w.getComputedStyle(replacement).opacity,'0','replacement host is covered');
 replacement.attachShadow({mode:'open'}).innerHTML='<article class="feed-shared-update-v2">New root</article>';interval();await tick();assert.ok(replacement.shadowRoot.querySelector('style'));assert.ok(replacement.hasAttribute('data-superchrome-linkedin-shadow-focus'));
 console.log('PASS: cold-start shadow host gate, late attachment, scoped post rules, modal/chat/composer preservation, removed style repair, breaks, settings, routes and replacement hosts.');
})().catch(e=>{console.error(e);process.exit(1)});
