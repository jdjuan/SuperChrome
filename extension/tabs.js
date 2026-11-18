(() => {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const shared = document.getElementById('shared-tools');
  const tools = [...shared.children];
  let currentApp = 'tools';

  function select(tab) {
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    // Move the original controls so listeners, entered URLs and job status survive tab changes.
    for (const tool of tools) {
      const destination = panel.querySelector(`[data-tool-slot="${tool.id}"]`) || shared;
      if (tool.parentElement !== destination) destination.append(tool);
      if (tool.classList.contains('video-actions')) {
        tool.hidden = destination === shared ||
          (panel.id !== 'tools-app' && panel.id !== currentApp + '-app');
        tool.dispatchEvent(new Event('appchange'));
      }
    }
    for (const item of tabs) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
      document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
    }
  }

  let chosen = false;
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      chosen = true;
      select(tab);
    });
    tab.addEventListener('keydown', event => {
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (index + 1) % tabs.length;
      if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      chosen = true;
      select(tabs[next]);
      tabs[next].focus();
    });
  });

  function appFor(url) {
    const host = new URL(url).hostname;
    if (host === 'mail.google.com') return 'gmail';
    if (/(^|\.)(x\.com|twitter\.com)$/.test(host)) return 'x';
    if (host === 'youtu.be') return 'youtube';
    return host.match(/(?:^|\.)(instagram|youtube|linkedin|facebook|netflix)\.com$/)?.[1] || 'tools';
  }

  select(document.getElementById('tools-tab'));
  chrome.tabs.query({active:true, currentWindow:true}, ([tab]) => {
    try { currentApp = appFor(tab?.url); } catch {}
    select(chosen ? tabs.find(tab => tab.getAttribute('aria-selected') === 'true') : document.getElementById(currentApp + '-tab'));
  });
})();
