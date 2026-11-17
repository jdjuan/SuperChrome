const vm=require('node:vm'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
let handler,removedHandler;const tabs=[],removed=[],timers=new Map();let timerId=0;
const ctx={URL,setTimeout:f=>{timers.set(++timerId,f);return timerId;},clearTimeout:id=>timers.delete(id),chrome:{runtime:{onMessage:{addListener:f=>handler=f}},tabs:{create:async value=>{const tab={id:tabs.length+10,...value};tabs.push(tab);return tab;},remove:async id=>removed.push(id),onRemoved:{addListener:f=>removedHandler=f}}}};
vm.runInNewContext(fs.readFileSync('extension/ad-library-background.js','utf8'),ctx);
const sender={url:'https://www.facebook.com/ads/library/',tab:{id:1}};let first,second;
assert.equal(handler({action:'adAudienceLookup',id:'12345'},sender,r=>first=r),true);await new Promise(r=>setImmediate(r));assert.equal(tabs.length,1);assert.equal(tabs[0].active,false);
handler({action:'adAudienceLookup',id:'67890'},sender,r=>second=r);assert.equal(tabs.length,1,'serialized');let auth;
handler({action:'adAudienceWorker',id:'12345'},{...sender,tab:{id:999}},r=>auth=r);assert.equal(auth.authorized,false);
handler({action:'adAudienceWorker',id:'12345'},{...sender,tab:{id:10}},r=>auth=r);assert.equal(auth.authorized,true);
handler({action:'adAudienceResult',id:'12345',value:{age:'20-65+'}},{...sender,tab:{id:10}},()=>{});await new Promise(r=>setImmediate(r));assert.equal(first.value.age,'20-65+');assert.deepEqual(removed,[10]);assert.equal(tabs.length,2);
removedHandler(11);assert.ok(second.error);let denied;handler({action:'adAudienceLookup',id:'99999'},{url:'https://evil.test',tab:{id:3}},r=>denied=r);assert.ok(denied.error);
console.log('PASS: one inactive lookup tab, worker authorization, queue serialization, close cleanup and origin validation.');
})();
