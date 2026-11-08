(() => {
  let enabled = true, revision = 0;
  const publish = () => document.dispatchEvent(new CustomEvent('__superchrome_rewind_state', {detail: enabled}));
  document.addEventListener('__superchrome_rewind_ready', publish);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.videoRewindEnabled) return;
    revision++;
    enabled = changes.videoRewindEnabled.newValue !== false;
    publish();
  });
  const initialRevision = revision;
  chrome.storage.local.get({videoRewindEnabled:true}).then(settings => {
    if (revision !== initialRevision) return;
    enabled = settings.videoRewindEnabled !== false;
    publish();
  }).catch(() => {});
})();
