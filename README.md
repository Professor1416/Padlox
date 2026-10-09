# Padlox

Padlox adds an extra privacy lock to websites you stay signed into (Instagram,
Facebook, or anywhere else). If someone opens a protected site on your
computer, they'll hit a Padlox screen first and need your Padlox PIN or
password before the page becomes usable.

Padlox is a **browser-level privacy layer**. It is not a replacement for
locking your computer, and it can't stop someone who has full access to your
device (see **Security limitations** below).

## Development tests

Use Node.js 22 or newer. Install test dependencies with `npm ci`, then run
`npm test`. The browser regression test uses Chromium at `/usr/bin/chromium`;
set `CHROMIUM_PATH` to your Chrome or Chromium executable on other systems.
It serves Settings locally with mocked Chrome APIs, so it does not need to
load an unpacked extension. Run `npm run test:unit` for the browser-independent
password and domain tests only. Test dependencies are not needed to install
the extension.

## Installing locally

1. Download and unzip `Padlox-v1.zip`.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right toggle).
4. Click **Load unpacked**.
5. Select the extracted `padlox` folder (the one that directly contains
   `manifest.json`).
6. The Padlox icon will appear in your toolbar. Pin it for quick access.

## Getting started

### 1. Create your Padlox password

The first time you open Padlox, you'll be asked to create a Padlox
PIN/password. This is completely separate from your Instagram, Facebook, or
any other website password — Padlox never asks for those.

- Minimum 4 characters
- A 6+ digit PIN or a stronger password is recommended
- Padlox cannot recover this password if you forget it, so keep it somewhere safe

### 2. Protect a site

1. Visit the site you want to protect (e.g. `instagram.com`).
2. Click the Padlox icon.
3. Click **Lock this site**.
4. Chrome will ask you to approve access to that specific website — this is
   what lets Padlox show the lock screen there. Approve it.

The site is now protected. The tab you're currently on stays usable; the
lock screen appears the next time that site is opened or reloaded, or as
soon as you click **Lock now**.

The popup shows a simple count of how many sites are protected — full
management (search, remove protection) lives in **Settings**, so things
stay usable whether you've protected 2 sites or 200.

### 3. Unlock a protected site

When you (or anyone else) opens a protected site, Padlox covers the page
and asks for your Padlox PIN/password. Enter it and click **Unlock**.

### 4. Lock a site again

Open the Padlox popup on that site and click **Lock now**.

### 5. Remove protection

Open Padlox → the settings gear icon → find the site under **Protected
websites** → **Remove protection**. You'll be asked for your Padlox
password to confirm.

## Settings

From the popup, click the gear icon (or **Manage protected sites**) to open
**Padlox Settings**, where you can:

- Search and remove protection from any site (works well even with a large list)
- Change your Padlox password
- Reset Padlox entirely (clears your Padlox password and protected site
  list — it does not touch your website accounts)

## Incognito windows

Chrome disables all extensions in Incognito windows by default. If you open
a protected site in Incognito, Padlox will **not** show a lock screen
unless you've explicitly allowed it: go to `chrome://extensions`, click
**Details** under Padlox, and turn on **Allow in Incognito**.

## Permissions, explained

Padlox asks for as little as possible up front:

- **storage** — to save your Padlox password (as a salted hash, never in
  plain text), your protected site list, and which sites are currently
  unlocked for this browsing session.
- **scripting** — to show the lock screen on protected sites.
- **activeTab** — to see which site you're currently on when you open the
  popup.

Padlox does **not** request access to every website up front. When you
protect a site, Chrome asks you to approve access to that specific site
only, at that moment.

## Security limitations

Padlox is an additional browser privacy layer, not a full security system.
It **cannot** stop someone who has direct access to your computer from:

- Disabling or uninstalling the Padlox extension
- Using a different Chrome profile
- Using a different browser entirely
- Accessing the site through Chrome's incognito mode unless Padlox is
  enabled there

For real protection when you step away, lock your computer (Windows key + L,
`Cmd+Ctrl+Q` on macOS, etc.) — Padlox is a helpful extra layer on top of
that, not a substitute for it.

See `PRIVACY.md` for details on what Padlox stores and what it never does.
