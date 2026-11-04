globalThis.guardPolicy = {
  hostname(value) { try { const u = new URL(value); return /^https?:$/.test(u.protocol) ? u.hostname : ''; } catch { return ''; } },
  defaultFor(host) { return /(^|\.)cuevana[a-z0-9-]*\./i.test(host) || host === 'cineb.st' || host.endsWith('.cineb.st'); },
  family(host) { return /(^|\.)cuevana[a-z0-9-]*\./i.test(host) ? "cuevana" : host === "cineb.st" || host.endsWith(".cineb.st") ? "cineb" : ""; },
  siteEnabled(host, sites = {}) { return Object.hasOwn(sites, host) ? sites[host] === true : this.defaultFor(host) && sites["@"+this.family(host)] !== false; },
  enabledFor(host, settings) {
    return Boolean(host && settings.enabled !== false &&
      this.siteEnabled(host, settings.sites));
  }
};
