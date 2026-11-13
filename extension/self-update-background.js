// After an AI replaces SuperChrome's files in place, finish the update without a click.
// An unpacked extension serves its files from disk, so a newer manifest there means new
// files are installed but the old version is still running. Browsers block tools from
// pressing Reload on chrome://extensions, but an extension may reload itself.
(() => {
  const running = chrome.runtime.getManifest().version;
  let lastCheck = 0, reloading = false;
  async function diskVersion() {
    try { return (await (await fetch(chrome.runtime.getURL('manifest.json'), { cache: 'no-store' })).json()).version || null; }
    catch { return null; } // Half-written or missing manifest: try again later.
  }
  async function checkForInstalledUpdate() {
    if (reloading || Date.now() - lastCheck < 3000) return;
    lastCheck = Date.now();
    const version = await diskVersion();
    if (!version || version === running) return;
    reloading = true;
    // Give a file copy still in progress a moment, then confirm before reloading.
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (await diskVersion() === version) chrome.runtime.reload();
    else reloading = false;
  }
  globalThis.checkForInstalledUpdate = checkForInstalledUpdate;
  chrome.windows.onFocusChanged.addListener(id => { if (id !== chrome.windows.WINDOW_ID_NONE) checkForInstalledUpdate(); });
  chrome.tabs.onActivated.addListener(checkForInstalledUpdate);
  chrome.webNavigation.onCommitted.addListener(details => { if (details.frameId === 0) checkForInstalledUpdate(); });
  checkForInstalledUpdate();
})();
