(() => {
  const status = document.querySelector('#instagram-stats-status');
  for (const [id, key] of [['#instagram-stats-enabled', 'instagramStats'], ['#instagram-grid-stats-enabled', 'instagramGridStats']]) {
    const toggle = document.querySelector(id);
    let revision = 0;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[key]) { revision++; toggle.checked = changes[key].newValue !== false; }
    });
    const initialRevision = revision;
    chrome.storage.local.get({[key]: true}).then(settings => {
      if (revision === initialRevision) toggle.checked = settings[key] !== false;
      toggle.disabled = false;
    }).catch(() => { status.textContent = 'Could not read settings. Reopen SuperChrome to try again.'; });
    toggle.addEventListener('change', async () => {
      const previous = !toggle.checked;
      toggle.disabled = true;
      try { await chrome.storage.local.set({[key]: toggle.checked}); status.textContent = ''; }
      catch (_) { toggle.checked = previous; status.textContent = 'Could not save. Try again.'; }
      finally { toggle.disabled = false; }
    });
  }
})();
