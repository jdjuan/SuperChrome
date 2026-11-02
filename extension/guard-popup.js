(() => {
const root=document.querySelector('#guard-panel'); const find=id=>root.querySelector('#'+id);
const site = find('site');
const globalToggle = find('enabled');
const status = find('guard-status');
const reload = find('reload');
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const settings = await chrome.storage.local.get({ enabled: true, sites: {} });
  const host = guardPolicy.hostname(tab?.url);
  find('host').textContent = host || 'Open a website to enable protection.';
  globalToggle.checked = settings.enabled !== false;
  globalToggle.disabled = false;
  site.checked = host && (Object.hasOwn(settings.sites, host) ? settings.sites[host] : guardPolicy.defaultFor(host));
  site.disabled = !host;
  reload.disabled = !host;
  site.addEventListener('change', async () => {
    const { sites = {} } = await chrome.storage.local.get('sites');
    sites[host] = site.checked;
    await chrome.storage.local.set({ sites });
    status.textContent = site.checked ? 'Saved. Reload page.' : 'Off for this site.';
  });
  globalToggle.addEventListener('change', async () => {
    await chrome.storage.local.set({ enabled: globalToggle.checked });
    status.textContent = globalToggle.checked ? 'Enabled.' : 'Paused.';
  });
  reload.addEventListener('click', () => chrome.tabs.reload(tab.id));
})().catch(() => { status.textContent = 'Could not read this tab. Close and reopen this panel.'; });

})();
