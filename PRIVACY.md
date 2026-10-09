# Padlox Privacy Policy

Last updated: 9 October 2026

This policy describes the Padlox Chrome extension maintained in the
[Professor1416/Padlox repository](https://github.com/Professor1416/Padlox).
Padlox adds a local privacy overlay to websites you select. It does not
replace your operating system lock or your website accounts' security.

## Data processed on your device

Padlox uses Chrome's local extension storage, not `chrome.storage.sync`:

- **Password verifier:** a random salt, a PBKDF2-SHA256 derived hash, algorithm,
  iteration count, format version, and creation timestamp. Padlox does not
  persist your plaintext password. Someone who obtains the verifier can try
  guessing passwords offline; longer, unique passwords are recommended.
- **Protected websites:** normalized domain names and the time protection was
  added. Protection covers a selected DNS domain and its subdomains; single-label
  hosts and IPv4 addresses use an exact host match.
- **Failed authentication:** a shared failed-attempt count and cooldown expiry.
  These persist across browser restarts and extension reloads. Successful
  authentication clears the counter; authenticated reset clears it as well.
  Attempted passwords are not stored in this counter.

Chrome's in-memory extension session storage holds:

- **Tab unlocks:** tab ID, document ID, and protected domain. Authorization is
  specific to a tab and document; another tab or a full reload requires another
  unlock. Closing a tab removes its authorization.
- **Settings access:** Settings tab/document identifiers and a five-minute
  authorization expiry. Expired grants cannot authorize Settings actions;
  records can remain until later authentication, tab cleanup, or session clearing.

Session storage is cleared when Chrome ends the session or the extension is
reloaded, updated, or disabled. Ordinary service-worker suspension does not
clear healthy document unlocks. Chrome also retains granted site permissions
and registered content-script patterns as browser-managed extension settings.
These are separate from the extension's local/session storage.

When you open the popup, Chrome supplies the active tab's URL. Padlox uses it
locally to identify the hostname and the current document. A URL can contain a
path or query string, but Padlox does not persist those values or a browsing
history. The service worker enumerates tab IDs to notify existing lock screens
when protection changes. Padlox does not request the `history` permission or
call Chrome's browsing-history API. Protected content scripts check the status
of their own page; they do not collect page contents or website login fields.

Your Padlox password is passed from the extension popup or Settings to the
extension service worker for verification. It is not sent to website scripts.
Only trusted extension contexts can access security storage. Password fields
are cleared after verification attempts and when Settings locks.
JavaScript and browser memory cannot provide a guarantee of secure erasure.

## Transmission, tracking, and third parties

Padlox has no backend and makes no runtime network requests for analytics,
advertising, telemetry, or password verification. It does not send passwords,
verifiers, selected domains, or unlock state to the developer or third parties.
Padlox does not sell or share this data. All executable code is packaged with
the extension; there are no remotely loaded scripts or runtime dependencies.

Opening the privacy-policy or support links is optional and opens GitHub.
Those visits are handled by your browser and GitHub's privacy practices; the
extension does not append your password or protected-site list to the links.
Website traffic and Chrome's own update/browser services are outside Padlox's
control. Padlox does not stop the protected website's scripts, media, downloads,
or network requests while its overlay is visible.

## Permissions and choices

- **`storage`:** retain the verifier, selected sites, authentication cooldown,
  and session authorization described above.
- **`scripting`:** register the packaged lock screen for selected sites and
  identify/inject into the current document when you protect or unlock it.
- **`activeTab`:** read the active page's URL and obtain temporary access after
  you open Padlox. It avoids requesting the broader `tabs` permission.
- **Optional host access:** Chrome asks for access when you choose **Lock this
  site** or **Restore site access**. Requests cover HTTP and HTTPS on that
  domain and its subdomains, not every website at install time. IPv4 and
  single-label hosts are exact matches. The manifest permits requesting any
  HTTP(S) site so you can choose your own sites; actual grants are requested
  for individual site patterns. Always review Chrome's permission prompt.

You may deny or revoke site access. The selected domain remains in Padlox's
list so you can restore it, but protection is unavailable without permission.
Incognito protection is off unless you enable **Allow in Incognito** in
Chrome. Unprotected profiles, browsers, and sites remain outside Padlox's scope.

## Retention and deletion

The verifier and selected sites remain until you change/remove them, reset
Padlox, or uninstall it. Authentication counters remain until successful
authentication or reset. Session authorization follows the retention described
above. Padlox does not expire your protected-site list automatically.

**Remove protection**, in authenticated Settings, removes the selected domain
from Padlox's list and requests removal of its script registration and site
permission. **Reset Padlox**, with fresh password confirmation, removes its
verifier, selected sites, failed-attempt data, and session authorizations, and
requests removal of tracked site registrations and permissions. A failed action
shows an error; do not assume deletion succeeded if Chrome reports a failure.

Uninstalling removes Chrome's extension data. Padlox cannot delete copies in
browser-profile backups or guarantee forensic erasure. Reset/uninstall does
not change or delete your website accounts. There is no password-recovery
service; reinstalling requires setting up protection again.

## Contact

Questions or privacy concerns can be raised through the
[project issue tracker](https://github.com/Professor1416/Padlox/issues).
GitHub issues are public: do not include passwords, verifier data, or private
website lists.

Padlox cannot protect against someone who controls your device. See the
[security limitations](https://github.com/Professor1416/Padlox#security-limitations)
for its scope.
