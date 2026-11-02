(() => {
  // Use the browser's top-frame URL so protection also reaches foreign players.
  let revision = 0;
  const sync = async () => {
    const current = ++revision;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'guardState' });
      if (current === revision && response) document.dispatchEvent(new CustomEvent('__cuevana_guard_state', { detail: response.enabled }));
    } catch { /* Reload the page after updating the extension. */ }
  };
  sync();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.enabled || changes.sites)) sync();
  });
})();
