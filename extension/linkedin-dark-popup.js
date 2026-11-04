(() => {
  const toggle = document.querySelector('#linkedin-dark-mode'), status = document.querySelector('#linkedin-dark-status');
  let saving = false;
  chrome.storage.local.get({linkedinDarkMode:true}).then(settings => {
    toggle.checked = settings.linkedinDarkMode !== false; toggle.disabled = false;
  }).catch(() => { status.textContent = 'Could not read LinkedIn appearance. Reopen SuperChrome to retry.'; });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.linkedinDarkMode && !saving) toggle.checked = changes.linkedinDarkMode.newValue !== false;
  });
  toggle.addEventListener('change', async () => {
    saving = true; toggle.disabled = true;
    try { await chrome.storage.local.set({linkedinDarkMode:toggle.checked}); status.textContent = ''; }
    catch { toggle.checked = !toggle.checked; status.textContent = 'Could not save. Try again.'; }
    finally { saving = false; toggle.disabled = false; }
  });
})();
