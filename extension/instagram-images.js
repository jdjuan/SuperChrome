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
  </style>`;
  const buttons = new Map();
  let scheduled = false;
  const sourceFor = img => img.currentSrc || img.src;
  async function save(img, button) {
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
    for (const img of document.querySelectorAll('article img, main img')) {
      if (!img.closest('article') && !/^\/p\//.test(location.pathname)) continue;
      const rect = img.getBoundingClientRect();
      if (rect.width < 180 || rect.height < 180 || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth || !img.getClientRects().length || getComputedStyle(img).visibility === 'hidden') continue;
      // Carousel slides outside their clipping container must not get controls.
      const x = Math.min(rect.right, innerWidth) - 22, y = Math.max(rect.top, 0) + 22;
      const hit = document.elementFromPoint?.(x, y);
      if (hit && hit !== host && hit !== img && !img.parentElement.contains(hit)) continue;
      found.add(img);
      let button = buttons.get(img);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.textContent = '↓';
        button.title = 'Download image';
        button.setAttribute('aria-label', 'Download Instagram image');
        button.addEventListener('click', event => {event.preventDefault(); event.stopPropagation(); save(img, button);});
        shadow.append(button);
        buttons.set(img, button);
      }
      button.style.left = `${x - 15}px`;
      button.style.top = `${y - 15}px`;
    }
    for (const [img, button] of buttons) if (!found.has(img)) {button.remove(); buttons.delete(img);}
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
