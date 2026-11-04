(() => {
  if (!['youtube.com','www.youtube.com','m.youtube.com'].includes(location.hostname) || globalThis.superChromeYouTubeFocus) return;
  globalThis.superChromeYouTubeFocus = true;
  const defaults = {enabled:true,mode:'simple',feed:true,shorts:true,related:true};
  let settings = defaults, ready = false, style;
  const css = `
html[data-sc-youtube-feed] ytd-browse[page-subtype="home"],
html[data-sc-youtube-feed] ytm-browse[tab-identifier="FEwhat_to_watch"],
html[data-sc-youtube-shorts] :is(ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytd-reel-item-renderer, ytd-rich-item-renderer:has(ytm-shorts-lockup-view-model), ytd-rich-item-renderer:has(a[href^="/shorts/"]), ytd-video-renderer:has(a[href^="/shorts/"]), ytm-shorts-lockup-view-model, ytm-reel-shelf-renderer),
html[data-sc-youtube-shorts] :is(ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, ytm-pivot-bar-item-renderer):has(a[href^="/shorts"]),
html[data-sc-youtube-related] ytd-watch-flexy #related,
html[data-sc-youtube-related] ytm-watch :is(ytm-watch-next-secondary-results-renderer, ytm-item-section-renderer[section-identifier="related-items"])
{display:none!important}
`;
  function update() {
    const root = document.documentElement;
    if (!root) return;
    if (!style?.isConnected) {
      style = document.createElement('style');style.dataset.superchrome = 'youtube-focus';style.textContent = css;root.append(style);
    }
    for (const key of ['feed','shorts','related']) root.toggleAttribute('data-sc-youtube-'+key,
      ready && settings.enabled !== false && (settings.mode !== 'custom' || settings[key] !== false));
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.youtubeFocus) return;
    ready = true;settings = {...defaults,...changes.youtubeFocus.newValue};update();
  });
  chrome.storage.local.get({youtubeFocus:defaults}).then(value => {
    if (ready) return;
    ready = true;settings = {...defaults,...value.youtubeFocus};update();
  }).catch(() => {});
  // Root gates and CSS track YouTube's dynamic shelves and SPA routes without
  // altering videos, navigation, editors, or serializable site markup.
  new MutationObserver(() => { if (ready && !style?.isConnected) update(); }).observe(document,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded', update, {once:true});
})();
