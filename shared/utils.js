// shared/utils.js
// Domain normalization, matching, and URL-support helpers shared across
// the popup, settings page, and background service worker.

const BLOCKED_SCHEMES = new Set([
  'chrome:', 'chrome-extension:', 'edge:', 'about:', 'file:',
  'javascript:', 'data:', 'view-source:', 'chrome-search:', 'devtools:'
]);

export function isSupportedUrl(urlString) {
  try {
    const url = new URL(urlString);
    if (BLOCKED_SCHEMES.has(url.protocol)) return false;
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function hostnameFromUrl(urlString) {
  try {
    return new URL(urlString).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function normalizeDomain(hostname) {
  let h = (hostname || '').toLowerCase().trim();
  if (h.startsWith('www.')) h = h.slice(4);
  return h;
}

/** Does `hostname` belong to `protectedDomain` (exact match or true subdomain)? */
export function domainMatches(protectedDomain, hostname) {
  const h = normalizeDomain(hostname);
  const p = normalizeDomain(protectedDomain);
  if (!h || !p) return false;
  return h === p || h.endsWith('.' + p);
}

/** Find the protected-site key (if any) that covers this hostname. */
export function findProtectedDomain(hostname, sites) {
  for (const domain of Object.keys(sites || {})) {
    if (domainMatches(domain, hostname)) return domain;
  }
  return null;
}

/** Build minimal, precise match patterns for requesting host permission. */
export function buildOriginPatterns(domain) {
  const d = normalizeDomain(domain);
  return [`*://${d}/*`, `*://*.${d}/*`];
}

export function displayName(domain) {
  const base = normalizeDomain(domain).split('.')[0] || domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
