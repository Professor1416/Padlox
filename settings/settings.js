import {initializePasswords, initializeDialog, clearPasswords} from '../shared/ui.js';
import { request } from '../shared/client.js';
import { validateNewPassword } from '../shared/crypto.js';
import { displayName } from '../shared/utils.js';

let expiryTimer = null;
const el = (id) => document.getElementById(id);

let pendingConfirmAction = null; // async (password) => { ok: boolean, error?: string }

async function init() {
  initializePasswords();
  initializeDialog(el('modal-backdrop'), document.querySelector('.page'), closeModal);
  wireEvents();
  chrome.runtime.onMessage.addListener((message, sender) => {
    const dashboard = el('settings-dashboard');
    if (sender.id === chrome.runtime.id && !sender.tab && message?.action === 'REFRESH_STATUS' && dashboard && !dashboard.hidden) {
      renderSitesList(el('sites-search').value).catch(() => lockSettings());
    }
  });
  el('settings-auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = el('settings-auth-submit');
    button.disabled = true;
    el('settings-auth-error').textContent = '';
    try {
      const authorization = await request('AUTH_SETTINGS', { password: el('settings-auth-password').value });
      clearTimeout(expiryTimer);
      expiryTimer = setTimeout(lockSettings, authorization.expiresInMs);
      await renderSitesList();
      el('settings-gate').hidden = true;
      el('settings-dashboard').hidden = false;
    } catch (error) { el('settings-auth-error').textContent = error.message; }
    finally { el('settings-auth-password').value = ''; button.disabled = false; }
  });
}

async function renderSitesList(filterText = '') {
  const { sites } = await settingsRequest('LIST_SITES');

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
    renderSitesList(e.target.value).catch(error => { lockSettings(); el('settings-auth-error').textContent = error.message; });
  });
}

function openModal(title, message, onConfirm) {
  el('modal-title').textContent = title;
  el('modal-message').textContent = message;
  clearPasswords(el('modal-backdrop'));
  el('modal-error').textContent = '';
  pendingConfirmAction = onConfirm;
  el('modal-backdrop').hidden = false;
  setTimeout(() => el('modal-password').focus(), 0);
}

function closeModal() {
  if (el('modal-backdrop')) el('modal-backdrop').hidden = true;
  if (el('modal-backdrop')) clearPasswords(el('modal-backdrop'));
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
    errorEl.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    el('modal-password') && (el('modal-password').value = '');
    confirmBtn.disabled = false;
  }
}

function lockSettings() {
  clearTimeout(expiryTimer);
  closeModal();
  if (!el('sites-list')) return;
  el('sites-list').replaceChildren();
  clearPasswords();
  el('settings-dashboard').hidden = true;
  el('settings-gate').hidden = false;
}
async function settingsRequest(action, payload = {}) {
  try { return await request(action, payload); }
  catch (error) {
    if (error.message === 'Authenticate Settings again.') lockSettings();
    throw error;
  }
}
function confirmRemoveSite(domain) {
  openModal('Remove protection?', `Remove protection from ${domain}? Enter your Padlox password.`, async (password) => {
    await settingsRequest('REMOVE_SITE', { domain, password });
    await renderSitesList(el('sites-search').value);
    return { ok: true };
  });
}
function confirmReset() {
  openModal('Reset Padlox', 'Remove your Padlox password and protected website list? This does not change your website accounts.', async (password) => {
    await settingsRequest('RESET', { password });
    closeModal();
    clearTimeout(expiryTimer);
    document.body.innerHTML = '<div class="page"><div class="card"><h2>Padlox has been reset</h2><p>Open the Padlox toolbar icon to create a new password.</p></div></div>';
    return { ok: true };
  });
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

  try { validateNewPassword(next); }
  catch (error) { errorEl.textContent = error.message; return; }
  if (next !== confirm) {
    errorEl.textContent = 'New passwords do not match.';
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    await settingsRequest('CHANGE_PASSWORD', { password: current, next });
    lockSettings();
    el('settings-auth-error').textContent = 'Password updated. Sign in again.';
    el('current-password').value = '';
    el('new-password').value = '';
    el('confirm-password').value = '';
    successEl.textContent = 'Password updated.';
  } catch (err) {
    errorEl.textContent = err.message || 'Something went wrong. Please try again.';
  } finally {
    submitBtn.disabled = false;
  }
}

init();
