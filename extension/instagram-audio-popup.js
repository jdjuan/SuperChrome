(() => {
  const toggle = document.querySelector('#instagram-audio-enabled');
  const status = document.querySelector('#instagram-audio-status');
  let revision = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.instagramAutoUnmute) {
      revision++;
      toggle.checked = changes.instagramAutoUnmute.newValue !== false;
    }
  });
  const initialRevision = revision;
  chrome.storage.local.get({instagramAutoUnmute:true}).then(settings => {
    if (revision === initialRevision) toggle.checked = settings.instagramAutoUnmute !== false;
    toggle.disabled = false;
  }).catch(() => { status.textContent = 'Could not read settings. Reopen SuperChrome to try again.'; });
  toggle.addEventListener('change', async () => {
    const previous = !toggle.checked;
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({instagramAutoUnmute:toggle.checked});
      status.textContent = '';
    } catch (_) {
      toggle.checked = previous;
      status.textContent = 'Could not save. Try again.';
    } finally { toggle.disabled = false; }
  });
})();
