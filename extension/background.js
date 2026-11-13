importScripts('policy.js');
async function stateFor(tabId) {
  const [top, settings] = await Promise.all([
    chrome.webNavigation.getFrame({ tabId, frameId: 0 }),
    chrome.storage.local.get({ enabled: true, sites: {} })
  ]);
  const host = guardPolicy.hostname(top?.url);
  return { host, enabled: guardPolicy.enabledFor(host, settings) };
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (message.type !== 'guardState' || sender.tab?.id == null) return;
  stateFor(sender.tab.id).then(respond, () => respond({ enabled: false }));
  return true;
});
chrome.webNavigation.onCreatedNavigationTarget.addListener(async details => {
  try {
    if ((await stateFor(details.sourceTabId)).enabled) await chrome.tabs.remove(details.tabId);
  } catch { /* The source or target tab may already have closed. */ }
});

importScripts('download-background.js');
importScripts('hide-background.js');

importScripts('youtube-recovery-background.js');

importScripts('self-update-background.js');
