import {
  getConfig, setConfig, getSites, setSites, clearUnlocked, clearAll
} from '../shared/storage.js';
import { createVerifier, verifyPassword } from '../shared/crypto.js';
import { buildOriginPatterns, displayName } from '../shared/utils.js';

const el = (id) => document.getElementById(id);

let pendingConfirmAction = null; // async (password) => { ok: boolean, error?: string }

async function init() {
  await renderSitesList();
  wireEvents();
}

async function renderSitesList(filterText = '') {
  const sites = await getSites();
  const listEl = el('sites-list');
  const emptyEl = el('sites-empty');
  const noMatchEl = el('sites-no-match');
  const allDomains = Object.keys(sites).sort();
  const query = filterText.trim().toLowerCase();
  const domains = query
    ? allDomains.filter((d) => d.toLowerCase().includes(query))
    : allDomains;

  listEl.innerHTML = '';

  if (allDomains.length === 0) {
    emptyEl.hidden = false;
    noMatchEl.hidden = true;
    return;
  }
  emptyEl.hidden = true;

  if (domains.length === 0) {
    noMatchEl.hidden = false;
    return;
  }
  noMatchEl.hidden = true;

  for (const domain of domains) {
    const li = document.createElement('li');
    li.className = 'site-row';

    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'site-row-name';
    name.textContent = displayName(domain);
    const sub = document.createElement('div');
    sub.className = 'site-row-domain';
    sub.textContent = domain;
    info.appendChild(name);
    info.appendChild(sub);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.textContent = 'Remove protection';
    removeBtn.addEventListener('click', () => confirmRemoveSite(domain));

    li.appendChild(info);
    li.appendChild(removeBtn);
    listEl.appendChild(li);
  }
}

function wireEvents() {
  el('change-password-form').addEventListener('submit', onChangePassword);
  el('reset-btn').addEventListener('click', confirmReset);
  el('modal-cancel').addEventListener('click', closeModal);
  el('modal-confirm').addEventListener('click', onModalConfirm);
  el('modal-backdrop').addEventListener('click', (e) => {
    if (e.target === el('modal-backdrop')) closeModal();
  });
  el('sites-search').addEventListener('input', (e) => {
    renderSitesList(e.target.value);
  });
}

function openModal(title, message, onConfirm) {
  el('modal-title').textContent = title;
  el('modal-message').textContent = message;
  el('modal-password').value = '';
  el('modal-error').textContent = '';
  pendingConfirmAction = onConfirm;
  el('modal-backdrop').hidden = false;
  setTimeout(() => el('modal-password').focus(), 0);
}

function closeModal() {
  el('modal-backdrop').hidden = true;
  pendingConfirmAction = null;
}

async function onModalConfirm() {
  if (!pendingConfirmAction) return;
  const password = el('modal-password').value;
  const errorEl = el('modal-error');
  const confirmBtn = el('modal-confirm');
  errorEl.textContent = '';

  if (!password) {
    errorEl.textContent = 'Enter your Padlox password.';
    return;
  }

  confirmBtn.disabled = true;
  try {
    const result = await pendingConfirmAction(password);
    if (result && result.ok) {
      closeModal();
    } else {
      errorEl.textContent = (result && result.error) || 'Incorrect password.';
    }
  } catch (err) {
    // Previously an unexpected error here had nowhere to go: the modal
    // just sat there looking "stuck" with no feedback. Now it always
    // surfaces something instead of failing silently.
    console.error('Padlox: confirm action failed', err);
    errorEl.textContent = 'Something went wrong. Please try again.';
  } finally {
    confirmBtn.disabled = false;
  }
}

function confirmRemoveSite(domain) {
  openModal(
    'Remove protection?',
    `Remove protection from ${domain}? You'll need your Padlox password to confirm.`,
    async (password) => {
      let config;
      try {
        config = await getConfig();
      } catch (err) {
        return { ok: false, error: 'Could not read Padlox config. Please try again.' };
      }

      const valid = await verifyPassword(password, config);
      if (!valid) return { ok: false, error: 'Incorrect password.' };

      const id = 'padlox-' + domain;
      try {
        await chrome.scripting.unregisterContentScripts({ ids: [id] });
      } catch {
        // ignore if it was already unregistered
      }
      try {
        await chrome.permissions.remove({ origins: buildOriginPatterns(domain) });
      } catch {
        // ignore if permission removal isn't possible
      }

      try {
        const sites = await getSites();
        delete sites[domain];
        await setSites(sites);
        await renderSitesList(el('sites-search').value);
      } catch (err) {
        return { ok: false, error: 'Removed access, but could not update the site list. Please refresh.' };
      }

      return { ok: true };
    }
  );
}

function confirmReset() {
  openModal(
    'Reset Padlox',
    'Resetting Padlox removes your Padlox password and protected website list. It does not change your Instagram, Facebook, Google, or other website passwords.',
    async (password) => {
      let config;
      try {
        config = await getConfig();
      } catch (err) {
        return { ok: false, error: 'Could not read Padlox config. Please try again.' };
      }

      const valid = await verifyPassword(password, config);
      if (!valid) return { ok: false, error: 'Incorrect password.' };

      try {
        const sites = await getSites();
        const domains = Object.keys(sites);

        for (const domain of domains) {
          const id = 'padlox-' + domain;
          try {
            await chrome.scripting.unregisterContentScripts({ ids: [id] });
          } catch {
            // ignore
          }
          try {
            await chrome.permissions.remove({ origins: buildOriginPatterns(domain) });
          } catch {
            // ignore
          }
        }

        await clearAll();
      } catch (err) {
        return { ok: false, error: 'Something went wrong during reset. Please try again.' };
      }

      document.body.innerHTML =
        '<div class="page"><div class="card"><h2>Padlox has been reset</h2>' +
        '<p class="danger-text">Open the Padlox icon in your toolbar to set up a new password.</p></div></div>';
      return { ok: true };
    }
  );
}

async function onChangePassword(e) {
  e.preventDefault();
  const current = el('current-password').value;
  const next = el('new-password').value;
  const confirm = el('confirm-password').value;
  const errorEl = el('change-password-error');
  const successEl = el('change-password-success');
  errorEl.textContent = '';
  successEl.textContent = '';

  if (next.length < 4) {
    errorEl.textContent = 'New password must be at least 4 characters.';
    return;
  }
  if (next !== confirm) {
    errorEl.textContent = 'New passwords do not match.';
    return;
  }

  const config = await getConfig();
  const valid = await verifyPassword(current, config);
  if (!valid) {
    errorEl.textContent = 'Current password is incorrect.';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const newConfig = await createVerifier(next);
    await setConfig(newConfig);
    await clearUnlocked(); // invalidate any currently-unlocked sessions
    el('current-password').value = '';
    el('new-password').value = '';
    el('confirm-password').value = '';
    successEl.textContent = 'Password updated.';
  } catch (err) {
    errorEl.textContent = 'Something went wrong. Please try again.';
  } finally {
    submitBtn.disabled = false;
  }
}

init();
