(() => {
  const toggle = document.querySelector('#instagram-stats-enabled');
  const status = document.querySelector('#instagram-stats-status');
  let revision = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.instagramStats) {
      revision++;
      toggle.checked = changes.instagramStats.newValue !== false;
    }
  });
  const initialRevision = revision;
  chrome.storage.local.get({instagramStats:true}).then(settings => {
    if (revision === initialRevision) toggle.checked = settings.instagramStats !== false;
    toggle.disabled = false;
  }).catch(() => { status.textContent = 'Could not read settings. Reopen SuperChrome to try again.'; });
  toggle.addEventListener('change', async () => {
    const previous = !toggle.checked;
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({instagramStats:toggle.checked});
      status.textContent = '';
    } catch (_) {
      toggle.checked = previous;
      status.textContent = 'Could not save. Try again.';
    } finally { toggle.disabled = false; }
  });
})();
