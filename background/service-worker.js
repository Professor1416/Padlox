// background/service-worker.js
// The service worker has two jobs:
//
// 1. Grant content scripts access to chrome.storage.session. By default,
//    Chrome restricts storage.session to "trusted" extension contexts
//    (popup, settings page, service worker) and blocks content scripts
//    from reading or writing it. Since content/lock.js runs as a content
//    script on the protected site itself and relies on storage.session to
//    record "this domain is unlocked", that default would make every
//    unlock attempt fail with a permission error — even with the correct
//    password. This access level is NOT remembered across browser
//    restarts, so it must be (re)granted on every startup, not just once.
//
// 2. Make sure dynamically-registered content scripts for protected sites
//    survive browser restarts and extension reloads.
//
// All other user-facing actions (protecting a site, locking, removing
// protection, changing the password) happen directly in the popup/settings
// pages, which already have the same extension privileges.

import { getSites } from '../shared/storage.js';
import { buildOriginPatterns } from '../shared/utils.js';

async function enableSessionStorageForContentScripts() {
  try {
    await chrome.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
    });
  } catch (err) {
    console.warn('Padlox: could not set session storage access level', err);
  }
}

async function reregisterAllSiteScripts() {
  const sites = await getSites();
  const domains = Object.keys(sites);
  if (domains.length === 0) return;

  let existingIds = new Set();
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts();
    existingIds = new Set(existing.map((s) => s.id));
  } catch {
    // ignore — fall through and try to register everything
  }

  const toRegister = [];
  for (const domain of domains) {
    const id = 'padlox-' + domain;
    if (!existingIds.has(id)) {
      toRegister.push({
        id,
        matches: buildOriginPatterns(domain),
        js: ['content/lock.js'],
        runAt: 'document_start',
        world: 'ISOLATED',
        persistAcrossSessions: true
      });
    }
  }

  if (toRegister.length > 0) {
    try {
      await chrome.scripting.registerContentScripts(toRegister);
    } catch (err) {
      console.warn('Padlox: could not re-register content scripts', err);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  enableSessionStorageForContentScripts();
  reregisterAllSiteScripts();
});

chrome.runtime.onStartup.addListener(() => {
  enableSessionStorageForContentScripts();
  reregisterAllSiteScripts();
});

// Belt-and-suspenders: also set it immediately when the service worker
// itself first spins up (covers the "extension was already installed but
// the access level didn't stick" edge case without waiting for a browser
// restart).
enableSessionStorageForContentScripts();
