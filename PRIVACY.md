# Padlox Privacy

Padlox is built to work entirely on your device. Here's exactly what that
means.

## What Padlox stores

All Padlox data is stored locally in your browser, using Chrome's
`chrome.storage` API:

- **Your Padlox password** is never stored in plain text. Padlox derives a
  salted PBKDF2 (SHA-256) hash from it and stores only the random salt and
  the resulting hash — not the password itself. Weak PINs/passwords can be guessed offline
  by someone who obtains the verifier.
- **Your protected website list** (e.g. `instagram.com`) is stored locally
  so Padlox knows which sites to lock.
- **Per-tab unlock state** stores a tab ID, document ID, and protected domain
  in session storage. New tabs and reloads require another unlock.
- **Settings authorization** stores a page-bound authorization expiry in
  session storage and expires after five minutes.
- **Failed-password attempts** and cooldown timestamps live in local storage
  and are shared across password actions. They persist across browser restarts
  and extension reloads until successful authentication or an authenticated reset.
  No plaintext attempted passwords are stored.

Only trusted extension contexts can access this storage. The service worker
owns authorization. Websites do not receive the verifier or your password
through Padlox's status messages. Password entry is in the extension popup or
Settings, not the website overlay.

## What Padlox never does

- Padlox never asks for, sees, or stores your Instagram, Facebook, Google,
  or any other website's login credentials.
- Padlox never sends your Padlox password, protected site list, or any
  other data to a server. There is no backend — Padlox has no server to
  send data to.
- Padlox does not use analytics, tracking, or advertising of any kind.
- Padlox does not sell or share data, because it doesn't collect any data
  to sell or share in the first place.
- Padlox does not load or execute any remote JavaScript. Everything that
  runs is included in this extension package.

## Permissions

Padlox only requests the minimum permissions needed to function (`storage`,
`scripting`, `activeTab`), plus optional, per-site host permission that is
requested — and can be granted or denied — only when you choose to protect a
specific site. Padlox does not request blanket access to all websites at
install time.

## Questions

Padlox is a local-only tool with no company or server behind the data it
handles. The authenticated **Reset Padlox** action removes Padlox's verifier,
protected-site list, failed-attempt data, and session authorizations. Uninstalling the extension
removes its extension storage. Padlox cannot guarantee secure erasure of browser
backups or filesystem copies. Your website accounts are unaffected.
