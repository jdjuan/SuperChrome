// Exact upload date and view count under the YouTube video title, so you don't need the popup.
// Values come from the watch page's own data; nothing leaves the browser except the page request itself.
(() => {
  if (!/(^|\.)youtube\.com$/.test(location.hostname)) return;
  const KEY = 'youtubeStats';
  let enabled = false, revision = 0, current = null, token = 0;
  const cache = new Map();
  const host = document.createElement('div');
  host.dataset.superchrome = 'youtube-stats';
  const shadow = host.attachShadow({mode: 'open'});
  // Colors are owned here and chosen from YouTube's actual background (not the OS theme), so the line stays readable in both modes.
  shadow.innerHTML = `<style>
    :host { display: block; margin: 2px 0 6px; }
    .line { font: 400 14px/20px Roboto, Arial, sans-serif; color: #606060; }
    b { font-weight: 500; color: #0f0f0f; }
    :host([data-superchrome-theme="dark"]) .line { color: #b8b8b8; }
    :host([data-superchrome-theme="dark"]) b { color: #f1f1f1; }
  </style><div class="line" role="status"></div>`;
  const line = shadow.querySelector('.line');

  function watchId() {
    return location.pathname === '/watch' ? new URLSearchParams(location.search).get('v') : null;
  }
  async function load(id) {
    if (cache.has(id)) return cache.get(id);
    const response = await fetch(`/watch?v=${encodeURIComponent(id)}`, {credentials: 'same-origin'});
    if (!response.ok) throw Error('unavailable');
    const html = await response.text();
    const start = html.indexOf(`"videoDetails":{"videoId":"${id}"`);
    if (start < 0) throw Error('unavailable');
    const views = html.slice(start, start + 4000).match(/"viewCount":"(\d+)"/)?.[1];
    const date = html.match(/"uploadDate":"([^"]+)"/)?.[1] || html.match(/"publishDate":"([^"]+)"/)?.[1];
    const stats = {views: views === undefined ? null : Number(views), date: date && Number.isFinite(new Date(date).getTime()) ? new Date(date) : null};
    cache.set(id, stats);
    return stats;
  }
  function render(stats) {
    line.replaceChildren();
    const add = (label, value) => {
      if (line.childNodes.length) line.append(' · ');
      const strong = document.createElement('b');
      strong.textContent = value;
      line.append(label ? `${label} ` : '', strong);
    };
    if (stats.date) add('Uploaded', stats.date.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}));
    if (stats.views !== null) add('', stats.views.toLocaleString() + ' views');
    return line.childNodes.length > 0;
  }
  function mount() {
    const anchor = document.querySelector('ytd-watch-metadata #top-row') || document.querySelector('ytd-watch-metadata #title-row');
    if (!anchor) return false;
    if (anchor.id === 'top-row') { if (host.nextElementSibling !== anchor) anchor.before(host); }
    else if (host.previousElementSibling !== anchor) anchor.after(host);
    return true;
  }
  function tick() {
    const id = enabled ? watchId() : null;
    if (!id) { host.remove(); current = null; token++; return; }
    if (!mount()) return;
    globalThis.SuperChromeTheme?.apply(host);
    if (id === current) return;
    current = id;
    const mine = ++token;
    line.replaceChildren();
    load(id).then(stats => {
      if (mine !== token) return;
      host.hidden = !render(stats);
    }, () => { if (mine === token) host.hidden = true; });
  }
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    revision++;
    enabled = changes[KEY].newValue !== false;
    current = null;
    tick();
  });
  const initialRevision = revision;
  chrome.storage?.local?.get({[KEY]: true}).then(settings => {
    if (revision === initialRevision) enabled = settings[KEY] !== false;
    tick();
  }).catch(() => {});
  addEventListener('yt-navigate-finish', tick);
  setInterval(tick, 1000);
})();
