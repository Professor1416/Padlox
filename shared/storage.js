// Security storage belongs to the service worker. UI and content scripts must
// use shared/client.js instead of reading verifiers or writing authorizations.
export const CONFIG_KEY = 'padlox_config';
export const SITES_KEY = 'padlox_sites';
export const UNLOCKED_KEY = 'padlox_tab_unlocks';
export const ATTEMPTS_KEY = 'padlox_auth_attempts';
export const SETTINGS_GRANTS_KEY = 'padlox_settings_grants';
