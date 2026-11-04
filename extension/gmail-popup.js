(() => {
  const toggle = document.querySelector('#gmail-dark-mode'), status = document.querySelector('#gmail-dark-status');
  let saving = false;
  chrome.storage.local.get({gmailDarkMode:true}).then(settings => {
    toggle.checked = settings.gmailDarkMode !== false; toggle.disabled = false;
  }).catch(() => { status.textContent = 'Could not read Gmail appearance. Reopen SuperChrome to retry.'; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.gmailDarkMode && !saving) toggle.checked = changes.gmailDarkMode.newValue !== false;
  });
  toggle.addEventListener('change', async () => {
    saving = true; toggle.disabled = true;
    try { await chrome.storage.local.set({gmailDarkMode:toggle.checked}); status.textContent = ''; }
    catch { toggle.checked = !toggle.checked; status.textContent = 'Could not save. Try again.'; }
    finally { saving = false; toggle.disabled = false; }
  });
})();
