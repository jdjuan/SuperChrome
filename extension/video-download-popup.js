// On/off switches for the in-page download buttons (Instagram, YouTube, X).
(() => {
  for (const [key, toggleId, statusId] of [
    ['instagramDownloadButton', '#instagram-download-button', '#instagram-download-status'],
    ['youtubeDownloadButton', '#youtube-download-button', '#youtube-download-status'],
    ['xDownloadButton', '#x-download-button', '#x-download-status']
  ]) {
    const toggle = document.querySelector(toggleId), status = document.querySelector(statusId);
    if (!toggle) continue;
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
      catch { toggle.checked = previous; status.textContent = 'Could not save. Try again.'; }
      finally { toggle.disabled = false; }
    });
  }
})();
