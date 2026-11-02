const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=file=>fs.readFileSync(path.join(__dirname,'../extension',file),'utf8');const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const dom=new JSDOM('<html><body><nav><a href="/direct/inbox/">Messages</a><a href="#">Notifications</a></nav><main><div data-pagelet="story_tray">Stories</div><article>Feed post</article><aside>Suggestions</aside><div role="dialog"><article>Notification preview</article></div></main></body></html>',{url:'https://www.instagram.com/',runScripts:'outside-only'}),w=dom.window;let changed,interval;
 w.chrome={storage:{local:{get:async defaults=>defaults},onChanged:{addListener:fn=>changed=fn}}};w.setInterval=fn=>{interval=fn};w.eval(read('instagram-focus.js'));await tick();
 const on=()=>w.document.documentElement.hasAttribute('data-superchrome-instagram-focus');assert.equal(on(),true);
 const css=w.document.querySelector('style').textContent;const selector=css.split(' {')[0];assert.equal(w.document.querySelectorAll(selector).length,2);assert.equal(w.document.querySelector('nav').matches(selector),false);assert.equal(w.document.querySelector('[role=dialog] article').matches(selector),false);
 const post=w.document.createElement('article');w.document.querySelector('main').append(post);assert.equal(post.matches(selector),true);
 // SPA route changes restore messages, individual posts and profiles immediately
 // on DOM commit; history-only changes are caught by the route fallback.
 for(const route of ['/direct/inbox/','/p/test/','/jdjuan0/','/accounts/activity/']){w.history.pushState({},'',route);w.document.body.append(w.document.createElement('span'));await tick();assert.equal(on(),false,route);assert.equal(w.document.querySelectorAll(selector).length,0);}
 w.history.pushState({},'','/');interval();assert.equal(on(),true);
 changed({instagramFocus:{newValue:false}},'local');assert.equal(on(),false);changed({instagramFocus:{newValue:true}},'local');assert.equal(on(),true);
 w.history.pushState({},'','/direct/inbox/');w.dispatchEvent(new w.PopStateEvent('popstate'));assert.equal(on(),false);
 // Off remains off on future visits; unrelated sites never receive a style.
 for(const [url,value,expected] of [['https://www.instagram.com/',false,false],['https://example.com/',true,false]]){
 const d=new JSDOM('<html></html>',{url,runScripts:'outside-only'});d.window.chrome={storage:{local:{get:async()=>({instagramFocus:value})},onChanged:{addListener:()=>{}}}};d.window.setInterval=()=>{};d.window.eval(read('instagram-focus.js'));await tick();assert.equal(d.window.document.documentElement.hasAttribute('data-superchrome-instagram-focus'),expected);if(url.includes('example'))assert.equal(d.window.document.querySelector('style'),null);}
 // Popup toggles persist, and the control is only offered on Instagram.
 for(const host of ['www.instagram.com','example.com']){const d=new JSDOM(read('popup.html'),{url:'https://extension.test',runScripts:'outside-only'});let saved;d.window.chrome={tabs:{query:async()=>[{url:`https://${host}/direct/inbox/`}]},storage:{local:{get:async defaults=>defaults,set:async value=>saved=value}}};d.window.eval(read('instagram-popup.js'));await tick();const control=d.window.document.querySelector('#instagram-focus-controls');assert.equal(control.hidden,host==='example.com');if(host==='www.instagram.com'){const toggle=d.window.document.querySelector('#instagram-focus');toggle.checked=false;toggle.dispatchEvent(new d.window.Event('change'));await tick();assert.equal(saved.instagramFocus,false);}}
 // Match the observed Instagram Home structure: feed and sidebar share a shell.
 const layout=new JSDOM('<html><body><nav><a href="/direct/inbox/">Messages</a></nav><main><div id="home-shell"><div><div data-pagelet="story_tray">Stories</div><article>Post</article><div role="progressbar">Loading</div></div><aside><a href="/explore/people/">See all</a><span>Suggested for you</span><footer>Links</footer></aside></div><div role="dialog">Notifications</div></main></body></html>',{url:'https://www.instagram.com/',runScripts:'outside-only'}),lw=layout.window;let change;
 lw.setInterval=()=>{};lw.chrome={storage:{local:{get:async defaults=>defaults},onChanged:{addListener:fn=>change=fn}}};lw.eval(read('instagram-focus.js'));await tick();
 const shell=lw.document.querySelector('#home-shell'), main=lw.document.querySelector('main');
 assert.equal(shell.hasAttribute('data-superchrome-instagram-home-content'),true);
 assert.equal(lw.getComputedStyle(shell).display,'none');
 let message=main.querySelector('[data-superchrome="instagram-message"]');assert.ok(message);assert.equal(message.shadowRoot.querySelector('h1').textContent,'You’re all caught up.');assert.equal(message.shadowRoot.querySelector('p').textContent,'With absolutely nothing.');
 assert.equal(lw.document.querySelector('[role=dialog]').hasAttribute('data-superchrome-instagram-home-content'),false);assert.notEqual(lw.getComputedStyle(lw.document.querySelector('nav')).display,'none');
 // Toggling restores both columns; repeated reconciliation never duplicates copy.
 change({instagramFocus:{newValue:false}},'local');assert.equal(message.isConnected,false);assert.notEqual(lw.getComputedStyle(shell).display,'none');
 change({instagramFocus:{newValue:true}},'local');await tick();assert.equal(main.querySelectorAll('[data-superchrome="instagram-message"]').length,1);
 const replacement=shell.cloneNode(true);replacement.removeAttribute('data-superchrome-instagram-home-content');shell.replaceWith(replacement);await tick();assert.equal(replacement.hasAttribute('data-superchrome-instagram-home-content'),true);
 // A Home-shaped root containing a chat editor must never be marked for hiding.
 const chat=lw.document.createElement('div');chat.innerHTML='<article>Conversation</article><div contenteditable="true"></div>';main.append(chat);await tick();assert.equal(chat.hasAttribute('data-superchrome-instagram-home-content'),false);
 lw.history.pushState({},'','/direct/inbox/');lw.document.body.append(lw.document.createElement('span'));await tick();assert.equal(main.querySelector('[data-superchrome="instagram-message"]'),null);assert.equal(lw.document.documentElement.hasAttribute('data-superchrome-instagram-focus'),false);
 console.log('PASS: Instagram feed/stories targeting, navigation and dialog preservation, SPA routing, dynamic posts, saved toggle, hostname isolation.');
})().catch(error=>{console.error(error);process.exit(1)});
