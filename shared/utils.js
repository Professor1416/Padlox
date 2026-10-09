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
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!normalizeDomain(url.hostname);
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
  if (typeof hostname !== 'string') return '';
  let value = hostname.trim().toLowerCase();
  if (value.endsWith('.')) value = value.slice(0, -1);
  // Accept hostnames, never URLs, credentials, ports or match-pattern syntax.
  if (!value || !/^[\p{L}\p{N}.-]+$/u.test(value)) return '';
  let h;
  try { h = new URL('http://' + value).hostname.toLowerCase(); } catch { return ''; }
  if (h.startsWith('www.')) h = h.slice(4);
  if (h.length > 253 || h.endsWith('.')) return '';
  if (h.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return '';
  return h;
}

function isIPv4(hostname) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
}

/** Does `hostname` belong to `protectedDomain` (exact match or true subdomain)? */
export function domainMatches(protectedDomain, hostname) {
  const h = normalizeDomain(hostname);
  const p = normalizeDomain(protectedDomain);
  if (!h || !p) return false;
  return h === p || (!isIPv4(p) && p.includes('.') && h.endsWith('.' + p));
}

/** Find the protected-site key (if any) that covers this hostname. */
export function findProtectedDomain(hostname, sites) {
  for (const domain of Object.keys(sites || {}).sort((a, b) => normalizeDomain(b).length - normalizeDomain(a).length)) {
    if (domainMatches(domain, hostname)) return domain;
  }
  return null;
}

/** Build minimal, precise match patterns for requesting host permission. */
export function buildOriginPatterns(domain) {
  const d = normalizeDomain(domain);
  if (!d) throw new Error('Invalid domain.');
  return (isIPv4(d) || !d.includes('.')) ? [`*://${d}/*`] : [`*://${d}/*`, `*://*.${d}/*`];
}

export function displayName(domain) {
  const base = normalizeDomain(domain).split('.')[0] || domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}
