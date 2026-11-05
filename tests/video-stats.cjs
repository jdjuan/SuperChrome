const {JSDOM}=require('jsdom'),fs=require('fs'),assert=require('node:assert/strict');
const source=fs.readFileSync('extension/video-stats.js','utf8');
function inspect(url,html){return new JSDOM(html,{url,runScripts:'outside-only'}).window.eval(source);}
let result=inspect('https://www.youtube.com/watch?v=abc','<meta itemprop="datePublished" content="2026-01-02"><meta itemprop="interactionCount" content="1234">');
assert.equal(result.id,'abc');assert.match(result.text,/1234/);
result=inspect('https://www.instagram.com/reel/abc/',`<script type="application/ld+json">${JSON.stringify([{'@type':'VideoObject',url:'https://www.instagram.com/reel/other/',uploadDate:'2020-01-01',interactionStatistic:{interactionType:'WatchAction',userInteractionCount:999}},{'@type':'VideoObject',url:'https://www.instagram.com/reel/abc/',uploadDate:'2026-02-03',interactionStatistic:{interactionType:{'@type':'WatchAction'},userInteractionCount:42}}])}</script>`);
assert.match(result.text,/42/);assert.doesNotMatch(result.text,/999|2020/);
result=inspect('https://x.com/user/status/123','<article><a href="/user/status/456"><time datetime="2020-01-01"></time></a></article><article><a href="/user/status/123"><time datetime="2026-01-02"></time></a></article>');
assert.match(result.text,/2026/);assert.doesNotMatch(result.text,/2020/);assert.match(result.text,/Not exposed/);
assert.equal(inspect('https://www.instagram.com/', ''),null);
console.log('PASS: video stats on YouTube, Instagram and X, matching-video isolation and unavailable fields.');
