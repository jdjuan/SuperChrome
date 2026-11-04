(() => {
  if (location.hostname !== 'mail.google.com' || globalThis.superChromeGmailDark) return;
  globalThis.superChromeGmailDark = true;
  const active = 'data-sc-gmail-dark';
  const bg = 'data-sc-gmail-bg', fg = 'data-sc-gmail-fg';
  const messageSelector = '.a3s';
  // Never annotate an editor or insert controls in its serializable contents.
  const editorSelector = '[contenteditable="true"], [contenteditable=""], [role="textbox"], .editable';
  const excluded = `script, style, link, meta, img, picture, video, canvas, iframe, ${editorSelector}, ${editorSelector.split(', ').map(s => s + ' *').join(', ')}`;
  let enabled = false, ready = false, pending = new Set();
  const changed = new Set(), remaining = new Set();
  let scheduled = false, controlsDirty = true, writes;
  const messages = new Map();
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  let followSystem = true;
  function syncTheme() {
    enabled = ready && followSystem && systemTheme.matches;
    update();
  }
  systemTheme.addEventListener('change', syncTheme);


  function rgb(value) {
    const parts = value.match(/[\d.]+/g)?.map(Number);
    return parts?.length >= 3 ? parts : null;
  }
  function mark(element, attribute, value) {
    if (writes) { writes.push([element,attribute,value]); return; }
    if (value) { if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value); }
    else if (element.hasAttribute(attribute)) element.removeAttribute(attribute);
  }
  function classify(element) {
    if (element.matches(excluded) || element.closest(messageSelector) || element.closest('[data-sc-gmail-control]')) {
      for (const attribute of [bg,fg,'data-sc-gmail-fill','data-sc-gmail-stroke']) mark(element,attribute,null);
      return;
    }
    if (element.matches('svg, svg *')) {
      const style = getComputedStyle(element);
      for (const property of ['fill','stroke']) {
        const color = rgb(style[property]);
        mark(element, 'data-sc-gmail-' + property, color && Math.max(...color.slice(0,3))-Math.min(...color.slice(0,3)) < 30 ? 'icon' : null);
      }
      return;
    }
    const style = getComputedStyle(element), background = rgb(style.backgroundColor), color = rgb(style.color);
    let surface;
    if (background && (background[3] ?? 1) > 0) {
      const [r,g,b] = background, light = (r+g+b)/3;
      surface = Math.max(r,g,b)-Math.min(r,g,b) > 35 ? 'accent' : light > 248 ? 'surface' : light > 220 ? 'raised' : 'base';
    }
    mark(element, bg, surface);
    const muted = color && Math.max(...color.slice(0,3))-Math.min(...color.slice(0,3)) < 35 && color[0] > 70 && color[0] < 180;
    mark(element, fg, element.matches('a[href]') ? 'link' : muted ? 'muted' : 'text');
  }
  function messageControls() {
    for (const [body, control] of messages) {
      if (!body.isConnected || !body.matches(messageSelector) || body.closest(editorSelector)) {
        control.remove(); body.removeAttribute('data-sc-gmail-original'); messages.delete(body);
      }
    }
    for (const body of document.querySelectorAll(messageSelector)) {
      if (body.closest(editorSelector)) continue;
      let control = messages.get(body);
      if (!control) {
        control = document.createElement('span');
        control.setAttribute('data-sc-gmail-control', '');
        const shadow = control.attachShadow({mode:'open'});
        shadow.innerHTML = '<style>:host{display:block;margin:8px 0}button{font:12px system-ui;color:#aecbfa;background:#202124;border:1px solid #65748c;border-radius:6px;padding:6px 10px;cursor:pointer}button:focus-visible{outline:2px solid #aecbfa;outline-offset:2px}</style><button type="button" aria-pressed="false">Show original colors</button>';
        shadow.querySelector('button').addEventListener('click', () => {
          const original = !body.hasAttribute('data-sc-gmail-original');
          body.toggleAttribute('data-sc-gmail-original', original);
          const button = shadow.querySelector('button');
          button.textContent = original ? 'Use dark colors' : 'Show original colors';
          button.setAttribute('aria-pressed', String(original));
        });
        messages.set(body, control);
      }
      if (body.previousSibling !== control) body.before(control);
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; flush(); }, 0);
  }
  function flush() {
    if (!enabled || !document.documentElement) return;
    const roots = new Set(pending); pending.clear();
    const elements = new Set([...remaining,...changed]); remaining.clear(); changed.clear();
    for (const root of roots) {
      if (!root.isConnected) continue;
      let ancestor = root.parentNode;
      while (ancestor && !roots.has(ancestor)) ancestor = ancestor.parentNode;
      if (ancestor) continue;
      elements.add(root);
      for (const element of root.querySelectorAll('*')) elements.add(element);
    }
    const batch = [];
    let processed = 0;
    writes = [];
    try {
      for (const element of elements) {
        if (!element.isConnected) continue;
        if (processed++ >= 50) { remaining.add(element); continue; }
        // Never put temporary sampling attributes in messages or draft markup.
        if (element.matches(excluded) || element.closest(messageSelector) || element.closest('[data-sc-gmail-control]')) { classify(element); continue; }
        batch.push(element);
      }
      for (const element of batch) element.setAttribute('data-sc-gmail-sampling','');
      try { for (const element of batch) classify(element); }
      finally { for (const element of batch) element.removeAttribute('data-sc-gmail-sampling'); }
    } finally {
      const batchWrites = writes; writes = null;
      for (const args of batchWrites) mark(...args);
    }
    if (controlsDirty) { controlsDirty = false; messageControls(); }
    if (remaining.size || pending.size || changed.size) schedule();
  }
  const beforeStyle = document.createElement('span').style;
  const afterStyle = document.createElement('span').style;
  function paintChanged(record) {
    beforeStyle.cssText = record.oldValue || '';
    afterStyle.cssText = record.target.getAttribute('style') || '';
    const properties = new Set(['color','background','background-color','fill','stroke']);
    for (const style of [beforeStyle,afterStyle]) for (let i=0;i<style.length;i++) if (style[i].startsWith('--')) properties.add(style[i]);
    return [...properties].some(name => beforeStyle.getPropertyValue(name) !== afterStyle.getPropertyValue(name) || beforeStyle.getPropertyPriority(name) !== afterStyle.getPropertyPriority(name));
  }
  function update() {
    if (!document.documentElement) return;
    document.documentElement.toggleAttribute(active, enabled);
    pending.clear(); changed.clear(); remaining.clear();
    if (enabled) { controlsDirty = true; pending.add(document.documentElement); flush(); }
    else {
      pending.clear();
      for (const [body, control] of messages) { control.remove(); body.removeAttribute('data-sc-gmail-original'); }
      messages.clear();
    }
  }
  const observer = new MutationObserver(records => {
    if (!ready || !enabled || !globalThis.document?.documentElement) return;
    for (const record of records) {
      if (record.target.closest?.('[data-sc-gmail-control]')) continue;
      if (record.type === 'attributes') {
        if (record.attributeName !== 'style' || paintChanged(record)) changed.add(record.target);
        if (['class','contenteditable'].includes(record.attributeName)) controlsDirty = true;
      } else {
        const added = [...record.addedNodes].filter(node => node.nodeType === 1 && !node.hasAttribute('data-sc-gmail-control'));
        for (const node of added) pending.add(node);
        if (added.length || [...record.removedNodes].some(node => node.nodeType === 1 && !node.hasAttribute('data-sc-gmail-control'))) controlsDirty = true;
      }
    }
    if (pending.size || changed.size || controlsDirty) schedule();
  });
  observer.observe(document, {childList:true, subtree:true, attributes:true, attributeOldValue:true, attributeFilter:['class','style','bgcolor','color','fill','stroke','contenteditable']});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.gmailDarkMode) { ready = true; followSystem = changes.gmailDarkMode.newValue !== false; syncTheme(); }
  });
  chrome.storage.local.get({gmailDarkMode:true}).then(settings => {
    if (ready) return;
    ready = true; followSystem = settings.gmailDarkMode !== false; syncTheme();
  }).catch(() => {});
  document.addEventListener('DOMContentLoaded', () => { if (ready) update(); }, {once:true});
})();
