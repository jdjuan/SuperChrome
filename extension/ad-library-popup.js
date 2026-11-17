(() => {
  const toggle = document.querySelector('#ad-library-enabled');
  const status = document.querySelector('#ad-library-status');
  let revision = 0;
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.adLibraryEnabled) {
      revision++;
      toggle.checked = changes.adLibraryEnabled.newValue !== false;
    }
  });
  const initialRevision = revision;
  chrome.storage.local.get({adLibraryEnabled:true}).then(settings => {
    if (revision === initialRevision) toggle.checked = settings.adLibraryEnabled !== false;
    toggle.disabled = false;
  }).catch(() => { status.textContent = 'Could not read settings. Reopen SuperChrome to try again.'; });
  toggle.addEventListener('change', async () => {
    const previous = !toggle.checked;
    toggle.disabled = true;
    try {
      await chrome.storage.local.set({adLibraryEnabled:toggle.checked});
      status.textContent = '';
    } catch (_) {
      toggle.checked = previous;
      status.textContent = 'Could not save. Try again.';
    } finally { toggle.disabled = false; }
  });
})();
