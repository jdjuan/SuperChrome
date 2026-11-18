// Download button over YouTube and X videos, like the one on Instagram.
// Each site has its own switch in the SuperChrome popup (default on).
(() => {
  const site = /(^|\.)youtube\.com$/.test(location.hostname) ? 'youtube' : /(^|\.)(x|twitter)\.com$/.test(location.hostname) ? 'x' : null;
  if (!site) return;
  const key = site === 'youtube' ? 'youtubeDownloadButton' : 'xDownloadButton';
  const host = document.createElement('div');
  host.dataset.superchrome = 'video-download';
  const shadow = host.attachShadow({mode: 'open'});
  // Colors are owned here so the button reads on any video, in light or dark mode.
  shadow.innerHTML = `<style>
    :host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
    button { all: initial; box-sizing: border-box; position: fixed; width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #606060; border-radius: 50%; background: #202020; color: #fff; cursor: pointer; pointer-events: auto; font: 16px/1 system-ui; }
    button svg { width: 18px; height: 18px; fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    button:hover, button:focus-visible { background: #383838; outline: 2px solid #fff; outline-offset: 2px; }
    button:disabled { cursor: wait; }
    .status { all: initial; box-sizing: border-box; position: fixed; max-width: 260px; padding: 7px 10px; border: 1px solid #606060; border-radius: 6px; background: #202020; color: #fff; font: 12px/1.4 system-ui; overflow-wrap: anywhere; pointer-events: none; }
    .status[hidden] { display: none; }
  </style>`;
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14"/></svg>';
  const entries = new Map();
  let enabled = false, revision = 0, scheduled = false, latestJob = null;

  function youtubeTargets() {
    const path = location.pathname;
    const id = path === '/watch' ? new URLSearchParams(location.search).get('v') : null;
    if (!id && !/^\/(shorts|live)\/[^/]+/.test(path)) return [];
    const url = id ? `${location.origin}/watch?v=${encodeURIComponent(id)}` : location.origin + path;
    let best = null, bestArea = 0;
    for (const video of document.querySelectorAll('video')) {
      if (video.closest('ytd-miniplayer, ytd-video-preview')) continue;
      const r = video.getBoundingClientRect();
      const area = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
      if (area > bestArea) { best = video; bestArea = area; }
    }
    return best ? [{video: best, url, scope: best.closest('#movie_player, ytd-reel-video-renderer') || best.parentElement}] : [];
  }
  function xTargets() {
    const targets = [];
    for (const video of document.querySelectorAll('article video')) {
      const article = video.closest('article');
      const link = [...article.querySelectorAll('a[href*="/status/"]')].find(a => a.querySelector('time'));
      let path = '';
      try { path = new URL(link?.href || location.href, location.href).pathname; } catch {}
      if (!/\/status\/\d+/.test(path)) continue;
      targets.push({video, url: location.origin + path, scope: article});
    }
    return targets;
  }

  function show(entry, job) {
    const done = typeof job.ok === 'boolean';
    const {button, status} = entry;
    clearTimeout(entry.timer);
    button.disabled = !done;
    if (done) button.textContent = job.ok ? '✓' : '!'; else button.textContent = '…';
    const raw = job.message || job.error || 'Downloading…';
    const percent = job.percent || raw.match(/\[download\]\s+(\d+(?:\.\d+)?%)/)?.[1];
    const message = done ? (job.ok ? 'Saved to Downloads' : `${raw}${job.needsHelper ? '' : ' Click to retry.'}`)
      : raw.includes('Preparing compatible') ? 'Preparing compatible MP4…'
      : percent ? `Downloading ${percent}` : raw.startsWith('Starting') ? raw : 'Downloading…';
    button.title = message;
    status.textContent = message;
    status.hidden = false;
    if (done && job.ok) entry.timer = setTimeout(() => reset(entry), 6000);
  }
  function reset(entry) {
    entry.button.innerHTML = ICON;
    entry.button.disabled = false;
    entry.button.title = 'Download video';
    entry.status.hidden = true;
  }
  async function save(entry) {
    show(entry, {message: 'Starting download…'});
    try {
      const result = await chrome.runtime.sendMessage({action: 'download', url: entry.url});
      if (!result?.ok) throw Error(result?.error || 'Download unavailable.');
      // Background job updates report progress and completion.
    } catch (error) {
      show(entry, {ok: false, message: error.message});
    }
  }
  function clear() {
    for (const entry of entries.values()) { clearTimeout(entry.timer); entry.button.remove(); entry.status.remove(); }
    entries.clear();
  }
  function reconcile() {
    scheduled = false;
    if (!enabled) { clear(); return; }
    if (!host.isConnected) document.documentElement.append(host);
    const found = new Set();
    for (const {video, url, scope} of site === 'youtube' ? youtubeTargets() : xTargets()) {
      const rect = video.getBoundingClientRect();
      if (rect.width < 160 || rect.height < 90 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth || !video.getClientRects().length) continue;
      const x = Math.min(rect.right, innerWidth) - 30, y = Math.max(rect.top, 0) + 30;
      const hit = document.elementFromPoint?.(x, y);
      if (hit && hit !== host && hit !== video && !scope?.contains(hit)) continue;
      found.add(video);
      let entry = entries.get(video);
      if (!entry) {
        const button = document.createElement('button'), status = document.createElement('span');
        button.type = 'button';
        button.innerHTML = ICON;
        button.title = 'Download video';
        button.setAttribute('aria-label', 'Download video');
        status.className = 'status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.hidden = true;
        entry = {video, url, button, status, timer: 0};
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); save(entry); });
        shadow.append(button, status);
        entries.set(video, entry);
      }
      if (entry.url !== url) { entry.url = url; reset(entry); }
      if (latestJob?.url === url && typeof latestJob.ok !== 'boolean') show(entry, latestJob);
      entry.button.style.left = `${x - 17}px`;
      entry.button.style.top = `${y - 17}px`;
      entry.status.style.left = `${Math.max(8, x - 255)}px`;
      entry.status.style.top = `${y + 24}px`;
    }
    for (const [video, entry] of entries) if (!found.has(video)) { clearTimeout(entry.timer); entry.button.remove(); entry.status.remove(); entries.delete(video); }
  }
  function schedule() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(reconcile); }
  }
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[key]) { revision++; enabled = changes[key].newValue !== false; schedule(); }
    const job = changes.job?.newValue;
    if (job?.url) {
      latestJob = job;
      for (const entry of entries.values()) if (entry.url === job.url) show(entry, job);
    }
  });
  const initialRevision = revision;
  chrome.storage?.local?.get({[key]: true}).then(settings => {
    if (revision === initialRevision) enabled = settings[key] !== false;
    schedule();
  }).catch(() => {});
  new MutationObserver(schedule).observe(document, {childList: true, subtree: true});
  addEventListener('scroll', schedule, true);
  addEventListener('resize', schedule);
  addEventListener('yt-navigate-finish', schedule);
  addEventListener('popstate', schedule);
  setInterval(schedule, 1500);
  schedule();
})();
