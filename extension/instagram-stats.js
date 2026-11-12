// Shows upload time and public counts (plays, likes, comments, shares) for the open Instagram post or reel.
(() => {
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const APP_ID = '936619743392459';
  const cache = new Map();
  const shortcodeOf = href => { try { return new URL(href, location.href).pathname.match(/^\/(?:[^/]+\/)?(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)?.[1] || null; } catch { return null; } };
  // Shortcodes are base64 media IDs; private posts append extra characters after the first 11.
  function mediaId(shortcode) {
    let id = 0n;
    for (const char of shortcode.slice(0, 11)) { const value = ALPHABET.indexOf(char); if (value < 0) return null; id = id * 64n + BigInt(value); }
    return String(id);
  }
  const number = value => Number.isFinite(value) && value >= 0 ? value : null;
  async function fetchStats(shortcode) {
    if (cache.has(shortcode)) return cache.get(shortcode);
    const id = mediaId(shortcode);
    if (!id) throw Error('Unrecognized Instagram link.');
    const request = fetch(`/api/v1/media/${id}/info/`, {credentials: 'include', headers: {'X-IG-App-ID': APP_ID, 'X-Requested-With': 'XMLHttpRequest'}}).then(async response => {
      if (response.status === 401 || response.status === 403) throw Error('Sign in to Instagram to see stats.');
      if (!response.ok) throw Error(`Instagram did not return stats (${response.status}).`);
      const item = (await response.json())?.items?.[0];
      if (!item) throw Error('Instagram did not return stats for this post.');
      return {
        shortcode,
        takenAt: number(item.taken_at) ? new Date(item.taken_at * 1000) : null,
        plays: number(item.play_count ?? item.ig_play_count ?? item.view_count ?? item.video_view_count),
        likes: number(item.like_count),
        comments: number(item.comment_count),
        shares: number(item.reshare_count),
        duration: number(item.video_duration),
        video: item.media_type === 2 || Boolean(item.video_versions)
      };
    });
    cache.set(shortcode, request);
    request.catch(() => cache.delete(shortcode));
    return request;
  }
  const compact = value => value === null ? '—' : new Intl.NumberFormat(undefined, {notation: 'compact', maximumFractionDigits: 1}).format(value);
  const exact = value => value === null ? 'Not shown' : new Intl.NumberFormat().format(value);
  function ago(date, now = Date.now()) {
    const seconds = Math.round((date.getTime() - now) / 1000);
    const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    const rtf = new Intl.RelativeTimeFormat(undefined, {numeric: 'auto'});
    for (const [unit, size] of units) if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    return rtf.format(seconds, 'second');
  }
  function text(stats) {
    const lines = [`Posted: ${stats.takenAt ? `${stats.takenAt.toLocaleString()} (${ago(stats.takenAt)})` : 'Not shown'}`];
    if (stats.video) lines.push(`Plays: ${exact(stats.plays)}`);
    lines.push(`Likes: ${exact(stats.likes)}`, `Comments: ${exact(stats.comments)}`, `Shares: ${exact(stats.shares)}`);
    if (stats.duration) lines.push(`Length: ${Math.round(stats.duration)} s`);
    return lines.join('\n');
  }
  globalThis.SuperChromeInstagramStats = {shortcodeOf, mediaId, fetchStats, text, compact, ago};
  if (globalThis.__superchromeInstagramStatsBadge) return;
  globalThis.__superchromeInstagramStatsBadge = true;

  const host = document.createElement('div');
  host.dataset.superchrome = 'instagram-stats';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host { all: initial; position: fixed; top: 12px; right: 12px; z-index: 2147483645; }
    .bar { box-sizing: border-box; display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 24px); flex-wrap: wrap; row-gap: 4px; padding: 7px 8px 7px 12px; border: 1px solid var(--sc-border, #bdc8da); border-radius: 999px; box-shadow: 0 4px 16px rgb(0 0 0 / .18); font: 600 12.5px/1.35 system-ui, -apple-system, sans-serif; }
    [hidden] { display: none !important; }
    .when { white-space: nowrap; }
    .when small { font-weight: 500; color: var(--sc-muted, #526078); font-size: 12px; margin-left: 4px; }
    .counts { display: flex; gap: 10px; white-space: nowrap; color: var(--sc-text, #182238); }
    .counts > span { display: inline-flex; align-items: center; gap: 4px; }
    svg { width: 13px; height: 13px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .plays svg { fill: currentColor; stroke: none; }
    .sep { width: 1px; align-self: stretch; background: var(--sc-border, #bdc8da); }
    button { all: initial; box-sizing: border-box; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; cursor: pointer; font: 15px/1 system-ui; }
    .msg { font-weight: 500; color: var(--sc-muted, #526078); }
  </style><div class="bar" role="status" aria-live="polite" hidden><span class="when"></span><span class="sep"></span><span class="counts"><span class="plays" title="Plays"></span><span class="likes" title="Likes"></span><span class="comments" title="Comments"></span><span class="shares" title="Shares"></span></span><button class="close" type="button" aria-label="Hide stats for this post" title="Hide for this post">×</button></div>`;
  globalThis.SuperChromeTheme?.attach(host, shadow);
  const $ = selector => shadow.querySelector(selector);
  const bar = $('.bar');
  let enabled = true, current = null, dismissed = null, token = 0;
  function mount() { const parent = document.body || document.documentElement; if (parent && host.parentNode !== parent) parent.append(host); }
  function hide() { bar.hidden = true; }
  const ICONS = {
    plays: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>',
    likes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    comments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    shares: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></svg>'
  };
  function setCount(name, icon, value, label) {
    const el = $('.' + name);
    el.hidden = value === null;
    el.innerHTML = ICONS[icon];
    el.append(compact(value));
    el.title = `${label}: ${exact(value)}`;
    el.setAttribute('aria-label', `${label}: ${exact(value)}`);
  }
  function render(stats) {
    const when = $('.when');
    when.textContent = stats.takenAt ? stats.takenAt.toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'}) : 'Date not shown';
    when.title = stats.takenAt ? stats.takenAt.toString() : '';
    if (stats.takenAt) { const small = document.createElement('small'); small.textContent = ago(stats.takenAt); when.append(small); }
    $('.sep').hidden = false;
    $('.counts').hidden = false;
    setCount('plays', 'plays', stats.video ? stats.plays : null, 'Plays');
    setCount('likes', 'likes', stats.likes, 'Likes');
    setCount('comments', 'comments', stats.comments, 'Comments');
    setCount('shares', 'shares', stats.shares, 'Shares');
  }
  function message(value) {
    const when = $('.when');
    when.textContent = '';
    const span = document.createElement('span'); span.className = 'msg'; span.textContent = value; when.append(span);
    $('.sep').hidden = true; $('.counts').hidden = true;
  }
  async function update() {
    const shortcode = enabled ? shortcodeOf(location.href) : null;
    if (!shortcode || shortcode === dismissed) { current = null; hide(); return; }
    mount();
    globalThis.SuperChromeTheme?.apply(host);
    if (shortcode === current) return;
    current = shortcode;
    const mine = ++token;
    message('Loading stats…');
    bar.hidden = false;
    try { const stats = await fetchStats(shortcode); if (mine === token) render(stats); }
    catch (error) { if (mine === token) message(error.message || 'Stats unavailable.'); }
  }
  $('.close').addEventListener('click', () => { dismissed = current; hide(); });
  // Instagram navigates with pushState from the page world, so watch the URL instead of hooking history.
  let lastHref = '';
  setInterval(() => {
    if (location.href !== lastHref) { lastHref = location.href; update(); }
    else if (!bar.hidden) globalThis.SuperChromeTheme?.apply(host);
  }, 400);
  chrome.storage?.local?.get({instagramStats: true}).then(settings => { enabled = settings.instagramStats !== false; current = null; update(); }).catch(() => update());
  chrome.storage?.onChanged?.addListener((changes, area) => {
    if (area === 'local' && changes.instagramStats) { enabled = changes.instagramStats.newValue !== false; current = null; dismissed = null; update(); }
    if (area === 'local' && changes.instagramGridStats) { gridEnabled = changes.instagramGridStats.newValue !== false; gridEnabled ? scanGrid() : clearGrid(); }
  });

  // Grid chips: upload time and counts on every visible tile of profile, Reels-tab, tagged and saved grids.
  // Chips sit on top of photos, so they own a dark scrim (worst case over white still exceeds 4.5:1).
  let gridEnabled = true, rateLimitedUntil = 0, active = 0, scanQueued = false;
  const tiles = new WeakSet(), queue = [], chips = new Set();
  const GRID_CSS = `:host { all: initial; position: absolute; top: 6px; left: 6px; z-index: 2; pointer-events: none; max-width: calc(100% - 44px); }
    .chip { box-sizing: border-box; display: grid; gap: 2px; padding: 5px 8px; border-radius: 8px; background: rgb(0 0 0 / .74); color: #fff; font: 600 11.5px/1.3 system-ui, -apple-system, sans-serif; text-shadow: none; }
    .date { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .counts { display: flex; flex-wrap: wrap; column-gap: 8px; row-gap: 1px; font-weight: 600; }
    .counts span { display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; }
    svg { width: 11px; height: 11px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
    .plays svg { fill: currentColor; stroke: none; }
    .muted { color: #e2e6ee; font-weight: 500; }`;
  const onGridPage = () => !/^\/(?:p|reel|reels|tv|stories|direct|explore|accounts)(?:\/|$)/.test(location.pathname) && location.pathname !== '/';
  function isTile(anchor) {
    if (!shortcodeOf(anchor.href) || anchor.closest('article, [role="dialog"], header, nav')) return false;
    const rect = anchor.getBoundingClientRect();
    return rect.width >= 90 && rect.height >= 90 && Boolean(anchor.querySelector('img, video, div[style*="background-image"]'));
  }
  const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
    for (const entry of entries) if (entry.isIntersecting) { observer.unobserve(entry.target); enqueue(entry.target); }
  }, {rootMargin: '200px'}) : null;
  function scanGrid() {
    if (!gridEnabled || !onGridPage()) return;
    for (const anchor of document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]')) {
      if (tiles.has(anchor) || !isTile(anchor)) continue;
      tiles.add(anchor);
      observer ? observer.observe(anchor) : enqueue(anchor);
    }
  }
  function enqueue(anchor) { queue.push(anchor); pump(); }
  // Two requests at a time, spaced out, so long grids don't trip Instagram's rate limits.
  function pump() {
    while (active < 2 && queue.length && Date.now() >= rateLimitedUntil) {
      const anchor = queue.shift();
      if (!anchor.isConnected || !gridEnabled) continue;
      const shortcode = shortcodeOf(anchor.href);
      active++;
      fetchStats(shortcode).then(stats => chip(anchor, stats), error => {
        if (/\(429\)/.test(error.message)) { rateLimitedUntil = Date.now() + 60000; queue.unshift(anchor); }
      }).finally(() => { active--; setTimeout(pump, 250); });
    }
    if (queue.length && Date.now() < rateLimitedUntil) setTimeout(pump, rateLimitedUntil - Date.now());
  }
  function chip(anchor, stats) {
    if (!gridEnabled || !anchor.isConnected || shortcodeOf(anchor.href) !== stats.shortcode) return;
    anchor.querySelector(':scope > [data-superchrome="instagram-grid-stats"]')?.remove();
    const holder = document.createElement('div');
    holder.dataset.superchrome = 'instagram-grid-stats';
    const root = holder.attachShadow({mode: 'open'});
    const now = new Date(), sameYear = stats.takenAt?.getFullYear() === now.getFullYear();
    const date = stats.takenAt ? stats.takenAt.toLocaleString(undefined, {month: 'short', day: 'numeric', ...(sameYear ? {} : {year: 'numeric'}), hour: 'numeric', minute: '2-digit'}) : 'Date not shown';
    root.innerHTML = `<style>${GRID_CSS}</style><div class="chip"><span class="date"></span><span class="counts"></span></div>`;
    const dateEl = root.querySelector('.date');
    dateEl.textContent = date;
    if (stats.takenAt) { const small = document.createElement('span'); small.className = 'muted'; small.textContent = ` · ${ago(stats.takenAt)}`; dateEl.append(small); }
    const counts = root.querySelector('.counts');
    for (const [name, value] of [['plays', stats.video ? stats.plays : null], ['likes', stats.likes], ['comments', stats.comments]]) {
      if (value === null) continue;
      const span = document.createElement('span'); span.className = name; span.innerHTML = ICONS[name]; span.append(compact(value)); counts.append(span);
    }
    holder.title = text(stats);
    if (getComputedStyle(anchor).position === 'static') anchor.style.position = 'relative';
    anchor.append(holder);
    chips.add(holder);
  }
  function clearGrid() {
    for (const holder of chips) holder.remove();
    chips.clear(); queue.length = 0;
    for (const anchor of document.querySelectorAll('main a[href]')) tiles.delete(anchor);
  }
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    setTimeout(() => { scanQueued = false; scanGrid(); }, 300);
  }).observe(document.documentElement, {childList: true, subtree: true});
  chrome.storage?.local?.get({instagramGridStats: true}).then(settings => { gridEnabled = settings.instagramGridStats !== false; scanGrid(); }).catch(() => scanGrid());
})();
