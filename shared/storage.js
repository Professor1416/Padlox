// shared/storage.js
// Thin wrappers around chrome.storage. Config + protected-site list live in
// chrome.storage.local (persist across restarts). Unlocked state lives in
// chrome.storage.session (cleared automatically when the browser closes).

export const CONFIG_KEY = 'padlox_config';
export const SITES_KEY = 'padlox_sites';
export const UNLOCKED_KEY = 'padlox_unlocked';
export const ATTEMPTS_KEY = 'padlox_attempts';

export async function getConfig() {
  const data = await chrome.storage.local.get(CONFIG_KEY);
  return data[CONFIG_KEY] || null;
}

export async function setConfig(config) {
  await chrome.storage.local.set({ [CONFIG_KEY]: config });
}

export async function clearConfig() {
  await chrome.storage.local.remove(CONFIG_KEY);
}

export async function getSites() {
  const data = await chrome.storage.local.get(SITES_KEY);
  return data[SITES_KEY] || {};
}

export async function setSites(sites) {
  await chrome.storage.local.set({ [SITES_KEY]: sites });
}

export async function getUnlocked() {
  const data = await chrome.storage.session.get(UNLOCKED_KEY);
  return data[UNLOCKED_KEY] || {};
}

export async function setUnlocked(unlocked) {
  await chrome.storage.session.set({ [UNLOCKED_KEY]: unlocked });
}

export async function clearUnlocked() {
  await chrome.storage.session.remove([UNLOCKED_KEY, ATTEMPTS_KEY]);
}

export async function clearAll() {
  await chrome.storage.local.remove([CONFIG_KEY, SITES_KEY]);
  await chrome.storage.session.remove([UNLOCKED_KEY, ATTEMPTS_KEY]);
}
