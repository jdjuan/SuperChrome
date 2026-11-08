(() => {
  const toggle = document.querySelector('#video-rewind-enabled');
  const status = document.querySelector('#video-rewind-status');
  let revision = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.videoRewindEnabled) {
      revision++;
      toggle.checked = changes.videoRewindEnabled.newValue !== false;
    }
  });
  const initialRevision = revision;
  chrome.storage.local.get({videoRewindEnabled:true}).then(settings => {
    if (revision === initialRevision) toggle.checked = settings.videoRewindEnabled !== false;
    toggle.disabled = false;
  }).catch(() => { status.textContent = 'Could not read settings. Reopen SuperChrome to try again.'; });
  toggle.addEventListener('change', async () => {
    const previous = !toggle.checked;
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({videoRewindEnabled:toggle.checked});
      status.textContent = '';
    } catch (_) {
      toggle.checked = previous;
      status.textContent = 'Could not save. Try again.';
    } finally { toggle.disabled = false; }
  });
})();
