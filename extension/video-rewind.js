// Run before site shortcuts in the page world, including Netflix's player API.
(() => {
  'use strict';
  const netflix = /(^|\.)netflix\.com$/.test(location.hostname);
  function rewind(event) {
    if (event.key !== 'ArrowLeft' || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    if (netflix ? !/^\/watch\//.test(location.pathname) : !/^\/(watch|shorts\/)/.test(location.pathname)) return;
    const path = event.composedPath();
    if (path.some(node => node instanceof Element && (node.matches('input,textarea,select,[role="textbox"],[role="combobox"],[role="menu"],[role="listbox"],[role="dialog"],[aria-modal="true"]') || node.isContentEditable))) return;
    const videos = [...document.querySelectorAll('video')].filter(video => {
      const rect = video.getBoundingClientRect();
      return video.readyState >= 1 && rect.width > 0 && rect.height > 0 && getComputedStyle(video).visibility !== 'hidden' && Number.isFinite(video.currentTime);
    }).sort((a, b) => b.getBoundingClientRect().width * b.getBoundingClientRect().height - a.getBoundingClientRect().width * a.getBoundingClientRect().height);
    const video = videos[0];
    if (!video) return;
    try {
      let handled = false;
      if (netflix) {
        // Netflix manages its own media timeline; use its seek API when available.
        try {
          const api = window.netflix?.appContext?.state?.playerApp?.getAPI()?.videoPlayer;
          const ids = api?.getAllPlayerSessionIds();
          const id = ids?.find(id => String(id).startsWith('watch-')) || (ids?.length === 1 ? ids[0] : null);
          const player = id != null ? api.getVideoPlayerBySessionId(id) : null;
          const time = player?.getCurrentTime();
          if (Number.isFinite(time) && typeof player.seek === 'function') {
            player.seek(Math.max(0, time - 5000));
            handled = true;
          }
        } catch (_) { /* Fall back to the standard media timeline. */ }
      }
      if (!handled) {
        let start = 0;
        if (video.seekable.length) start = video.seekable.start(0);
        video.currentTime = Math.max(start, video.currentTime - 5);
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    } catch (_) { /* Leave the native shortcut available if seeking fails. */ }
  }
  window.addEventListener('keydown', rewind, true);
})();
