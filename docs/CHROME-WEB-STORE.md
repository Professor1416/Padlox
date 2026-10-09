# Chrome Web Store preparation and release gates

Prepared 9 October 2026 for Padlox 1.0.1. This is a submission draft, not an
assertion of current-policy compliance. Official pages were requested but
returned proxy HTTP 403; reread them before submission and record the review.
No upload, publication, fee payment, or store-console changes have been made.

## Official sources to verify

| Source | Link | Verification status |
| --- | --- | --- |
| Program policies: purpose, permissions, user data, remote code | [Policies](https://developer.chrome.com/docs/webstore/program-policies/policies) | Blocked by proxy; current text unverified |
| User-data definitions and local processing | [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq) | Blocked; current definitions unverified |
| Privacy tab: purpose, justifications, declarations | [Privacy fields](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy) | Blocked; console fields unverified |
| Listing fields | [Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing) | Blocked |
| Screenshots/icons/promotional images | [Images](https://developer.chrome.com/docs/webstore/images) | Blocked; current size/count rules unverified |
| Upload/review/version workflow | [Publish](https://developer.chrome.com/docs/webstore/publish) | Blocked |
| Manifest V3 remote-code guidance | [Remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code) | Blocked; packaged source inspected locally |
| CSP defaults | [CSP reference](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy) | Blocked; manifest uses MV3 default |
| Permission design | [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions) | Blocked; local permission use inspected |
| DPDP official framework and linked notifications | [MeitY](https://www.meity.gov.in/data-protection-framework) | Blocked; current applicability/commencement unverified |

## Store listing draft

Name: **Padlox**

Short description (matches manifest): **Add an extra privacy lock to websites
you stay signed into.**

Single-purpose statement: **Padlox adds a password/PIN-controlled privacy
overlay to user-selected websites in Chrome, with local management of those
selected sites and the Padlox credential.**

Detailed description draft:

> Add a little more privacy to websites you stay signed into. Choose a site,
> approve Chrome's access request, and Padlox covers its page with a lock screen.
> Open the Padlox toolbar popup and enter your Padlox password to unlock that
> tab. Other tabs and full reloads need their own unlock.
>
> Manage your selected sites in password-protected Settings. Use a PIN of at
> least six digits or a password of at least eight characters; a longer, unique
> password is recommended. Authentication has a shared cooldown after failures.
>
> Padlox keeps its verifier and selected website list on your device. It has
> no accounts, backend, tracking, or analytics. Site access is optional and
> requested when you protect a site; DNS permissions cover that domain and
> its subdomains. Padlox requires Chrome 106 or later.
>
> Padlox is an extra privacy layer. It does not stop website scripts, media,
> downloads, network traffic, or developer-tool access to underlying content.
> It cannot prevent disabling/uninstalling the extension, using another
> browser/profile, or a hostile site removing the overlay. Protection is
> unavailable if site permission is revoked. Incognito needs Chrome's separate
> Allow in Incognito setting. Content may be visible before injection, and
> existing tabs should be refreshed after extension updates. Lock your computer
> when you step away. Enter your Padlox password only in the extension popup
> or Settings, never a website.

Publisher display name: **PENDING user/publisher confirmation**.
Private support/contact channel: **PENDING**. Public support fallback:
[GitHub issues](https://github.com/Professor1416/Padlox/issues).
Category/languages/regions: **PENDING console/publisher review**; do not invent
availability or policy certifications.

Privacy policy candidate URL:
[PRIVACY.md on main](https://github.com/Professor1416/Padlox/blob/main/PRIVACY.md).
Public accessibility without login was verified on 9 October 2026 (HTTP 200,
policy content and logged-out markup). Acceptance in the current dashboard
remains pending. A dedicated public policy page can be used later; no new
hosting or tracking service is required by this repository change.

## Permission justifications draft

| Permission | Concrete use | Scope/review consideration |
| --- | --- | --- |
| `storage` | Local verifier/site list/shared cooldown; session tab unlocks/Settings grants | Uses local/session, not sync. Security storage is trusted-context only. |
| `scripting` | Register packaged lock.js at document_start; inject it on Protect; execute a constant function to obtain documentId | Limited to activeTab or granted sites. No remote executable code. |
| `activeTab` | Active URL/hostname and temporary access when the popup is opened | Avoids requesting broad `tabs` permission. |
| Optional `*://*/*` host scope | Allows users to choose arbitrary HTTP(S) hosts for privacy overlays | Required for product's user-selected site scope. Not a blanket install-time grant: popup requests exact generated domain/subdomain patterns in the user's click. Explain wildcard scope to reviewers. |

No new permissions are proposed. Do not claim that the broad optional host
capability disappears merely because actual grants are requested per site.

## Privacy questionnaire preparation

Use current dashboard definitions; local processing and collection/transmission
may be defined differently. Do not auto-select boxes from “no server” alone.

| Actual behavior | Relevant disclosure question to resolve |
| --- | --- |
| Password entered in extension UI; salt/hash/metadata retained locally | Authentication-information/verifier category and local-processing definition |
| Selected hostnames and add timestamps retained locally | Website/browsing-activity category and user-selected list definition |
| Active URL read transiently; tab/document IDs used for authorization | Browsing activity/identifiers definition; no persisted URL paths/history log |
| No developer receipt, backend, telemetry, advertising, sale, or third-party transfer | Whether dashboard collection declarations count purely local processing; answer transfer/use questions against actual definitions |
| Optional user-initiated GitHub policy/support links | Disclose external support destinations; no secrets appended by Padlox |

Make declarations consistent with `PRIVACY.md`, source, and permission use.
Review any required limited-use certification against current wording. Do not
claim certification has been completed in this file.

## Assets and packaging

- Existing package icons are PNGs at 16, 32, 48, and 128 pixels, matching the
  manifest. Check their appearance/readability in the native browser and current
  dashboard asset requirements. Do not infer listing-asset completeness from
  these toolbar icons.
- Create final screenshots from the actual extension in Chrome: first-time
  setup, locked popup, locked website, authenticated Settings, and permission
  recovery if useful. Use fictional/demo domains and never real credentials.
- Verify current screenshot count/dimensions, promotional-tile requirements,
  and text rules in the official Images page/dashboard. Fixture screenshots
  are design evidence and must not be presented as native lifecycle evidence.
- Run `npm test`, `npm audit`, and `npm run package:release` (Python 3.9+).
  The ZIP contains only explicitly allowlisted runtime files plus `PRIVACY.md`.
  Source reference `content/lock.css`, tests, scripts, Git, node_modules, package
  manifests/lockfile, screenshots and store drafts are not included.
- ZIP entries have fixed timestamps/modes and no compression; identical source
  bytes produce identical bytes without compression-library variation. Check
  the generated SHA-256 against the exact file to upload.
- Version 1.0.1 is a review candidate. Confirm the latest published version;
  choose a greater version before submission, align manifest/package/lockfile
  and Settings display, rerun tests/build, and test upgrade from the old version.
- Do not upload the source-repository ZIP. Upload the validated runtime ZIP
  only after the gates below are complete. Publication requires a separate
  explicit user instruction; this task does not submit anything.

## Gates: current evidence and pending work

| Gate | Current evidence | Status |
| --- | --- | --- |
| P0 sender/action authorization, settings gate, fresh password, per-document unlock | Automated worker/controller/UI tests | Automated coverage passes; native checks pending |
| P1 verifier, PIN policy, persistent cooldown, domain and permission recovery | Automated unit/fixture tests | Automated coverage passes; restart/native prompts pending |
| Reset/privacy deletion behavior | Controller reset regression plus real UI fixture | Automated coverage; native grants/storage inspection pending |
| Remote code/dependencies and permissions | Local source/manifest inspection, npm audit | No runtime remote loader or unnecessary new permission found; policy wording pending |
| Privacy accuracy and discoverability | Revised policy, README and Settings link | Repository preparation done; public URL verified; publisher/contact and store acceptance pending |
| Current store/DPDP requirements | Official URLs identified | BLOCKED: proxy 403; no compliance conclusion |
| Store listing/fields/assets/version | Drafts above | PENDING publisher/console and final screenshots |
| Package reproducibility/runtime closure | Automated archive tests and checksum | Review package only; release validation is separate |
| Native Chrome integrity matrix | Managed test environment blocks extension install | BLOCKED here; run outside this managed browser |
| Submission/review outcome | No submission performed | NOT submitted; approval cannot be claimed |

### Native Chrome test record to complete before release

Record OS, exact Chrome version, extension version, source commit, ZIP SHA-256,
steps, actual outcome, and evidence for every case. Use a disposable profile
whose policies allow developer extensions. Do not bypass managed policies.

1. Fresh install/setup; grant a site; verify the actual Chrome prompt scope,
   first lock and popup unlock, correct/wrong credentials, and lock again.
2. Direct Settings URL: site list hidden without authentication; expired grant
   hides/denies access; remove/reset/password change require fresh password.
3. Protected URL open, refresh, second tab, multiple protected sites; only the
   chosen document unlocks. SPA navigation retains authorization within that
   same document; a full navigation requires it again. Confirm this distinction.
4. Normal worker suspension/restart; browser restart; extension disable/enable,
   update and reload. Check retained verifier/sites and intended revocation.
5. Revoked host access, denied prompt, restored access, registration failure
   recovery. No protection is promised while access is absent; restore never
   implicitly unlocks. Refresh existing documents after registration recovery.
6. Exact/domain/subdomain overlap, www/trailing dot, IDN, IPv4 and single-label
   hosts. IPv6 unsupported; no public-suffix dataset. Inspect permission scope.
7. Incognito disallowed and allowed; normal/Incognito tab authorizations should
   not cross-unlock. Record actual spanning-mode behavior, not an assumption.
8. Rapid Lock/Unlock, concurrent failed attempts, cooldown across browser/worker
   restarts and refresh/new tabs. Confirm failures cannot silently unlock.
9. Removal/password change/reset with multiple sites; actual script registrations,
   optional grants, local/session records and UI reflect the result. Test Chrome
   API failure behavior; no success/deletion claim on an error.
10. Measure/record content exposure before first overlay, existing-tab update
    behavior and available-site/network/DOM limitations. Do not claim a guaranteed
    pre-render block. Confirm keyboard/focus, long domains and visible errors.

If any security regression is reproducible, raise it to P0/P1 and fix/test it
before release. Unexecuted cases stay pending; passing mock tests is not a
substitute. This document is a gate record, not a declaration that they passed.

## P3 follow-up

See [the P3 validation record](P3-VALIDATION.md) for the native load probe,
current-source access results, popup regression fix, and updated package
checksum. Local Chrome is available to the user; use [the native worksheet](NATIVE-CHROME-VALIDATION.md)
to record the cases that remain unrun. P3 is on HOLD, not release-cleared.
