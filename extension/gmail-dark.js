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
    if (value) { if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value); }
    else element.removeAttribute(attribute);
  }
  function classify(element) {
    if (element.matches(excluded) || element.closest(messageSelector) || element.closest('[data-sc-gmail-control]')) {
      element.removeAttribute(bg); element.removeAttribute(fg);
      element.removeAttribute('data-sc-gmail-fill'); element.removeAttribute('data-sc-gmail-stroke'); return;
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
      if (!body.isConnected || body.closest(editorSelector)) {
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
  function flush() {
    if (!enabled || !document.documentElement) return;
    // Read Gmail's own colors with our stylesheet inactive. Restoring the gate
    // synchronously prevents a paint in between and avoids classifying our colors.
    document.documentElement.removeAttribute(active);
    try {
      const roots = [...pending]; pending.clear();
      for (const root of roots) {
        if (!root.isConnected) continue;
        if (roots.some(other => other !== root && other.contains(root))) continue;
        classify(root);
        for (const element of root.querySelectorAll('*')) classify(element);
      }
      messageControls();
    } finally { document.documentElement.setAttribute(active, ''); }
  }
  function queue(root) {
    if (!enabled) return;
    pending.add(root?.nodeType === 1 ? root : document.documentElement);
  }
  function update() {
    if (!document.documentElement) return;
    document.documentElement.toggleAttribute(active, enabled);
    if (enabled) { pending.add(document.documentElement); flush(); }
    else {
      pending.clear();
      for (const [body, control] of messages) { control.remove(); body.removeAttribute('data-sc-gmail-original'); }
      messages.clear();
    }
  }
  const observer = new MutationObserver(records => {
    if (!ready || !globalThis.document?.documentElement) return;
    for (const record of records) {
      if (record.target.closest?.('[data-sc-gmail-control]')) continue;
      if (record.type === 'attributes') queue(record.target);
      else {
        for (const node of record.addedNodes) {
          if (node.nodeType === 1 && !node.hasAttribute('data-sc-gmail-control')) queue(node);
        }
        if (record.removedNodes.length && messages.size) queue(record.target);
      }
    }
    // Mutation observers run before rendering. Classify this entire mutation
    // batch now: deferring to a timer lets new white message shells paint first.
    if (enabled && pending.size) flush();
  });
  observer.observe(document, {childList:true, subtree:true, attributes:true, attributeFilter:['class','style','bgcolor','color']});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.gmailDarkMode) { ready = true; followSystem = changes.gmailDarkMode.newValue !== false; syncTheme(); }
  });
  chrome.storage.local.get({gmailDarkMode:true}).then(settings => {
    if (ready) return;
    ready = true; followSystem = settings.gmailDarkMode !== false; syncTheme();
  }).catch(() => {});
  document.addEventListener('DOMContentLoaded', () => { if (ready) update(); }, {once:true});
})();
