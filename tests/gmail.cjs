const {JSDOM}=require('jsdom'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const read=f=>fs.readFileSync(path.join(__dirname,'../extension',f),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,120));
const fixture=`<html><body style="background-color:rgb(248,250,253);color:rgb(32,33,36)"><main><div id="surface" style="background-color:white;color:black">Inbox</div><div class="zA zE">Unread</div><div class="a3s"><table bgcolor="white"><tr><td style="color:black;background-color:white"><a href="https://example.test">Link</a><img src="logo.png" style="background-color:white"><svg><path fill="black"></path></svg></td></tr></table></div><div contenteditable="true" role="textbox"><span style="color:rgb(10,20,30)">Draft</span><svg><path fill="black"></path></svg></div></main></body></html>`;
function setup({enabled=true,url='https://mail.google.com/mail/u/0/#inbox',html=fixture,deferred=false}={}){
 const d=new JSDOM(html,{url,runScripts:'outside-only'}),w=d.window;let change,resolve;
 w.chrome={storage:{local:{get:()=>deferred?new Promise(r=>resolve=r):Promise.resolve({gmailDarkMode:enabled})},onChanged:{addListener:f=>change=f}}};
 w.eval(read('gmail-dark.js'));
 return {w,d,change:(value,area='local')=>change?.({gmailDarkMode:{newValue:value}},area),resolve:value=>resolve(value)};
}
(async()=>{
 const x=setup(),{w}=x;const editor=w.document.querySelector('[contenteditable]'),draft=editor.outerHTML;
 const body=w.document.querySelector('.a3s'),original=body.innerHTML;await tick();
 assert.ok(w.document.documentElement.hasAttribute('data-sc-gmail-dark'));
 assert.equal(w.document.querySelector('#surface').getAttribute('data-sc-gmail-bg'),'surface');
 assert.equal(editor.outerHTML,draft,'No editor attributes or serialized content changes');
 assert.equal(body.innerHTML,original,'Message HTML stays intact');
 let control=body.previousSibling;assert.ok(control.hasAttribute('data-sc-gmail-control'));
 const button=control.shadowRoot.querySelector('button');button.click();assert.ok(body.hasAttribute('data-sc-gmail-original'));assert.equal(button.getAttribute('aria-pressed'),'true');button.click();assert.ok(!body.hasAttribute('data-sc-gmail-original'));
 // Gmail inserts a white conversation shell before its message body. It must
 // be dark by mutation delivery, before the browser gets a rendering opportunity.
 const shell=w.document.createElement('section');shell.style.backgroundColor='white';shell.style.color='black';
 shell.innerHTML='<header style="background-color:white;color:black">Message header</header><div class="a3s"><p>Body</p></div>';
 w.document.querySelector('main').append(shell);await Promise.resolve();
 assert.equal(shell.getAttribute('data-sc-gmail-bg'),'surface','New conversation shell is styled before the next task/paint');
 assert.equal(shell.querySelector('header').getAttribute('data-sc-gmail-fg'),'text','New header is readable before paint');
 assert.ok(shell.querySelector('.a3s').previousSibling.hasAttribute('data-sc-gmail-control'),'Message controls are also ready before paint');
 shell.style.backgroundColor='rgb(200,220,255)';await Promise.resolve();
 assert.equal(shell.getAttribute('data-sc-gmail-bg'),'accent','Reused message shells update before paint');
 shell.remove();await Promise.resolve();
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
 // Popup persistence and failure rollback.
 const popup=new JSDOM(read('popup.html'),{runScripts:'outside-only'}),p=popup.window;let saved,fail=false,listener;
 p.chrome={storage:{local:{get:async()=>({gmailDarkMode:false}),set:async data=>{if(fail)throw Error('Unavailable');saved=data;}},onChanged:{addListener:f=>listener=f}}};p.eval(read('gmail-popup.js'));await tick();const toggle=p.document.querySelector('#gmail-dark-mode');assert.equal(toggle.disabled,false);assert.equal(toggle.checked,false);toggle.click();await tick();assert.deepEqual(JSON.parse(JSON.stringify(saved)),{gmailDarkMode:true});fail=true;toggle.click();await tick();assert.equal(toggle.checked,true);assert.match(p.document.querySelector('#gmail-dark-status').textContent,/Could not save/);listener({gmailDarkMode:{newValue:false}},'local');assert.equal(toggle.checked,false);popup.window.close();
 // Palette pairs must pass even on the brightest selected background.
 const colors={text:'#e8eaed',muted:'#bdc1c6',link:'#aecbfa'},surfaces=['#17191c','#202124','#292c31','#33496b'];
 const lum=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
 for(const color of Object.values(colors))for(const surface of surfaces)assert.ok((lum(color)+.05)/(lum(surface)+.05)>=4.5,`${color} on ${surface}`);
 const manifest=JSON.parse(read('manifest.json'));assert.ok(manifest.content_scripts.some(s=>s.matches.includes('https://mail.google.com/*')&&s.js.includes('gmail-dark.js')&&s.css.includes('gmail-dark.css')));
 console.log('PASS: Gmail toggle persistence/rollback, dynamic messages, theme changes, original colors, editor/message integrity, startup, account URLs, isolation and contrast.');
})().catch(e=>{console.error(e);process.exit(1)});
