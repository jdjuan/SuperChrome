(() => {
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  const host = document.createElement('div');
  host.dataset.superchrome = 'instagram-images';
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `<style>
    :host { all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
    button { all: initial; box-sizing: border-box; position: fixed; width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid #606060; border-radius: 50%; background: #202020; color: #fff; cursor: pointer; pointer-events: auto; opacity: 1; font: 18px/1 system-ui; }
    button:hover, button:focus-visible { background: #383838; outline: 2px solid white; outline-offset: 2px; }
    button:disabled { cursor: wait; }
    .status { all: initial; box-sizing: border-box; position: fixed; max-width: 260px; padding: 7px 10px; border: 1px solid #606060; border-radius: 6px; background: #202020; color: #fff; font: 12px/1.4 system-ui; overflow-wrap: anywhere; pointer-events: none; }
    .status[hidden] { display: none; }
  </style>`;
  const buttons = new Map();
  let scheduled = false;
  let latestJob = null;
  const sourceFor = img => img.currentSrc || img.src;
  function videoUrl(video) {
    if (/^\/(?:[\w.]+\/)?(p|reel|reels)\/[^/]+/.test(location.pathname)) return location.href;
    const scope = video.closest('article') || video.closest('main') || document;
    const link = [...scope.querySelectorAll('a[href]')].find(a => /^\/(?:[\w.]+\/)?(p|reel|reels)\/[^/]+/.test(new URL(a.href).pathname));
    return link?.href || (/^\/(?:[\w.]+\/)?(p|reel|reels)\/[^/]+/.test(location.pathname) ? location.href : null);
  }
  const SHORTCODE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const fileName = value => { try { return new URL(value).pathname.split('/').pop(); } catch { return ''; } };
  async function instagramMedia(postUrl, selection = {}) {
    const code = new URL(postUrl).pathname.match(/^\/(?:[\w.]+\/)?(?:p|reels?|tv)\/([\w-]+)/)?.[1];
    if (!code) throw Error('Open this video’s post first.');
    let id = 0n;
    for (const char of code.slice(0, 11)) id = id * 64n + BigInt(SHORTCODE.indexOf(char));
    const response = await fetch(`/api/v1/media/${id}/info/`, {credentials: 'include', headers: {'X-IG-App-ID': '936619743392459', 'X-Requested-With': 'XMLHttpRequest'}});
    if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'Log in to Instagram to download this video.' : 'Instagram did not return this video.');
    const item = (await response.json()).items?.[0];
    if (!item) throw Error('Instagram did not return this video.');
    let entries = item.carousel_media?.length ? item.carousel_media : [item];
    if (selection.slide && entries.length > 1) {
      const poster = fileName(selection.poster);
      const matches = poster ? entries.filter(entry => entry.image_versions2?.candidates?.some(c => fileName(c.url) === poster)) : [];
      if (matches.length === 1) entries = matches;
      else if (entries.length === selection.slideCount && entries[selection.slide - 1]) entries = [entries[selection.slide - 1]];
      else throw Error('Could not safely identify this carousel slide. Open its individual post and retry.');
    }
    const urls = entries.map(entry => [...(entry.video_versions || [])].sort((a, b) => b.width * b.height - a.width * a.height)[0]?.url).filter(Boolean);
    if (!urls.length) throw Error('No video found in this post.');
    return urls.map((url, i) => ({url, filename: `instagram-${code}${urls.length > 1 ? `-${i + 1}` : ''}.mp4`}));
  }
  chrome.runtime?.onMessage?.addListener((message, sender, reply) => {
    if (message.action !== 'resolveInstagram') return;
    instagramMedia(message.url).then(media => reply({media}), error => reply({error: error.message}));
    return true;
  });
  function videoSelection(video) {
    const slide = video.closest('li');
    if (!slide) return {};
    const width = slide.getBoundingClientRect().width;
    const offset = element => Number(element.style.transform.match(/translateX\(([-\d.]+)px\)/)?.[1]);
    if (!width || !slide.style.transform.includes('translateX')) throw Error('Cannot identify this slide. Open its individual post.');
    const position = offset(slide) / width;
    if (!Number.isFinite(position) || Math.abs(position - Math.round(position)) > 0.02) throw Error('Cannot identify this slide.');
    const end = Math.max(...[...slide.parentElement.children].map(item => offset(item) + item.getBoundingClientRect().width));
    return {slide: Math.round(position) + 1, slideCount: Math.round(end / width), poster: video.poster || ''};
  }
  function showVideoStatus(button, job) {
    const done = typeof job.ok === 'boolean';
    button.disabled = !done;
    button.textContent = done ? (job.ok ? '✓' : '!') : '…';
    const raw = job.message || job.error || 'Downloading…';
    const percent = job.percent || raw.match(/\[download\]\s+(\d+(?:\.\d+)?%)/)?.[1];
    const message = done ? (job.ok ? 'Saved to Downloads' : `${raw}${job.needsHelper ? '' : ' Click to retry.'}`)
      : raw.includes('Preparing compatible') ? 'Preparing compatible MP4…'
      : raw.includes('already been downloaded') ? 'Video already exists. Checking MP4…'
      : percent ? `Downloading ${percent}` : 'Downloading…';
    button.title = message;
    button.status.textContent = message;
    button.status.hidden = false;
  }
  chrome.storage?.onChanged?.addListener((changes, area) => {
    const job = changes.job?.newValue;
    if (area !== 'local' || !job?.url) return;
    latestJob = job;
    for (const [media, button] of buttons) {
      if (media.tagName === 'VIDEO' && videoUrl(media) === job.url && (!job.slide || videoSelection(media).slide === job.slide)) showVideoStatus(button, job);
    }
  });
  async function save(img, button) {
    if (img.tagName === 'VIDEO') {
      showVideoStatus(button, {message: 'Starting download…'});
      try {
        const url = videoUrl(img);
        if (!url) throw Error('Open this video’s post first.');
        const selection = videoSelection(img);
        let media, directError;
        try { media = await instagramMedia(url, selection); } catch (error) { directError = error.message; }
        const result = await chrome.runtime.sendMessage({action: 'download', url, ...selection, media, directError});
        if (!result?.ok) throw Error(result?.error || 'Video helper unavailable.');
        // Native job updates report actual progress and completion.
      } catch (error) {
        showVideoStatus(button, {ok: false, message: error.message});
      }
      return;
    }
    button.disabled = true;
    button.textContent = '…';
    button.title = 'Downloading image…';
    let blobUrl;
    try {
      const source = new URL(sourceFor(img));
      if (source.protocol !== 'https:') throw Error('Invalid image URL');
      const response = await fetch(source.href, {credentials: 'omit'});
      if (!response.ok) throw Error('Image unavailable');
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw Error('Invalid image response');
      blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const extension = ({'image/png':'png','image/webp':'webp','image/avif':'avif'})[blob.type] || 'jpg';
      link.href = blobUrl;
      link.download = `instagram-${Date.now()}.${extension}`;
      shadow.append(link);
      link.click();
      link.remove();
      button.textContent = '✓';
      button.title = 'Image saved';
    } catch {
      button.textContent = '!';
      button.title = 'Could not save image. Click to retry.';
    } finally {
      button.disabled = false;
      if (blobUrl) setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    }
  }
  function reconcile() {
    scheduled = false;
    if (!host.isConnected) document.documentElement.append(host);
    const found = new Set();
    for (const img of document.querySelectorAll('article img, main img, video')) {
      if (!img.closest('article') && !/^\/(?:[\w.]+\/)?(p|reel|reels)\/[^/]+/.test(location.pathname)) continue;
      if (img.tagName === 'IMG' && img.parentElement?.querySelector('video')) continue;
      const kind = img.tagName === 'VIDEO' ? 'video' : 'image';
      const rect = img.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 180 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth || !img.getClientRects().length || getComputedStyle(img).visibility === 'hidden') continue;
      // Carousel slides outside their clipping container must not get controls.
      const x = Math.min(rect.right, innerWidth) - 22, y = Math.max(rect.top, 0) + 22;
      const hit = document.elementFromPoint?.(x, y);
      let media = img.closest('._aagu') || img.parentElement;
      if (kind === 'video') {
        // Instagram places its interaction surface beside deeply nested video wrappers.
        for (let parent = img.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
          const bounds = parent.getBoundingClientRect();
          if (Math.abs(bounds.width - rect.width) > 2 || Math.abs(bounds.height - rect.height) > 2) break;
          media = parent;
          if (hit && parent.contains(hit)) break;
        }
      }
      if (hit && hit !== host && hit !== img && !media.contains(hit)) continue;
      found.add(img);
      let button = buttons.get(img);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.textContent = '↓';
        button.title = `Download ${kind}`;
        button.setAttribute('aria-label', `Download Instagram ${kind}`);
        button.addEventListener('click', event => {event.preventDefault(); event.stopPropagation(); save(img, button);});
        const status = document.createElement('span');
        status.className = 'status';
        status.setAttribute('role', 'status');
        status.setAttribute('aria-live', 'polite');
        status.hidden = true;
        button.status = status;
        shadow.append(button, status);
        buttons.set(img, button);
        if (kind === 'video' && latestJob?.url === videoUrl(img) && (!latestJob.slide || videoSelection(img).slide === latestJob.slide)) showVideoStatus(button, latestJob);
      }
      button.style.left = `${x - 15}px`;
      button.style.top = `${y - 15}px`;
      button.status.style.left = `${Math.max(8, x - 245)}px`;
      button.status.style.top = `${y + 23}px`;
    }
    for (const [img, button] of buttons) if (!found.has(img)) {button.status.remove(); button.remove(); buttons.delete(img);}
  }
  function schedule() {
    if (!scheduled) {scheduled = true; requestAnimationFrame(reconcile);}
  }
  new MutationObserver(schedule).observe(document, {childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset', 'style', 'class']});
  addEventListener('scroll', schedule, true);
  addEventListener('resize', schedule);
  addEventListener('load', schedule, true);
  addEventListener('popstate', schedule);
  schedule();
})();
