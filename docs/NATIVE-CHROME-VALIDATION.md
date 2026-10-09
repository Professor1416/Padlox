# Native Chrome validation worksheet

This worksheet runs the installed extension with actual Chrome APIs. Automated
HTTP-served UI tests use mocked APIs and do not complete these gates. All cases
below are **UNRUN** until a tester records actual results. Local Chrome was
confirmed available by the user, not tested by the cloud agent.

## Candidate and setup

Candidate: Padlox 1.0.1, including the P3 popup disabled-state fix. Use the
commit containing `docs/P3-VALIDATION.md`, or build its runtime ZIP.

ZIP: `dist/padlox-1.0.1.zip` (77,288 bytes, 23 files).
SHA-256: `511e18801e27f00b4c06de228005911bfb703ff4f1c918b2856e77a3db43377f`.
A repository-source ZIP has a different checksum; do not confuse the two.
No `npm install` is necessary to load the extracted runtime ZIP.

1. Use a new, disposable Chrome profile without your personal accounts or
   existing Padlox data. Tests below intentionally remove/reset test protection.
2. Download and extract the runtime ZIP. If building from source, follow the
   README's test and packaging commands first.
3. Open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**,
   and select the extracted folder containing `manifest.json`. If administrator
   policy forbids loading, mark the native run BLOCKED; do not bypass the policy.
4. Pin Padlox. Record the Chrome version (the version row in `chrome://version`),
   OS, Padlox version, candidate commit/checksum, and run date.
5. Create a throwaway Padlox password of at least eight characters. Do not put
   your real password, verifier, profile path, or private site list in results.

Optional checksum verification:

```powershell
Get-FileHash .\padlox-1.0.1.zip -Algorithm SHA256
```

On macOS: `shasum -a 256 padlox-1.0.1.zip`.
On Linux: `sha256sum padlox-1.0.1.zip`.

## First run: core checks

Run these in order using demo domains, not signed-in personal websites.

| ID | Exact action | Expected outcome | Actual / status |
| --- | --- | --- | --- |
| N01 | Open `https://example.com`, open Padlox, choose **Lock this site**, read/approve Chrome's prompt. | Request covers the chosen domain/subdomains, not every website. Page is covered after injection. Record any visible content before the overlay; zero first-paint exposure is not promised. | UNRUN |
| N02 | Open the popup, try a wrong password; after the displayed cooldown, try the correct password. | Wrong password leaves page locked. Correct password unlocks this tab and clears its input. Overlay itself has no password field. | UNRUN |
| N03 | Open the same URL in another tab while the first is unlocked, then fully refresh the first. | Second tab and refreshed first tab are locked. Unlocking one does not unlock the other. | UNRUN |
| N04 | Unlock one tab; choose **Lock now**, then reopen the popup. | That tab locks. **Already locked** is disabled both immediately and after reopening. The other tab remains independently protected. | UNRUN |
| N05 | Open Settings using the gear. Before authentication, try viewing the dashboard; then authenticate and leave it open for over five minutes. | Site list initially hidden. Correct password grants access. Expiry hides/denies access and clears password fields, even if Show was selected. Opening Settings anew requires authentication. | UNRUN |
| N06 | Re-authenticate Settings. Try **Remove protection** with a wrong password, then cancel. After cooldown, change the Padlox password using the current password and a valid new one. | Wrong removal does not delete protection. Successful password change locks previously unlocked tabs and ends Settings access. New credential works; old one does not (observe cooldown between attempts). | UNRUN |

Return the first results in this form:

```text
OS:
Chrome version:
Padlox version / candidate commit or ZIP checksum:
N01: PASS / FAIL / BLOCKED — actual prompt scope and any first-paint exposure
N02:
N03:
N04:
N05:
N06:
Any extension errors: message only, with secrets/private URLs removed
```

A simple “working” response does not close cases that were not run. If a case
fails, record the exact steps, tab/reload state, expected and actual behavior;
stop calling that gate passed. These first checks are a subset of release gates.

## Remaining release checks

