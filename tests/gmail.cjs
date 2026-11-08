const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,120));
const fixture=`<html><body style="background-color:rgb(248,250,253);color:rgb(32,33,36)"><main><div id="surface" style="background-color:white;color:black">Inbox</div><div class="zA zE">Unread</div><div class="a3s"><table bgcolor="white"><tr><td style="color:black;background-color:white"><a href="https://example.test">Link</a><img src="logo.png" style="background-color:white"><svg><path fill="black"></path></svg></td></tr></table></div><div contenteditable="true" role="textbox"><span style="color:rgb(10,20,30)">Draft</span><svg><path fill="black"></path></svg></div></main></body></html>`;
function setup({enabled=true,url='https://mail.google.com/mail/u/0/#inbox',html=fixture,deferred=false,darkOS=true}={}){
 const d=new JSDOM(html,{url,runScripts:'outside-only'}),w=d.window;let change,resolve;
 w.chrome={storage:{local:{get:()=>deferred?new Promise(r=>resolve=r):Promise.resolve({gmailDarkMode:enabled})},onChanged:{addListener:f=>change=f}}};
 const media={matches:darkOS,addEventListener:(type,fn)=>media.listener=fn};w.matchMedia=()=>media;
 const nativeSheet=w.document.createElement('style');nativeSheet.textContent='.gmail-test-accent{background-color:rgb(200,220,255)}';w.document.head.append(nativeSheet);
 const sheet=w.document.createElement('style');sheet.textContent=read('gmail-dark.css');w.document.head.append(sheet);
 w.eval(read('gmail-dark.js'));
 return {w,d,system:dark=>{media.matches=dark;media.listener?.({matches:dark});},change:(value,area='local')=>change?.({gmailDarkMode:{newValue:value}},area),resolve:value=>resolve(value)};
}
(async()=>{
 const system=setup({darkOS:false});await tick();
 assert.ok(!system.w.document.documentElement.hasAttribute('data-sc-gmail-dark'),'Light system starts without forced dark colors');
 system.system(true);assert.ok(system.w.document.documentElement.hasAttribute('data-sc-gmail-dark'),'Switches dark without reload');
 system.system(false);assert.ok(!system.w.document.documentElement.hasAttribute('data-sc-gmail-dark'),'Switches light without reload');
 assert.equal(system.w.document.querySelectorAll("[data-sc-gmail-control]").length,0);
 system.system(true);system.change(false);system.system(false);system.system(true);
 assert.ok(!system.w.document.documentElement.hasAttribute('data-sc-gmail-dark'),'Opt-out survives system changes');system.d.window.close();

 // Raster controls must remain bright on selected rows and restore with the theme.
 const icons=setup({html:'<style>.T-Jo,.pH-A7{opacity:.32}</style><main><div class="zA x7"><div class="T-Jo"></div><div class="bqX"></div><div class="pG" aria-checked="false"><div class="pH-A7"></div></div><div class="pG" aria-checked="true"><div class="pH-A7"></div></div></div></main>'});await tick();
 for(const node of icons.w.document.querySelectorAll('.T-Jo,.bqX,.pG[aria-checked="false"] .pH-A7')){
  assert.equal(icons.w.getComputedStyle(node).filter,'brightness(0) invert(.85)');
  assert.equal(icons.w.getComputedStyle(node).opacity,'1');
 }
 assert.notEqual(icons.w.getComputedStyle(icons.w.document.querySelector('.pG[aria-checked="true"] .pH-A7')).filter,'brightness(0) invert(.85)','Colored important state is preserved');
 icons.system(false);assert.equal(icons.w.getComputedStyle(icons.w.document.querySelector('.T-Jo')).opacity,'0.32');
 icons.system(true);assert.equal(icons.w.getComputedStyle(icons.w.document.querySelector('.T-Jo')).opacity,'1');icons.d.window.close();
 const x=setup(),{w}=x;const editor=w.document.querySelector('[contenteditable]'),draft=editor.outerHTML;
 const body=w.document.querySelector('.a3s'),original=body.innerHTML;await tick();
 assert.ok(w.document.documentElement.hasAttribute('data-sc-gmail-dark'));
 assert.equal(w.document.querySelector('#surface').getAttribute('data-sc-gmail-bg'),'surface');
 assert.equal(editor.outerHTML,draft,'No editor attributes or serialized content changes');
 assert.equal(body.innerHTML,original,'Message HTML stays intact');
 let control=body.previousSibling;assert.ok(control.hasAttribute('data-sc-gmail-control'));
 const button=control.shadowRoot.querySelector('button');button.click();assert.ok(body.hasAttribute('data-sc-gmail-original'));assert.equal(button.getAttribute('aria-pressed'),'true');button.click();assert.ok(!body.hasAttribute('data-sc-gmail-original'));
 // Gmail inserts conversation shells before their message bodies. Baseline CSS
 // covers semantic panels while scheduled classification and controls catch up.
 const shell=w.document.createElement('section');shell.style.backgroundColor='white';shell.style.color='black';
 shell.innerHTML='<header style="background-color:white;color:black">Message header</header><div class="a3s"><p>Body</p></div>';
 w.document.querySelector('main').append(shell);await tick();
 assert.equal(shell.getAttribute('data-sc-gmail-bg'),'surface','New conversation shell is styled after the scheduled batch');
 assert.equal(shell.querySelector('header').getAttribute('data-sc-gmail-fg'),'text','New header is readable after the scheduled batch');
 assert.ok(shell.querySelector('.a3s').previousSibling.hasAttribute('data-sc-gmail-control'),'Message controls are also ready after the scheduled batch');
 shell.style.backgroundColor='rgb(200,220,255)';await tick();
 assert.equal(shell.getAttribute('data-sc-gmail-bg'),'accent','Reused message shells update after the scheduled batch');
 shell.removeAttribute('style');shell.className='gmail-test-accent';await tick();
 assert.equal(w.getComputedStyle(shell).backgroundColor,'rgb(47, 74, 115)','Classified colors override startup baseline');
 shell.remove();await tick();
 const added=w.document.createElement('div');added.className='a3s';added.innerHTML='<p style="color:black;background-color:white">New message</p>';w.document.querySelector('main').append(added);await tick();assert.ok(added.previousSibling.hasAttribute('data-sc-gmail-control'));
 w.document.querySelector('#surface').style.backgroundColor='rgb(200,220,255)';await tick();assert.equal(w.document.querySelector('#surface').getAttribute('data-sc-gmail-bg'),'accent','Runtime Gmail color changes are reclassified');
 assert.equal(editor.outerHTML,draft);
 x.change(false,'sync');assert.ok(w.document.documentElement.hasAttribute('data-sc-gmail-dark'));
 button.click();x.change(false);assert.ok(!w.document.documentElement.hasAttribute('data-sc-gmail-dark'));assert.equal(w.document.querySelectorAll('[data-sc-gmail-control]').length,0);assert.ok(!body.hasAttribute('data-sc-gmail-original'));assert.equal(body.innerHTML,original);
 x.change(true);await tick();assert.equal(w.document.querySelectorAll('[data-sc-gmail-control]').length,2,'No duplicate controls');w.eval(read('gmail-dark.js'));await tick();assert.equal(w.document.querySelectorAll('[data-sc-gmail-control]').length,2);
 body.remove();await tick();assert.equal(w.document.querySelectorAll('[data-sc-gmail-control]').length,1,'Detached message controls are cleaned');x.d.window.close();
 const off=setup({enabled:false});await tick();assert.ok(!off.w.document.documentElement.hasAttribute('data-sc-gmail-dark'));assert.equal(off.w.document.querySelectorAll('[data-sc-gmail-control]').length,0);off.d.window.close();
 const other=setup({url:'https://example.test/'});await tick();assert.ok(!other.w.document.documentElement.hasAttribute('data-sc-gmail-dark'));other.d.window.close();
 const race=setup({deferred:true});race.change(false);race.resolve({gmailDarkMode:true});await tick();assert.ok(!race.w.document.documentElement.hasAttribute('data-sc-gmail-dark'));race.d.window.close();
 // DOM creation after document_start and multiple-account URLs.
 const early=setup({html:'',url:'https://mail.google.com/mail/u/2/#inbox'});await tick();early.w.document.body.innerHTML='<div class="a3s">New message</div>';await tick();assert.equal(early.w.document.querySelectorAll('[data-sc-gmail-control]').length,1);early.d.window.close();
 // Large changes yield; scroll transforms and ancestor classes stay local.
 const load=setup();await tick();const lw=load.w,queue=[];lw.setTimeout=fn=>queue.push(fn);
 let reads=0,wrote=false,interleaved=false,gateChanges=0,editorMutations=0;
 const computed=lw.getComputedStyle.bind(lw);lw.getComputedStyle=element=>{reads++;if(wrote)interleaved=true;return computed(element);};
 const set=lw.Element.prototype.setAttribute;lw.Element.prototype.setAttribute=function(name,value){if(/^data-sc-gmail-(bg|fg|fill|stroke)$/.test(name))wrote=true;return set.call(this,name,value);};
 const gateObserver=new lw.MutationObserver(records=>gateChanges+=records.length);gateObserver.observe(lw.document.documentElement,{attributes:true,attributeFilter:['data-sc-gmail-dark']});
 const editorObserver=new lw.MutationObserver(records=>editorMutations+=records.length);editorObserver.observe(lw.document.querySelector('[contenteditable]'),{attributes:true,subtree:true});
 const big=lw.document.createElement('div');big.innerHTML='<div style="background-color:white;color:black">Row</div>'.repeat(650);lw.document.body.append(big);
 await Promise.resolve();assert.equal(reads,0,'Mutation delivery performs no computed style reads');assert.equal(queue.length,1,'Mutations coalesce');
 queue.shift()();assert.ok(reads<=50,'Reads capped at 50 per task');assert.equal(interleaved,false,'Color reads precede classification writes');assert.ok(queue.length,'Large updates yield to input');
 while(queue.length){wrote=false;queue.shift()();}await Promise.resolve();assert.equal(big.lastElementChild.getAttribute('data-sc-gmail-bg'),'surface');
 reads=0;wrote=false;big.style.transform='translateY(100px)';big.style.height='1000px';await Promise.resolve();assert.equal(queue.length,0,'Scroll layout changes schedule no dark work');assert.equal(reads,0);
 big.className='scrolling';await Promise.resolve();queue.shift()();await Promise.resolve();assert.equal(reads,1,'Class update does not scan 650 descendants');assert.equal(gateChanges,0,'Page-wide dark gate stays active');
 big.style.backgroundColor='rgb(200,220,255)';await Promise.resolve();queue.shift()();assert.equal(big.getAttribute('data-sc-gmail-bg'),'accent');
 lw.document.querySelector('[contenteditable]').classList.add('focused');await Promise.resolve();queue.shift()();await Promise.resolve();assert.equal(editorMutations,1,'Only the simulated Gmail class change touches draft markup; no sampling attributes');
 gateObserver.disconnect();editorObserver.disconnect();load.d.window.close();
 // Popup persistence and failure rollback.
 const popup=new JSDOM(read('popup.html'),{runScripts:'outside-only'}),p=popup.window;let saved,fail=false,listener;
 p.chrome={storage:{local:{get:async()=>({gmailDarkMode:false}),set:async data=>{if(fail)throw Error('Unavailable');saved=data;}},onChanged:{addListener:f=>listener=f}}};p.eval(read('gmail-popup.js'));await tick();const toggle=p.document.querySelector('#gmail-dark-mode');assert.equal(toggle.disabled,false);assert.equal(toggle.checked,false);toggle.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(saved)),{gmailDarkMode:true});fail=true;toggle.click();await tick();assert.equal(toggle.checked,true);assert.match(p.document.querySelector('#gmail-dark-status').textContent,/Could not save/);listener({gmailDarkMode:{newValue:false}},'local');assert.equal(toggle.checked,false);popup.window.close();
 // Palette pairs must pass even on the brightest selected background.
 const colors={text:'#e8eaed',muted:'#bdc1c6',link:'#aecbfa'},surfaces=['#141518','#202124','#2a2d32','#2f4a73'];
 const lum=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 for(const color of Object.values(colors))for(const surface of surfaces)assert.ok((lum(color)+.05)/(lum(surface)+.05)>=4.5,`${color} on ${surface}`);
 const manifest=JSON.parse(read('manifest.json'));assert.ok(manifest.content_scripts.some(s=>s.matches.includes('https://mail.google.com/*')&&s.js.includes('gmail-dark.js')&&s.css.includes('gmail-dark.css')));
 console.log('PASS: Gmail toggle persistence/rollback, dynamic messages, theme changes, original colors, editor/message integrity, startup, account URLs, isolation and contrast.');
})().catch(e=>{console.error(e);process.exit(1)});
