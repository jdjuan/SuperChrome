(() => {
  if (!['linkedin.com','www.linkedin.com'].includes(location.hostname) || globalThis.superChromeLinkedInDark) return;
  globalThis.superChromeLinkedInDark = true;
  const active = 'data-sc-linkedin-dark', prefix = 'data-sc-linkedin-';
  const editor = '[contenteditable]:not([contenteditable="false"]),[role="textbox"]';
  const excluded = 'script,style,link,meta,img,picture,video,canvas,iframe';
  let ready = false, enabled = false;
  const pending = new Set();
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let followSystem = true;
  function syncTheme() {
    enabled = ready && followSystem && systemTheme.matches;
    update();
  }
  systemTheme.addEventListener('change', syncTheme);

  const shadows = new Map();
  // LinkedIn renders its legacy messaging UI inside this open shadow boundary.
  // Scope our own small stylesheet there; never copy LinkedIn's large site CSS.
  const scope = ':host([data-sc-linkedin-dark])';
  const shadowCSS = [
    `${scope}{color-scheme:dark}`,
    ...Object.entries({base:'#17191c',surface:'#202124',raised:'#292c31',accent:'#33496b'}).map(([key,value]) => `${scope} [data-sc-linkedin-bg="${key}"]{background-color:${value}!important}`),
    `${scope} [data-sc-linkedin-bg]{border-color:#65748c!important}`,
    ...Object.entries({text:'#e8eaed',muted:'#bdc1c6',link:'#aecbfa'}).map(([key,value]) => `${scope} [data-sc-linkedin-fg="${key}"]{color:${value}!important}`),
    `${scope} [data-sc-linkedin-fill="icon"]{fill:#bdc1c6!important}`,
    `${scope} [data-sc-linkedin-stroke="icon"]{stroke:#bdc1c6!important}`,
    `${scope} :is(input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]),${scope} :is([contenteditable]:not([contenteditable="false"]),[role="textbox"]) *:not(img,picture,video,svg,svg *){color:#e8eaed!important;background-color:#202124!important;caret-color:#e8eaed}`,
    `${scope} input::placeholder,${scope} textarea::placeholder{color:#bdc1c6!important;opacity:1}`,
    `${scope} :is(button,[role="button"],a,input,textarea,select):focus-visible{outline:2px solid #aecbfa!important;outline-offset:2px}`
  ].join('\n');

  function connectMessaging() {
    for (const [host, entry] of shadows) if (!host.isConnected) { entry.observer.disconnect(); shadows.delete(host); }
    const host = document.querySelector('#interop-outlet'), root = host?.shadowRoot;
    if (!root) return;
    const existing = shadows.get(host);
    if (existing) {
      if (!existing.style.isConnected) { root.append(existing.style); pending.add(root); }
      return;
    }
    const style = document.createElement('style');style.dataset.scLinkedinStyle = '';style.textContent = shadowCSS;root.append(style);
    const observer = new MutationObserver(onMutations);
    observer.observe(root, observerOptions);
    shadows.set(host, {root,observer,style});pending.add(root);
  }

  function rgb(value) {
    const parts = value.match(/[\d.]+/g)?.map(Number);
    return parts?.length >= 3 ? parts : null;
  }
  function neutral(color) { return Math.max(...color.slice(0,3))-Math.min(...color.slice(0,3)) < 35; }
  function mark(element, suffix, value) {
    if (writes) { writes.push([element,suffix,value]); return; }
    const attribute = prefix + suffix;
    if (value) { if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value); }
    else if (element.hasAttribute(attribute)) element.removeAttribute(attribute);
  }
  let writes;
  function classify(element) {
    // Preserve photos, editable post/message markup and our
    // own shadow-root UI. Editors receive paired colors from the stylesheet.
    if (element.matches(excluded) || element.closest(editor) || element.closest('[data-superchrome]') || element.closest('video,canvas')) {
      for (const suffix of ['bg','fg','fill','stroke']) mark(element, suffix, null);
      return;
    }
    const style = getComputedStyle(element);
    if (element.matches('svg,svg *')) {
      for (const property of ['fill','stroke']) {
        const color = rgb(style[property]);
        mark(element, property, color && neutral(color) ? 'icon' : null);
      }
      return;
    }
    const background = rgb(style.backgroundColor), color = rgb(style.color);
    let surface;
    if (background && (background[3] ?? 1) > 0) {
      const light = (background[0]+background[1]+background[2])/3;
      surface = !neutral(background) ? 'accent' : light > 248 ? 'surface' : light > 220 ? 'raised' : 'base';
    }
    mark(element, 'bg', surface);
    const muted = color && neutral(color) && color[0] > 70 && color[0] < 180;
    mark(element, 'fg', element.matches('a[href]') ? 'link' : muted ? 'muted' : 'text');
  }
  function refreshOverlays() {
    for (const host of document.querySelectorAll('[data-superchrome]')) globalThis.SuperChromeTheme?.apply(host);
  }
  const remaining = new Set();
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; flush(); }, 0);
  }
  function flush() {
    if (!enabled || !document.documentElement) return;
    connectMessaging();
    // Read the site's original colors, then restore our gate in the same task.
    // Each bounded task restores the gate before yielding; baseline CSS covers new panels.
    document.documentElement.removeAttribute(active);
    for (const host of shadows.keys()) host.removeAttribute(active);
    writes = [];
    try {
      // Drain a bounded batch and yield to input/navigation between batches.
      const roots = new Set(pending); pending.clear();
      const elements = new Set(remaining); remaining.clear();
      for (const root of roots) {
        if (!root.isConnected) continue;
        let ancestor = root.parentNode;
        while (ancestor && !roots.has(ancestor)) ancestor = ancestor.parentNode;
        if (ancestor) continue;
        if (root.nodeType === 1) elements.add(root);
        for (const element of root.querySelectorAll('*')) elements.add(element);
      }
      let count = 0;
      for (const element of elements) {
        if (!element.isConnected) continue;
        if (count++ < 200) classify(element);
        else remaining.add(element);
      }
    } finally {
      const batch = writes; writes = null;
      for (const [element,suffix,value] of batch) mark(element,suffix,value);
      document.documentElement.setAttribute(active, '');
      for (const host of shadows.keys()) host.setAttribute(active, '');
    }
    refreshOverlays();
    if (remaining.size || pending.size) schedule();
  }
  function update() {
    if (!document.documentElement) return;
    document.documentElement.setAttribute('data-sc-linkedin-theme-ready', '');
    document.documentElement.toggleAttribute(active, enabled);
    pending.clear(); remaining.clear();
    if (enabled) {
      pending.add(document.documentElement);
      for (const {root} of shadows.values()) pending.add(root);
      flush();
    } else {
      for (const host of shadows.keys()) host.removeAttribute(active);
      refreshOverlays();
    }
  }
  function onMutations(records) {
    if (!ready || !enabled || !globalThis.document?.documentElement) return;
    for (const record of records) {
      if (record.target.closest?.('[data-superchrome]')) continue;
      if (record.type === 'attributes') pending.add(record.target);
      else for (const node of record.addedNodes) if (node.nodeType === 1) pending.add(node);
    }
    for (const {root,style} of shadows.values()) if (!style.isConnected) pending.add(root);
    if (pending.size) schedule();
  }
  const observerOptions = {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','fill','stroke','color','bgcolor','contenteditable']};
  new MutationObserver(onMutations).observe(document, observerOptions);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.linkedinDarkMode) {
      ready = true; followSystem = changes.linkedinDarkMode.newValue !== false; syncTheme();
    }
  });
  chrome.storage.local.get({linkedinDarkMode:true}).then(settings => {
    if (ready) return;
    ready = true; followSystem = settings.linkedinDarkMode !== false; syncTheme();
  }).catch(() => {});
  document.addEventListener('__superchrome_shadow_attached', () => { if (enabled) { connectMessaging(); schedule(); } });
  document.addEventListener('DOMContentLoaded', () => { if (ready) update(); }, {once:true});
})();
