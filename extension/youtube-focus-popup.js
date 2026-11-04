(() => {
  const defaults = {enabled:true,mode:'simple',feed:true,shorts:true,related:true};
  const section = document.querySelector('#youtube-focus-controls'), status = document.querySelector('#youtube-focus-status');
  const enabled = document.querySelector('#youtube-focus-enabled'), mode = document.querySelector('#youtube-focus-mode');
  const custom = document.querySelector('#youtube-focus-custom');
  const choices = Object.fromEntries(['feed','shorts','related'].map(key => [key,document.querySelector('#youtube-hide-'+key)]));
  const buttons = [...document.querySelectorAll('[data-youtube-mode]')];
  const controls = [enabled,mode,...Object.values(choices)];
  let settings = defaults, ready = false, saving = false;
  function render() {
    enabled.checked = settings.enabled !== false;mode.value = settings.mode === 'custom' ? 'custom' : 'simple';
    custom.hidden = mode.value !== 'custom';
    document.querySelector('#youtube-focus-options').hidden = !enabled.checked;
    document.querySelector('#youtube-simple-summary').hidden = mode.value === 'custom';
    for (const button of buttons) {button.setAttribute('aria-pressed',String(button.dataset.youtubeMode === mode.value));button.disabled = !ready || saving;}
    for (const [key,input] of Object.entries(choices)) input.checked = settings[key] !== false;
    for (const input of controls) input.disabled = !ready || saving;
  }
  chrome.storage.onChanged.addListener((changes,area) => {
    if (area === 'local' && changes.youtubeFocus) {ready = true;settings = {...defaults,...changes.youtubeFocus.newValue};render();}
  });
  chrome.storage.local.get({youtubeFocus:defaults}).then(value => {
    if (ready) return;
    ready = true;settings = {...defaults,...value.youtubeFocus};render();
  }).catch(() => {status.textContent = 'Could not read YouTube settings. Reopen SuperChrome to retry.';});
  for (const input of controls) input.addEventListener('change',async () => {
    const previous = settings;
    settings = {enabled:enabled.checked,mode:mode.value,...Object.fromEntries(Object.entries(choices).map(([key,choice]) => [key,choice.checked]))};
    saving = true;render();
    try {await chrome.storage.local.set({youtubeFocus:settings});status.textContent = '';}
    catch {settings = previous;status.textContent = 'Could not save. Try again.';}
    finally {saving = false;render();}
  });
  for (const button of buttons) button.addEventListener('click',() => {mode.value = button.dataset.youtubeMode;mode.dispatchEvent(new Event('change'));});
  section.hidden = false;
})();
