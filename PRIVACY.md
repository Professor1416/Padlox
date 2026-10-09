# Padlox Privacy

Padlox is built to work entirely on your device. Here's exactly what that
means.

## What Padlox stores

All Padlox data is stored locally in your browser, using Chrome's
`chrome.storage` API:

- **Your Padlox password** is never stored in plain text. Padlox derives a
  salted PBKDF2 (SHA-256) hash from it and stores only the random salt and
  the resulting hash — not the password itself. There is no way to reverse
  the hash back into your password.
- **Your protected website list** (e.g. `instagram.com`) is stored locally
  so Padlox knows which sites to lock.
- **Which sites are currently unlocked** is stored in session storage, which
  Chrome automatically clears when the browser closes. This is why
  protected sites ask for your password again after a restart.

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
handles. If you uninstall Padlox or use Chrome's "Clear browsing data" for
extension storage, all Padlox data (your password hash, protected site
list, and unlock state) is permanently deleted from your device.
