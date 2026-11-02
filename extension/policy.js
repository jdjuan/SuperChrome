globalThis.guardPolicy = {
  hostname(value) { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.hostname : ''; } catch { return ''; } },
  defaultFor(host) { return /(^|\.)cuevana[a-z0-9-]*\./i.test(host) || host === 'cineb.st' || host.endsWith('.cineb.st'); },
  enabledFor(host, settings) {
    return Boolean(host && settings.enabled !== false &&
      (Object.hasOwn(settings.sites || {}, host) ? settings.sites[host] : this.defaultFor(host)));
  }
};
