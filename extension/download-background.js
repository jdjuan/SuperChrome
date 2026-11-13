// Video downloads. Instagram and X save directly through chrome.downloads;
// YouTube (and direct-download failures) use the optional local helper.
const PAGE_HOSTS = ['youtube.com','www.youtube.com','m.youtube.com','youtu.be','instagram.com','www.instagram.com','x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'];
const HELPER_MISSING = 'YouTube downloads need the local helper. Open SuperChrome → Download Video and copy the setup prompt.';
let busy = false;

function siteOf(url) {
  const host = url.hostname;
  if (/(^|\.)instagram\.com$/.test(host)) return 'instagram';
  if (/(^|\.)(x|twitter)\.com$/.test(host)) return 'x';
  return 'youtube';
}
function mediaAllowed(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (/\.(cdninstagram\.com|fbcdn\.net)$/.test(url.hostname) || url.hostname === 'video.twimg.com');
  } catch { return false; }
}
function xToken(id) { return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, ''); }
async function xVideos(pageUrl) {
  const match = pageUrl.pathname.match(/\/status(?:es)?\/(\d+)(?:\/video\/(\d+))?/);
  if (!match) throw Error('Open a single X post, then try again.');
  const [, id, index] = match;
  const response = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&token=${xToken(id)}`, {credentials: 'omit'});
  if (!response.ok) throw Error('X did not share this post publicly.');
  const data = await response.json();
  const media = (data.mediaDetails?.length ? data.mediaDetails : data.quoted_tweet?.mediaDetails) || [];
  const chosen = index ? [media[Number(index) - 1]].filter(Boolean) : media;
  const videos = chosen.map(item => (item.video_info?.variants || [])
    .filter(variant => variant.content_type === 'video/mp4' && mediaAllowed(variant.url))
    .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0]?.url).filter(Boolean);
  if (!videos.length) throw Error('No downloadable video found in this X post.');
  return videos.map((url, i) => ({url, filename: `x-${id}${videos.length > 1 ? `-${i + 1}` : ''}.mp4`}));
}
async function instagramFromTab(pageUrl) {
  const [tab] = await chrome.tabs.query({active: true, lastFocusedWindow: true});
  if (tab?.id == null) throw Error('Open instagram.com in this tab to download directly.');
  try {
    const result = await chrome.tabs.sendMessage(tab.id, {action: 'resolveInstagram', url: pageUrl.href});
    if (!result?.media) throw Error(result?.error || 'Instagram did not return this video.');
    return result.media;
  } catch (error) {
    throw Error(/Receiving end|Could not establish/.test(error.message) ? 'Open instagram.com in this tab to download directly.' : error.message);
  }
}

function downloadDirect(files, updateJob) {
  return new Promise(resolve => {
    const ids = [];
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      chrome.downloads.onChanged.removeListener(changed);
      updateJob(result);
      resolve();
    };
    const poll = async () => {
      if (!ids.length) return;
      const items = (await Promise.all(ids.map(id => chrome.downloads.search({id})))).flat();
      if (items.some(item => item.state === 'interrupted')) {
        const reason = items.find(item => item.state === 'interrupted').error;
        return finish({ok: false, message: reason === 'USER_CANCELED' ? 'Download canceled.' : `Download failed (${reason}).`});
      }
      if (items.length === ids.length && items.every(item => item.state === 'complete')) return finish({ok: true, message: 'Saved to Downloads'});
      const total = items.reduce((sum, item) => sum + (item.totalBytes > 0 ? item.totalBytes : 0), 0);
      const received = items.reduce((sum, item) => sum + item.bytesReceived, 0);
      const percent = total ? `${Math.min(99, Math.floor(received / total * 100))}%` : '';
      updateJob({message: percent ? `Downloading ${percent}` : 'Downloading…', percent});
    };
    const changed = delta => { if (ids.includes(delta.id) && delta.state) poll(); };
    chrome.downloads.onChanged.addListener(changed);
    const timer = setInterval(poll, 1000);
    (async () => {
      try {
        for (const file of files) ids.push(await chrome.downloads.download({url: file.url, filename: file.filename, conflictAction: 'uniquify'}));
        poll();
      } catch (error) {
        finish({ok: false, message: `Download failed: ${error.message}`});
      }
    })();
  });
}

function downloadWithHelper(message, updateJob, directError) {
  return new Promise(resolve => {
    let finished = false;
    const port = chrome.runtime.connectNative('io.jdjuan.local_video');
    port.onMessage.addListener(result => {
      if (typeof result.ok === 'boolean') finished = true;
      updateJob(result);
      if (finished) resolve();
    });
    port.onDisconnect.addListener(() => {
      const error = chrome.runtime.lastError?.message || '';
      if (!finished) {
        const missing = /not found|forbidden|Access to the specified native messaging host/i.test(error);
        updateJob(missing
          ? {ok: false, needsHelper: true, message: directError ? `${directError} The local helper is not set up either.` : HELPER_MISSING}
          : {ok: false, message: error || 'Download helper disconnected before completion. Click to retry.'});
      }
      resolve();
    });
    port.postMessage({action: 'download', url: message.url, slide: message.slide, slideCount: message.slideCount, poster: message.poster});
  });
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message.action === 'ping') {
    chrome.runtime.sendNativeMessage('io.jdjuan.local_video', {action: 'ping'}, r => reply(chrome.runtime.lastError ? {ok: false, error: chrome.runtime.lastError.message} : r));
    return true;
  }
  if (message.action !== 'download') return;
  let pageUrl;
  try {
    pageUrl = new URL(message.url);
    if (pageUrl.protocol !== 'https:' || !PAGE_HOSTS.includes(pageUrl.hostname)) throw Error();
  } catch { reply({error: 'Enter a YouTube, Instagram, or X HTTPS video URL.'}); return; }
  if (busy) { reply({error: 'A download is already running.'}); return; }
  busy = true;
  const updateJob = result => chrome.storage.local.set({job: {...result, url: message.url, slide: message.slide}});
  updateJob({message: 'Starting download…'});
  reply({ok: true});
  (async () => {
    const site = siteOf(pageUrl);
    let directError = '';
    if (site !== 'youtube' && !message.directError) {
      try {
        let files = Array.isArray(message.media) ? message.media : null;
        if (!files) files = site === 'x' ? await xVideos(pageUrl) : await instagramFromTab(pageUrl);
        if (!files.length || !files.every(file => mediaAllowed(file.url) && /^[\w.-]{1,120}$/.test(file.filename))) throw Error('Unexpected video address.');
        await downloadDirect(files, updateJob);
        return;
      } catch (error) {
        directError = error.message || 'Direct download unavailable.';
      }
    }
    if (message.directError) directError = message.directError;
    await downloadWithHelper(message, updateJob, directError);
  })().finally(() => { busy = false; });
});
