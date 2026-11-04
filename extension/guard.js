(() => {
  if (['linkedin.com','www.linkedin.com'].includes(location.hostname)) {
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = Reflect.apply(attach, this, [options]);
      if (this.id === 'interop-outlet') document.dispatchEvent(new Event('__superchrome_shadow_attached'));
      return root;
    };
  }
  const origins = Array.from(location.ancestorOrigins || []);
  let host = '';
  try { host = new URL(origins.length ? origins[origins.length - 1] : location.href).hostname; } catch {}
  let enabled = /(^|\.)cuevana[a-z0-9-]*\./i.test(host) || host === 'cineb.st' || host.endsWith('.cineb.st');
  const eventName = '__cuevana_guard_state';
  document.addEventListener(eventName, e => { if (typeof e.detail === 'boolean') enabled = e.detail; });
  const originalOpen = window.open;
  window.open = function (...args) { return enabled ? null : Reflect.apply(originalOpen, this, args); };
  // Prevent the browser default for advertising links without swallowing player clicks.
  const intercept = event => {
    if (!enabled) return;
    const anchor = event.composedPath().find(n => n && n.tagName === 'A' && n.href);
    if (!anchor) return;
    let url;
    try { url = new URL(anchor.href, location.href); } catch { return; }
    const inPlayer = window !== window.top;
    const external = url.origin !== location.origin;
    const target = (anchor.target || document.querySelector('base[target]')?.target || '').toLowerCase();
    if (external || (inPlayer && ['_top', '_parent'].includes(target)) ||
        (target && !['_self', '_top', '_parent'].includes(target)) || event.type === 'auxclick' || event.ctrlKey || event.metaKey || event.shiftKey) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  window.addEventListener('click', intercept, true);
  window.addEventListener('auxclick', intercept, true);
})();
