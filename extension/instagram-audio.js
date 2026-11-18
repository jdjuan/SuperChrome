// Start each Instagram video with sound, without fighting a later manual mute.
(() => {
  if (!/(^|\.)instagram\.com$/.test(location.hostname)) return;
  let enabled = false, revision = 0;
  let handled = new WeakMap();
  function unmute(video) {
    if (!enabled || document.hidden || !(video instanceof HTMLVideoElement) || video.paused || video.ended) return;
    // Chrome requires a page interaction before audible autoplay. Leave muted
    // autoplay running until that first click instead of making Chrome pause it.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    const source = video.currentSrc || video.src || video.querySelector('source')?.src || '';
    if (handled.get(video) === source) return;
    const rect = video.getBoundingClientRect();
    if (!rect.width || !rect.height || rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth) return;
    handled.set(video, source);
    // Use Instagram's own control so its React audio preference stays in sync.
    // Limit the search to this player's shell, never a neighboring reel.
    let shell = video.parentElement;
    for (let depth = 0; shell && depth < 12; depth++, shell = shell.parentElement) {
      if (shell.querySelectorAll('video').length !== 1) break;
      const icon = shell.querySelector('svg[aria-label="Audio is muted"]');
      const control = icon?.closest('button, [role="button"]');
      if (control) { control.click(); break; }
    }
    video.muted = false;
    if (video.volume === 0) video.volume = 1;
  }
  function scan() { document.querySelectorAll('video').forEach(unmute); }
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; scan(); });
  }
  for (const event of ['play', 'playing', 'loadeddata']) document.addEventListener(event, schedule, true);
  // Catch players that become visible during Instagram navigation.
  document.addEventListener('click', schedule, true);
  document.addEventListener('visibilitychange', scan);
  new MutationObserver(schedule).observe(document, {childList:true, subtree:true, attributes:true, attributeFilter:['src']});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.instagramAutoUnmute) return;
    revision++;
    enabled = changes.instagramAutoUnmute.newValue !== false;
    if (enabled) { handled = new WeakMap(); scan(); }
  });
  const initialRevision = revision;
  chrome.storage.local.get({instagramAutoUnmute:true}).then(settings => {
    if (revision === initialRevision) enabled = settings.instagramAutoUnmute !== false;
    scan();
  }).catch(() => { if (revision === initialRevision) enabled = false; });
})();