| ID | Action / setup | Expected outcome / evidence | Actual / status |
| --- | --- | --- | --- |
| N07 | Add `https://example.org`; unlock only one of the two domains; rapidly lock/unlock using the popup. | Authorization remains tab/document specific. Final visible state matches the last completed action; no crash/stuck controls or silent unlock. | UNRUN |
| N08 | Close worker DevTools, let Chrome suspend the worker, then reopen Padlox. Separately quit/restart Chrome with the test tabs restored. | Ordinary worker activation preserves healthy document unlocks. Browser restart retains verifier/sites/cooldown but requires document unlocks again. Record actual restart separately from suspension. | UNRUN |
| N09 | While locked, fail a password attempt and retry from a reload/second tab during the cooldown. For the browser-restart case, make seven sequential wrong attempts, waiting each displayed cooldown before the next; the seventh starts about 64 seconds. Quit/restart within that window and retry. | Attempts share the persisted cooldown; refresh/new tabs/restart do not reset it. Correct password must also wait while cooldown is active. Record the attempt time and elapsed restart time so a naturally expired delay is not mistaken for lost persistence. Do not claim the full 15-minute cap was tested unless it was. | UNRUN |
| N10 | Revoke example.com host access in Chrome's extension Details/site-access controls; revisit it and open Padlox; then **Restore site access** and approve. | Requested-site list remains; popup reports unavailable protection and offers restoration. There is no protection guarantee while access is absent. Restoration does not unlock; fresh password needed. Reload existing documents if registration recovery did not cover them. | UNRUN |
| N11 | In a test profile, deny a new site's optional access request. Exercise a genuine registration failure using a reviewed local test arrangement, if available. | Denied access does not record a newly protected site. Registration failure shows an error/retry path; no false success or automatic unlock. Do not manufacture this test by modifying the release code. | UNRUN |
| N12 | Disable/re-enable Padlox; separately use **Reload** in chrome://extensions. Refresh existing protected tabs afterward. | Protection is unavailable while disabled. Config/site list survives; prior session unlocks/Settings access are revoked. Updated overlay loads after tab refresh. Record existing-tab exposure as a limitation. | UNRUN |
| N13 | Test upgrade from an actual older supported release in a disposable profile to the chosen greater-version candidate. | Existing verifier/sites retained; session unlocks/grants revoked; no migration loss or silent recovery reset. Same-version developer Reload does not complete this upgrade test. | UNRUN |
| N14 | Incognito with **Allow in Incognito** off, then on. Compare normal and Incognito tabs, including simultaneous unlocks. | No protection claim when disabled. When enabled, each document's unlock stays independent; normal/Incognito tabs do not cross-unlock. Record actual manifest-default spanning behavior. | UNRUN |
| N15 | Test DNS exact/subdomain overlap, www/trailing dot, IDN, IPv4 and single-label hosts using controlled reachable pages; record Chrome prompt scopes. | Canonicalization/boundaries match documented behavior; most-specific rule is used. IPv6 remains unsupported. No public-suffix blocking is claimed. | UNRUN |
| N16 | On a controlled SPA, change routes with history.pushState while unlocked; then perform a full document navigation. | Same-document SPA routing retains the unlock; full navigation does not. Underlying page scripts/network still run while covered; the extension does not promise to stop them. | UNRUN |
| N17 | Remove a protected site with correct fresh authentication; verify the site list, granted origins, registered scripts and session state in the test extension's DevTools. Then reset the disposable installation using the current password. | Successful removal/reset clears the documented tracked records and requests/removes applicable capabilities. No success claim after an API error. Reset leaves first-time setup; website accounts are unaffected. | UNRUN |
| N18 | Keyboard-only popup/Settings/modal; Show/Hide, Escape/Tab focus, errors, narrow Settings window and long domains. Inspect chrome://extensions Errors. | Labels/focus/error feedback readable, modal focus contained/restored, no horizontal overflow or unexpected runtime errors. | UNRUN |

For N11 and other failure/lifecycle cases, mark a missing test arrangement UNRUN
or BLOCKED. Do not replace actual browser behavior with mocked assertions.
For worker/registration inspection, use only the disposable extension profile;
do not paste security storage or passwords into an issue or chat.

## Final assets and release decision

Capture final screenshots from the native extension only after behavior is
validated. Use demo domains and empty/masked inputs: setup, locked popup, lock
overlay, authenticated Settings, and permission recovery where useful. Confirm
current store image rules before choosing final sizes/counts. Existing fixture
screenshots are design previews, not native test evidence.

All required native cases, current official policy review, published-version
confirmation, publisher/contact/store disclosures, and final assets must be
resolved before recommending release. Completing this worksheet does not
submit to the Chrome Web Store or prove approval. See `CHROME-WEB-STORE.md`.
