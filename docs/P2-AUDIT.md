# P2 privacy and release-preparation audit

Audit date: 9 October 2026. Baseline: `fd0f6d7694b2548fa785b8c1f33afa0feb89850a`.
Baseline working tree was clean; manifest/package version was 1.0.1.
Baseline `npm test`: 39 passing checks, zero failures/skips. Baseline
`npm audit`: zero reported advisories, including development dependencies.
These results are not native-extension or legal/store certification.

## Scope and outcome

Inspected manifest, worker authorization/lifecycle, popup, Settings, content
script, shared helpers, tests, dependencies, privacy/README, and icons.
No security architecture, permissions, verifier format, or credential policy
is changed in P2. Documentation, a user-visible privacy link, and deterministic
packaging address repository gaps. No new verified P0/P1 vulnerability was
established by this audit. Earlier security tests passing does not settle
untested native-browser assumptions.

## Findings and disposition

| ID / priority | Evidence | Impact | Confidence | Remediation / status |
| --- | --- | --- | --- | --- |
| P2-01 | Baseline `PRIVACY.md` says Padlox does not “collect any data”; `shared/crypto.js` stores verifier metadata/creation time and worker stores selected domains/add times. | Broad wording hides local processing and complicates store disclosures. | High: source inspection. | Replaced with a field-level local-processing and transmission policy. |
| P2-02 | `popup/popup.js` uses `tabs.query` and the active URL; worker uses tab IDs and page/document identifiers. No `history` API/permission is present. | “No history permission” alone is an incomplete explanation of URL handling. | High: source inspection. | Disclosed transient active-URL processing, stored hostnames only, and tab notifications. |
| P2-03 | `shared/utils.js:buildOriginPatterns` requests HTTP(S) exact domain plus wildcard subdomains for DNS names. Baseline README says “specific website only.” | Users can misunderstand permission scope. | High: source and domain tests. | Policy/README explicitly disclose domain and subdomain scope, with exact-match IPv4/single-label exceptions. |
| P2-04 | Session grants are denied after expiry but not immediately deleted; tab closure cleans grants and unlocks. Worker activation preserves healthy unlocks; install/reload clears session authorization. | Retention must distinguish authorization expiry from record deletion and worker suspension from browser restart. | High for controller behavior; native lifecycle still pending. | Documented these distinctions; native lifecycle gate retained. |
| P2-05 | Baseline Settings lacks a policy link/contact explanation. | User-facing disclosures and reviewer navigation are incomplete. | High: actual HTML. | Added policy link; policy identifies repository and public issue contact. Private contact/publisher identity pending. |
| P2-06 | No release script; README refers to an unavailable `Padlox-v1.zip`. | Ad hoc archives can include development files; installation directions are misleading. | High: tracked files. | Added allowlisted deterministic ZIP/checksum command and corrected installation instructions. |
| P2-07 | No store listing/privacy-questionnaire draft, manual release matrix, or verified published-version record. | Submission is incomplete; update/version behavior cannot be certified. | High for repo gaps; store-console state unknown. | Added checklist and listing/permission drafts; publisher must confirm console fields and version. |
| P2-08 | Official Chrome and MeitY HTTPS requests return proxy tunnel HTTP 403, including after a network permission grant. | Current policy wording, questionnaire definitions, image requirements, and DPDP commencement/Rules cannot be verified here. | High for access failure; no current-policy/legal conclusion. | Explicitly blocked: read linked official sources before submission. Enable access to `developer.chrome.com`, `www.meity.gov.in`, and any official gazette links used. Do not replace an unknown environment allowlist. |
| P2-09 | Managed Chromium policy includes `ExtensionInstallBlocklist: ["*"]`; automated browser tests serve real UI/controller with mocked APIs. | Native injection, permission prompts, Incognito, restart/update behavior and first paint remain unverified. | High: policy and fixture inspection. | Native Chrome release gates remain pending. Do not alter managed policies to bypass this restriction. |
| P2-10 | Baseline README promises users will hit the screen “first” and says the current tab locks “immediately”; injection is asynchronous. | Timing claims can overstate privacy protection. | High for asynchronous injection; actual first-paint timing unmeasured. | Removed timing guarantees and documented possible content exposure before injection. |
| P3-01 | JavaScript secrets are transient strings; clearing inputs does not wipe engine/browser memory or profile backups. | No forensic-erasure guarantee is appropriate. | High. | Policy documents practical clearing and erasure limits; no security-theater wiping added. |

