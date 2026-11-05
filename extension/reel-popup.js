(() => {
const root=document.querySelector('#reel-panel'); const find=id=>root.querySelector('#'+id);
const status = find('reel-status');
chrome.tabs.query({active:true,currentWindow:true}).then(([tab])=>{find('watch').hidden=!/(^|\.)facebook\.com$/.test(new URL(tab.url).hostname);}).catch(()=>{find('watch').hidden=true;});
function videoId(url) {
  const u = new URL(url);
  if (/(^|\.)(youtube\.com|youtu\.be)$/.test(u.hostname)) return u.searchParams.get('v') || u.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1] || (u.hostname==='youtu.be' ? u.pathname.slice(1) : null);
  if (/(^|\.)instagram\.com$/.test(u.hostname)) return u.pathname.match(/^\/(?:p|reel|reels)\/([^/]+)/)?.[1];
  if (/(^|\.)(x\.com|twitter\.com)$/.test(u.hostname)) return u.pathname.match(/\/status\/(\d+)/)?.[1];
  if (!/(^|\.)facebook\.com$/.test(u.hostname)) return null;
  return u.pathname.match(/^\/reel\/(\d+)\/?$/)?.[1]
    || u.pathname.match(/\/videos\/(?:[^/]+\/)?(\d+)\/?$/)?.[1]
    || (/^\/watch\/?$/.test(u.pathname) && /^\d+$/.test(u.searchParams.get('v') || '') ? u.searchParams.get('v') : null);
}
async function currentVideo() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  const id = videoId(tab.url || '');
  if (!id) throw new Error('Open an individual video on Facebook, YouTube, Instagram or X first.');
  return {tab,id};
}
find('watch').addEventListener('click', async () => {
  try {
    const {tab,id} = await currentVideo();
    if (!/(^|\.)facebook\.com$/.test(new URL(tab.url).hostname)) throw new Error('Open in Watch is available for Facebook videos only.');
    await chrome.tabs.update(tab.id,{url:`https://www.facebook.com/watch/?v=${id}`});
    status.textContent = 'Watch opened. Once it loads, click Show date & views. Facebook may redirect back to Reels.';
  } catch(e) {status.textContent=e.message;}
});
find('inspect').addEventListener('click', async () => {
  try {
    const {tab,id} = await currentVideo();
    const [result] = await chrome.scripting.executeScript({target:{tabId:tab.id},files:['theme.js', /(^|\.)facebook\.com$/.test(new URL(tab.url).hostname) ? 'inspect.js' : 'video-stats.js']});
    const details = result.result;
    if (!details || details.id !== id) throw new Error('The video changed. Open the extension again to retry.');
    status.textContent = details.text;
  } catch(e) {status.textContent=e.message;}
});

})();
