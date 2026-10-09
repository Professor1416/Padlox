// content/lock.js
// Runs at document_start on protected domains. Covers the page immediately,
// then checks Padlox's status and shows a password screen if locked.
// This file intentionally does not use ES module imports (content scripts
// registered via chrome.scripting run as classic scripts), so the small
// set of crypto/matching helpers it needs are inlined below, mirroring
// shared/crypto.js and shared/utils.js.

(function () {
  if (window.__padloxInitialized) return;
  window.__padloxInitialized = true;

  const CONFIG_KEY = 'padlox_config';
  const SITES_KEY = 'padlox_sites';
  const UNLOCKED_KEY = 'padlox_unlocked';
  const ATTEMPTS_KEY = 'padlox_attempts';
  const PBKDF2_ITERATIONS_DEFAULT = 300000;
  const HASH_ALGO = 'SHA-256';
  const KEY_LENGTH_BITS = 256;
  const MAX_DELAY_MS = 15000;

  // ---- crypto helpers (mirrors shared/crypto.js) ----
  function toBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  function fromBase64(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  async function deriveHash(password, saltBytes, iterations) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations, hash: HASH_ALGO },
      keyMaterial, KEY_LENGTH_BITS
    );
    return toBase64(bits);
  }
  function constantTimeEqual(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }
  async function verifyPassword(password, config) {
    if (!config || !config.salt || !config.hash) return false;
    const saltBytes = fromBase64(config.salt);
    const candidate = await deriveHash(password, saltBytes, config.iterations || PBKDF2_ITERATIONS_DEFAULT);
    return constantTimeEqual(candidate, config.hash);
  }

  // ---- domain helpers (mirrors shared/utils.js) ----
  function normalizeDomain(hostname) {
    let h = (hostname || '').toLowerCase().trim();
    if (h.startsWith('www.')) h = h.slice(4);
    return h;
  }
  function domainMatches(protectedDomain, hostname) {
    const h = normalizeDomain(hostname);
    const p = normalizeDomain(protectedDomain);
    if (!h || !p) return false;
    return h === p || h.endsWith('.' + p);
  }
  function findProtectedDomain(hostname, sites) {
    for (const domain of Object.keys(sites || {})) {
      if (domainMatches(domain, hostname)) return domain;
    }
    return null;
  }
  function displayName(domain) {
    const base = normalizeDomain(domain).split('.')[0] || domain;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  const STYLES = `
    .padlox-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(10, 11, 13, 0.97);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .padlox-card {
      width: 300px;
      max-width: 88vw;
      padding: 32px 24px 22px;
      background: #17181c;
      border: 1px solid #2a2b30;
      border-radius: 14px;
      text-align: center;
      color: #f2f2f3;
      box-shadow: 0 20px 60px rgba(0,0,0,0.55);
    }
    .padlox-icon { font-size: 26px; margin-bottom: 10px; }
    .padlox-title { font-size: 15px; font-weight: 600; letter-spacing: 0.3px; margin-bottom: 4px; }
    .padlox-subtitle { font-size: 13px; color: #9a9ba3; margin-bottom: 20px; }
    #padlox-form { display: flex; flex-direction: column; gap: 10px; }
    #padlox-password {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid #33343a;
      background: #0e0f12;
      color: #f2f2f3;
      font-size: 14px;
      outline: none;
      box-sizing: border-box;
    }
    #padlox-password:focus { border-color: #5b8cff; }
    #padlox-unlock-btn {
      width: 100%;
      padding: 10px 12px;
      border-radius: 8px;
      border: none;
      background: #4a6cf7;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    #padlox-unlock-btn:hover { background: #3d5be0; }
    #padlox-unlock-btn:disabled { opacity: 0.6; cursor: default; }
    .padlox-error { min-height: 16px; font-size: 12px; color: #ff6b6b; margin-top: 10px; }
    .padlox-footer { margin-top: 14px; font-size: 11px; color: #63646b; }
  `;

  let hostEl = null;
  let shadow = null;
  let matchedDomain = null;

  const currentHostname = location.hostname;

  // Failed-attempt/lockout state is kept in chrome.storage.session, keyed
  // per protected domain, rather than a plain JS variable. A JS variable
  // would reset the moment the page is reloaded, letting someone bypass
  // the progressive delay simply by refreshing after a wrong guess.
  async function getAttemptState(domain) {
    try {
      const data = await chrome.storage.session.get(ATTEMPTS_KEY);
      const all = data[ATTEMPTS_KEY] || {};
      return all[domain] || { count: 0, lockUntil: 0 };
    } catch {
      return { count: 0, lockUntil: 0 };
    }
  }
  async function setAttemptState(domain, state) {
    try {
      const data = await chrome.storage.session.get(ATTEMPTS_KEY);
      const all = data[ATTEMPTS_KEY] || {};
      all[domain] = state;
      await chrome.storage.session.set({ [ATTEMPTS_KEY]: all });
    } catch {
      // Best-effort only — losing the lockout counter is safer than
      // blocking a legitimate unlock attempt over it.
    }
  }
  async function clearAttemptState(domain) {
    try {
      const data = await chrome.storage.session.get(ATTEMPTS_KEY);
      const all = data[ATTEMPTS_KEY] || {};
      delete all[domain];
      await chrome.storage.session.set({ [ATTEMPTS_KEY]: all });
    } catch {
      // ignore
    }
  }

  function injectCover() {
    if (hostEl) return;
    hostEl = document.createElement('div');
    hostEl.id = 'padlox-host';
    hostEl.style.all = 'initial';
    hostEl.style.position = 'fixed';
    hostEl.style.top = '0';
    hostEl.style.left = '0';
    hostEl.style.zIndex = '2147483647';
    (document.documentElement || document).appendChild(hostEl);

    shadow = hostEl.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="padlox-overlay" role="dialog" aria-modal="true">
        <div class="padlox-card">
          <div class="padlox-icon">🔒</div>
          <div class="padlox-title">Padlox</div>
          <div class="padlox-subtitle" id="padlox-subtitle">This site is locked</div>
          <form id="padlox-form" autocomplete="off">
            <input type="password" id="padlox-password" placeholder="Enter Padlox PIN / Password" autocomplete="off" />
            <button type="submit" id="padlox-unlock-btn">Unlock</button>
          </form>
          <div class="padlox-error" id="padlox-error"></div>
          <div class="padlox-footer">Protected by Padlox</div>
        </div>
      </div>
    `;

    blockPageInteraction();
    shadow.getElementById('padlox-form').addEventListener('submit', onSubmit);
    setTimeout(() => {
      const input = shadow.getElementById('padlox-password');
      if (input) input.focus();
    }, 0);
  }

  function setSubtitle(text) {
    if (!shadow) return;
    const el = shadow.getElementById('padlox-subtitle');
    if (el) el.textContent = text;
  }

  function removeCover() {
    if (!hostEl) return;
    unblockPageInteraction();
    hostEl.remove();
    hostEl = null;
    shadow = null;
  }

  function blockEvent(e) {
    if (hostEl && e.target && hostEl.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }

  function blockPageInteraction() {
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    const opts = { capture: true, passive: false };
    window.addEventListener('keydown', blockEvent, opts);
    window.addEventListener('keyup', blockEvent, opts);
    window.addEventListener('keypress', blockEvent, opts);
    window.addEventListener('click', blockEvent, opts);
    window.addEventListener('mousedown', blockEvent, opts);
    window.addEventListener('mouseup', blockEvent, opts);
    window.addEventListener('touchstart', blockEvent, opts);
    window.addEventListener('wheel', blockEvent, opts);
    window.addEventListener('scroll', blockEvent, opts);
    window.addEventListener('contextmenu', blockEvent, opts);
  }

  function unblockPageInteraction() {
    document.documentElement.style.removeProperty('overflow');
    const opts = { capture: true };
    window.removeEventListener('keydown', blockEvent, opts);
    window.removeEventListener('keyup', blockEvent, opts);
    window.removeEventListener('keypress', blockEvent, opts);
    window.removeEventListener('click', blockEvent, opts);
    window.removeEventListener('mousedown', blockEvent, opts);
    window.removeEventListener('mouseup', blockEvent, opts);
    window.removeEventListener('touchstart', blockEvent, opts);
    window.removeEventListener('wheel', blockEvent, opts);
    window.removeEventListener('scroll', blockEvent, opts);
    window.removeEventListener('contextmenu', blockEvent, opts);
  }

  async function onSubmit(e) {
    e.preventDefault();
    const errorEl = shadow.getElementById('padlox-error');
    const btn = shadow.getElementById('padlox-unlock-btn');
    const input = shadow.getElementById('padlox-password');
    errorEl.textContent = '';

    const now = Date.now();
    const attemptState = await getAttemptState(matchedDomain);
    if (now < attemptState.lockUntil) {
      const waitSec = Math.ceil((attemptState.lockUntil - now) / 1000);
      errorEl.textContent = `Too many attempts. Try again in ${waitSec}s.`;
      return;
    }

    const password = input.value;
    btn.disabled = true;
    btn.textContent = 'Checking...';
    try {
      const data = await chrome.storage.local.get(CONFIG_KEY);
      const config = data[CONFIG_KEY];
      const ok = await verifyPassword(password, config);
      if (ok) {
        await clearAttemptState(matchedDomain);
        try {
          const sessionData = await chrome.storage.session.get(UNLOCKED_KEY);
          const unlocked = sessionData[UNLOCKED_KEY] || {};
          unlocked[matchedDomain] = true;
          await chrome.storage.session.set({ [UNLOCKED_KEY]: unlocked });
          removeCover();
        } catch (storageErr) {
          errorEl.textContent = 'Password correct, but Padlox is still starting up. Please wait a moment and try again.';
        }
      } else {
        const count = attemptState.count + 1;
        const delay = Math.min(count * 1000, MAX_DELAY_MS);
        await setAttemptState(matchedDomain, { count, lockUntil: Date.now() + delay });
        errorEl.textContent = 'Incorrect password.';
        input.value = '';
      }
    } catch (err) {
      errorEl.textContent = 'Something went wrong. Please try again.';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Unlock';
      if (input) input.focus();
    }
  }

  let checkRetryCount = 0;
  const MAX_CHECK_RETRIES = 6;

  async function checkAndRender() {
    const localData = await chrome.storage.local.get([SITES_KEY, CONFIG_KEY]);
    const sites = localData[SITES_KEY] || {};
    const config = localData[CONFIG_KEY] || null;
    matchedDomain = findProtectedDomain(currentHostname, sites);

    if (!matchedDomain || !config) {
      removeCover();
      return;
    }

    try {
      const sessionData = await chrome.storage.session.get(UNLOCKED_KEY);
      checkRetryCount = 0;
      const unlocked = sessionData[UNLOCKED_KEY] || {};
      if (unlocked[matchedDomain]) {
        removeCover();
      } else {
        injectCover();
        setSubtitle(`${displayName(matchedDomain)} is locked`);
      }
    } catch (err) {
      // chrome.storage.session is briefly unreachable from content scripts
      // right after the browser starts (the background worker needs a
      // moment to grant access). Rather than surface that as a dead-end
      // error, stay locked and quietly retry a few times.
      injectCover();
      setSubtitle('Preparing Padlox…');
      if (checkRetryCount < MAX_CHECK_RETRIES) {
        checkRetryCount += 1;
        setTimeout(checkAndRender, 750);
      } else {
        setSubtitle('This site is locked');
        const errorEl = shadow && shadow.getElementById('padlox-error');
        if (errorEl) {
          errorEl.textContent = 'Still starting up — try closing and reopening this tab.';
        }
      }
    }
  }

  // Cover the page immediately (before we've even checked status) to avoid
  // flashing private content, then resolve the real status right away.
  injectCover();
  checkAndRender();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'session' && changes[UNLOCKED_KEY]) checkAndRender();
    if (area === 'local' && (changes[SITES_KEY] || changes[CONFIG_KEY])) checkAndRender();
  });
})();
