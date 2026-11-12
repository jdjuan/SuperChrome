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
  });
})();
