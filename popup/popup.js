import { getConfig, setConfig, getSites, setSites, getUnlocked, setUnlocked } from '../shared/storage.js';
import { createVerifier } from '../shared/crypto.js';
import {
  isSupportedUrl, hostnameFromUrl, normalizeDomain,
  findProtectedDomain, buildOriginPatterns
} from '../shared/utils.js';

const el = (id) => document.getElementById(id);

let activeTab = null;
let currentHostname = null;
let currentDomain = null;

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;

  if (activeTab && activeTab.url && isSupportedUrl(activeTab.url)) {
    currentHostname = hostnameFromUrl(activeTab.url);
    currentDomain = normalizeDomain(currentHostname);
  }

  const config = await getConfig();
  wireEvents();

  if (!config) {
    showSetup();
  } else {
    await showMain();
  }
}

function showSetup() {
  el('setup-screen').hidden = false;
  el('main-screen').hidden = true;
}

async function showMain() {
  el('setup-screen').hidden = true;
  el('main-screen').hidden = false;
  await renderCurrentSite();
  await renderSitesSummary();
}

async function renderCurrentSite() {
  const box = el('current-site-box');
  const unsupportedMsg = el('unsupported-msg');
  const label = el('current-site-domain');
  const statusLine = el('current-site-status');
  const protectBtn = el('protect-btn');
  const lockNowBtn = el('lock-now-btn');

  el('protect-error').textContent = '';

  if (!currentDomain) {
    box.hidden = true;
    unsupportedMsg.hidden = false;
    return;
  }

  box.hidden = false;
  unsupportedMsg.hidden = true;
  label.textContent = currentDomain;

  const sites = await getSites();
  const matched = findProtectedDomain(currentHostname, sites);

  if (matched) {
    const unlocked = await getUnlocked();
    const isUnlocked = !!unlocked[matched];
    statusLine.textContent = 'Protection enabled';
    protectBtn.hidden = true;
    lockNowBtn.hidden = false;
    lockNowBtn.disabled = !isUnlocked;
    lockNowBtn.textContent = isUnlocked ? 'Lock now' : 'Already locked';
  } else {
    statusLine.textContent = '';
    protectBtn.hidden = false;
    protectBtn.disabled = false;
    protectBtn.textContent = 'Lock this site';
    lockNowBtn.hidden = true;
  }
}

async function renderSitesSummary() {
  const sites = await getSites();
  const count = Object.keys(sites).length;
  const summaryEl = el('sites-summary');
  if (count === 0) {
    summaryEl.innerHTML = 'No protected websites yet.';
  } else {
    summaryEl.innerHTML = `<span class="count">${count}</span> site${count === 1 ? '' : 's'} protected`;
  }
}

function wireEvents() {
  el('setup-form').addEventListener('submit', onCreatePassword);
  el('protect-btn').addEventListener('click', onProtectSite);
  el('lock-now-btn').addEventListener('click', onLockNow);
  el('settings-btn').addEventListener('click', openSettings);
  el('manage-sites-btn').addEventListener('click', openSettings);
}

function openSettings() {
  chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
}

async function onCreatePassword(e) {
  e.preventDefault();
  const pw = el('setup-password').value;
  const confirm = el('setup-confirm').value;
  const errorEl = el('setup-error');
  errorEl.textContent = '';

  if (pw.length < 4) {
    errorEl.textContent = 'Password must be at least 4 characters.';
    return;
  }
  if (pw !== confirm) {
    errorEl.textContent = 'Passwords do not match.';
    return;
  }

  const submitBtn = el('setup-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating...';
  try {
    const config = await createVerifier(pw);
    await setConfig(config);
    el('setup-password').value = '';
    el('setup-confirm').value = '';
    await showMain();
  } catch (err) {
    errorEl.textContent = 'Something went wrong. Please try again.';
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Padlox';
  }
}

async function onProtectSite() {
  const errorEl = el('protect-error');
  errorEl.textContent = '';
  if (!currentDomain) return;

  const patterns = buildOriginPatterns(currentDomain);
  const btn = el('protect-btn');
  btn.disabled = true;
  btn.textContent = 'Requesting access...';

  try {
    const granted = await chrome.permissions.request({ origins: patterns });
    if (!granted) {
      errorEl.textContent = 'Permission denied. Site was not protected.';
      return;
    }

    const id = 'padlox-' + currentDomain;
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    if (existing.length === 0) {
      await chrome.scripting.registerContentScripts([{
        id,
        matches: patterns,
        js: ['content/lock.js'],
        runAt: 'document_start',
        world: 'ISOLATED',
        persistAcrossSessions: true
      }]);
    }

    const sites = await getSites();
    sites[currentDomain] = { addedAt: Date.now() };
    await setSites(sites);

    // The tab the user is protecting right now stays usable; it will
    // require the password the next time it's opened or reloaded.
    const unlocked = await getUnlocked();
    unlocked[currentDomain] = true;
    await setUnlocked(unlocked);

    await renderCurrentSite();
    await renderSitesSummary();
  } catch (err) {
    errorEl.textContent = 'Could not protect this site. Please try again.';
  } finally {
    btn.disabled = false;
    if (btn.hidden === false) btn.textContent = 'Lock this site';
  }
}

async function onLockNow() {
  const sites = await getSites();
  const matched = findProtectedDomain(currentHostname, sites);
  if (!matched) return;

  const unlocked = await getUnlocked();
  delete unlocked[matched];
  await setUnlocked(unlocked);

  await renderCurrentSite();

  if (activeTab && activeTab.id) {
    chrome.tabs.reload(activeTab.id);
  }
  window.close();
}

init();
