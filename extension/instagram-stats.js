// Shows the upload date and views, likes, comments, sends and saves for Instagram posts, reels and profile grids.
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
  const METRICS = [['views', 'Views'], ['likes', 'Likes'], ['comments', 'Comments'], ['sends', 'Sends'], ['saves', 'Saves']];
  const ownUserId = () => document.cookie.match(/(?:^|;\s*)ds_user_id=(\d+)/)?.[1] || null;
  // Saves (and photo views) only exist in Insights, which Instagram shows to a post's owner.
  // That GraphQL query needs the page's request tokens; if anything changes, saves are simply omitted.
  const INSIGHTS_DOC = '28788577777468595';
  let tokens = null;
  function pageTokens() {
    if (tokens) return tokens;
    let dtsg, lsd;
    for (const script of document.scripts) {
      const source = script.textContent;
      if (!source || source.length < 20) continue;
      dtsg ||= source.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"/)?.[1];
      lsd ||= source.match(/"LSD",\[\],\{"token":"([^"]+)"/)?.[1];
      if (dtsg && lsd) return tokens = {dtsg, lsd};
    }
    return null;
  }
  async function fetchInsights(id) {
    const auth = pageTokens();
    if (!auth) return null;
    const body = new URLSearchParams({doc_id: INSIGHTS_DOC, fb_api_req_friendly_name: 'PolarisMediaInsightsBaseSurfaceQuery', variables: JSON.stringify({boosted_id: null, is_creator_viewing_insights: true, is_fvob_eligible: false, query_params: {access_token: '', id}}), lsd: auth.lsd, fb_dtsg: auth.dtsg});
    const response = await fetch('/api/graphql', {method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/x-www-form-urlencoded', 'X-IG-App-ID': APP_ID, 'X-FB-LSD': auth.lsd}, body});
    if (!response.ok) return null;
    const media = (await response.json())?.data?.media;
    const value = key => number(media?.[key]?.value?.results?.[0]?.total_value);
    return media ? {saves: value('umapi_saves_count'), views: value('umapi_unified_total_content_views_count'), sends: value('umapi_reshares_count')} : null;
  }
  async function fetchStats(shortcode) {
    if (cache.has(shortcode)) return cache.get(shortcode);
    const id = mediaId(shortcode);
    if (!id) throw Error('Unrecognized Instagram link.');
    const request = fetch(`/api/v1/media/${id}/info/`, {credentials: 'include', headers: {'X-IG-App-ID': APP_ID, 'X-Requested-With': 'XMLHttpRequest'}}).then(async response => {
      if (response.status === 401 || response.status === 403) throw Error('Sign in to Instagram to see stats.');
      if (!response.ok) throw Error(`Instagram did not return stats (${response.status}).`);
      const item = (await response.json())?.items?.[0];
      if (!item) throw Error('Instagram did not return stats for this post.');
      const video = item.media_type === 2 || Boolean(item.video_versions);
      const owner = String(item.user?.pk ?? item.owner?.pk ?? '');
      const own = Boolean(owner) && owner === ownUserId();
      const insights = own ? await fetchInsights(String(item.pk || id)).catch(() => null) : null;
      return {
        shortcode, own, video,
        takenAt: number(item.taken_at) ? new Date(item.taken_at * 1000) : null,
        views: (video ? number(item.play_count ?? item.ig_play_count ?? item.view_count ?? item.video_view_count) : null) ?? insights?.views ?? null,
        likes: number(item.like_count),
        comments: number(item.comment_count),
        sends: number(item.reshare_count) ?? insights?.sends ?? null,
        saves: insights?.saves ?? null,
        duration: number(item.video_duration)
      };
    });
    cache.set(shortcode, request);
    request.catch(() => cache.delete(shortcode));
    return request;
  }
  const compact = value => value === null ? '—' : new Intl.NumberFormat(undefined, {notation: 'compact', maximumFractionDigits: 1}).format(value);
  const exact = value => value === null ? 'Not shown' : new Intl.NumberFormat().format(value);
  // Date only, day first ("15 Oct"); the year appears for older posts.
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const formatDate = (date, withYear = false) => date ? `${date.getDate()} ${MONTHS[date.getMonth()]}${withYear || date.getFullYear() !== new Date().getFullYear() ? ' ' + date.getFullYear() : ''}` : 'Date not shown';
  function text(stats) {
    const lines = [`Date: ${formatDate(stats.takenAt, true)}`];
    for (const [key, label] of METRICS) if (stats[key] !== null) lines.push(`${label}: ${exact(stats[key])}`);
    if (stats.saves === null) lines.push('Saves: only shown on your own posts');
    return lines.join('\n');
  }
  globalThis.SuperChromeInstagramStats = {shortcodeOf, mediaId, fetchStats, text, compact, formatDate};
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
    .counts { display: flex; flex-wrap: wrap; column-gap: 12px; row-gap: 2px; white-space: nowrap; color: var(--sc-text, #182238); }
    .counts > span { display: inline-flex; align-items: center; gap: 4px; }
    .counts small { font-weight: 500; font-size: 12px; color: var(--sc-muted, #526078); }
    svg { width: 13px; height: 13px; flex: none; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
    .sep { width: 1px; align-self: stretch; background: var(--sc-border, #bdc8da); }
    button { all: initial; box-sizing: border-box; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 50%; cursor: pointer; font: 15px/1 system-ui; }
    .msg { font-weight: 500; color: var(--sc-muted, #526078); }
  </style><div class="bar" role="status" aria-live="polite" hidden><span class="when"></span><span class="sep"></span><span class="counts"><span class="views"></span><span class="likes"></span><span class="comments"></span><span class="sends"></span><span class="saves"></span></span><button class="close" type="button" aria-label="Hide stats for this post" title="Hide for this post">×</button></div>`;
  globalThis.SuperChromeTheme?.attach(host, shadow);
  const $ = selector => shadow.querySelector(selector);
  const bar = $('.bar');
  let enabled = true, current = null, dismissed = null, token = 0;
  function mount() { const parent = document.body || document.documentElement; if (parent && host.parentNode !== parent) parent.append(host); }
  function hide() { bar.hidden = true; }
  const ICONS = {
    views: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    likes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    comments: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z"/></svg>',
    sends: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/></svg>',
    saves: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12v18l-6-4.5L6 21z"/></svg>'
  };
  // One metric: icon, compact number, then its word, so each value is unambiguous.
  function metric(el, key, label, value) {
    el.hidden = value === null;
    el.innerHTML = ICONS[key];
    const strong = document.createElement('b'); strong.textContent = compact(value);
    const small = document.createElement('small'); small.textContent = label.toLowerCase();
    el.append(strong, small);
    el.title = `${label}: ${exact(value)}`;
  }
  function render(stats) {
    const when = $('.when');
    when.textContent = formatDate(stats.takenAt);
    when.title = stats.takenAt ? stats.takenAt.toLocaleDateString(undefined, {dateStyle: 'full'}) : '';
    $('.sep').hidden = false;
    $('.counts').hidden = false;
    for (const [key, label] of METRICS) metric($('.' + key), key, label, stats[key]);
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

  // Grid chips: upload date and counts on every visible tile of profile, Reels-tab, tagged and saved grids.
  // Chips sit on top of photos, so they own a dark scrim (worst case over white still exceeds 4.5:1).
  let gridEnabled = true, rateLimitedUntil = 0, active = 0, scanQueued = false;
  const tiles = new WeakSet(), queue = [], chips = new Set();
  const GRID_CSS = `:host { all: initial; position: absolute; top: 6px; left: 6px; z-index: 2; pointer-events: none; max-width: calc(100% - 44px); }
    .chip { box-sizing: border-box; display: grid; gap: 3px; min-width: 118px; padding: 6px 9px 7px; border-radius: 9px; background: rgb(0 0 0 / .76); color: #fff; font: 500 11.5px/1.3 system-ui, -apple-system, sans-serif; text-shadow: none; }
    .date { font-weight: 700; font-size: 12.5px; white-space: nowrap; padding-bottom: 3px; margin-bottom: 1px; border-bottom: 1px solid rgb(255 255 255 / .25); }
    .row { display: grid; grid-template-columns: 12px 1fr auto; align-items: center; column-gap: 6px; white-space: nowrap; }
    .row b { font-weight: 700; text-align: right; }
    svg { width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }`;
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
    root.innerHTML = `<style>${GRID_CSS}</style><div class="chip"><span class="date"></span></div>`;
    const box = root.querySelector('.chip');
    root.querySelector('.date').textContent = formatDate(stats.takenAt);
    for (const [key, label] of METRICS) {
      if (stats[key] === null) continue;
      const row = document.createElement('span'); row.className = 'row ' + key; row.innerHTML = ICONS[key];
      const name = document.createElement('span'); name.textContent = label;
      const value = document.createElement('b'); value.textContent = compact(stats[key]);
      row.append(name, value); box.append(row);
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
