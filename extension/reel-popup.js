(() => {
const root=document.querySelector('#reel-panel'); const find=id=>root.querySelector('#'+id);
const status = find('reel-status');
function videoId(url) {
  const u = new URL(url);
  if (!/(^|\.)facebook\.com$/.test(u.hostname)) return null;
  return u.pathname.match(/^\/reel\/(\d+)\/?$/)?.[1]
    || u.pathname.match(/\/videos\/(?:[^/]+\/)?(\d+)\/?$/)?.[1]
    || (/^\/watch\/?$/.test(u.pathname) && /^\d+$/.test(u.searchParams.get('v') || '') ? u.searchParams.get('v') : null);
}
async function currentVideo() {
  const [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  const id = videoId(tab.url || '');
  if (!id) throw new Error('Open an individual Facebook reel or video first. The profile Reels grid is not supported.');
  return {tab,id};
}
find('watch').addEventListener('click', async () => {
  try {
    const {tab,id} = await currentVideo();
    await chrome.tabs.update(tab.id,{url:`https://www.facebook.com/watch/?v=${id}`});
    status.textContent = 'Watch opened. Once it loads, click Show date & views. Facebook may redirect back to Reels.';
  } catch(e) {status.textContent=e.message;}
});
find('inspect').addEventListener('click', async () => {
  try {
    const {tab,id} = await currentVideo();
    const [result] = await chrome.scripting.executeScript({target:{tabId:tab.id},files:['inspect.js']});
    const details = result.result;
    if (!details || details.id !== id) throw new Error('The video changed. Open the extension again to retry.');
    status.textContent = details.text;
  } catch(e) {status.textContent=e.message;}
});

})();