## Confirmed strengths and data flow

- Manifest V3; packaged module worker; `minimum_chrome_version` 106.
- Only `storage`, `scripting`, and `activeTab` are required. Optional
  `*://*/*` enables users to select arbitrary HTTP(S) sites; grants are requested
  for generated site patterns on an explicit click. No new permission is needed.
- No `tabs`, `history`, `cookies`, `webRequest`, `identity`, or unlimited-storage
  permission. Calling `tabs.query` for IDs does not itself require `tabs`; active
  URL visibility relies on `activeTab`/granted host access.
- MV3's default extension CSP applies because no custom CSP is declared.
  Source contains packaged scripts/modules only; no eval, remote-code loader,
  analytics, backend, fetch/XHR/WebSocket, or storage.sync usage was found.
- Content scripts receive only their own protection/unlock flags. Verifier
  storage and password verification stay in trusted extension contexts.
- Static lock markup is constructed with `innerHTML`; it contains packaged
  CSS/constant SVG and text, not website/password/domain input. Site rows use
  textContent. This inspection did not establish DOM XSS.
- Password verifier and chosen domains are in local storage. Shared cooldown
  persists locally. Unlocks and five-minute Settings grants live in session
  storage. Registered script patterns and host grants are Chrome-managed.
- Reset unregisters tracked scripts and requests permission removal before
  removing tracked data; successful authentication removes cooldowns. A failure
  can leave a partial result, so documentation does not promise silent success.
- Existing browser fixtures verify authenticated reset and password-field
  cleanup; P2 adds a focused reset-data/permission-request regression.

## India's DPDP framework: applicability review, not a conclusion

The applicable framework must be checked against the current official Act,
commencement notifications, Rules, and amendments on the actual release date.
The official sites could not be read in this environment. This audit does not
assert that all provisions are in force, name a compliance deadline, or claim
that local-only operation creates a blanket exemption.

Digital domain lists or identifiers can be personal data in context. Determine
who determines the processing purpose/means, whether the developer/publisher
processes personal data within the Act's territorial/material scope, and which
provisions are currently operative. An individual user's personal/domestic use
and a publisher's activities are separate questions; do not assume a user's
exemption covers a publisher. No backend, developer receipt, analytics, or
account system was found in the extension. GitHub support/store publishing are
separate activities and their data handling must also be considered.

Before publication, verify publisher identity, an appropriate contact channel,
any applicable notice/consent and rights/grievance mechanisms, and relevant
security/retention duties with current official materials or qualified counsel.
Reassess if telemetry, accounts, cloud sync, billing, or private support intake
are introduced. These are review recommendations, not verified legal duties
for this particular deployment.

## Release decision

**Not release-cleared.** Repository preparation is reviewable, but native Chrome
regression, current official policy/legal verification, publisher/contact
fields, store disclosures, published-version confirmation, and final authentic
store screenshots remain pending. The package is a review candidate, not a
submitted or approved Chrome Web Store release. Packaging/tests do not prove
Google approval. See [the store checklist](CHROME-WEB-STORE.md).

## P2 validation record

`npm test` after the P2 changes: 43 checks passed, zero failed/skipped. This
includes reset retention/capability-request verification and archive tests for
reproducible bytes, checksum, runtime-reference completeness, icon dimensions,
excluded private/development files, mismatched versions, stale styles, and
symlink rejection. The existing UI regressions passed with the privacy link.
`npm audit` reported zero known advisories; this is not proof of no vulnerabilities.
`npm run package:release` generated the local review ZIP/checksum. Native Chrome
and official policy/legal checks were not executed successfully and stay pending.

The extracted 23-file ZIP was independently read/CRC-checked and its checksum
verified, then the popup/Settings/overlay browser fixture was run against its
packaged HTML/JS/CSS: all 6 reported checks passed (5 scenarios plus their
parent). These still use mocked Chrome APIs. Candidate ZIP SHA-256:
`ec130a2e5df7fe63f6b509fd47acc0416e4cbb4f1910ea48628dcf3850d711d9`.
