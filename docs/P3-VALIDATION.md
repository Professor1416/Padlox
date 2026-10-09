# P3 release-validation record

Date: 9 October 2026. Baseline commit:
`46d70c5abc50a28c8817c641f12d91332b451c84`, clean tree at start.
Candidate: 1.0.1 plus the popup UI fix in the commit containing this record.
No new permission/dependency, version bump, security-architecture change,
Chrome policy change, upload, or submission was performed.

**Decision: HOLD — native integration and current policy gates remain open.**

## Executed checks

| Check | Evidence / actual result | Outcome |
| --- | --- | --- |
| Baseline complete automated suite | `npm test`: 43 checks passed, zero failed/skipped | PASS for automated coverage only |
| Native load probe | Chromium 151.0.7922.173 on Debian 13; isolated temporary profile; normal `--load-extension` attempt, default extension disabling removed for the probe; managed policies unchanged. Padlox absent from extension items; no Padlox service worker loaded. | BLOCKED / native scenarios NOT RUN |
| Browser policy | Existing `ExtensionInstallBlocklist: ["*"]` in `/etc/chromium/policies/managed/extensions.json` | Confirms managed restriction; not modified/bypassed |
| Official-source retry | Chrome program policies, privacy fields, Images, and MeitY framework all return proxy tunnel HTTP 403 | BLOCKED; current requirements NOT verified |
| Public policy URL | Normal cookie-free HTTPS request to GitHub policy URL returns 200; page includes the policy title/retention sections and GitHub logged-out markup | PASS for public accessibility, not store acceptance |
| Published version evidence | GitHub remote has no tags; no authenticated store-console evidence supplied | Store version UNKNOWN; no version chosen/invented |
| Focused popup regression before fix | Successful **Lock now** leaves **Already locked** enabled; new test fails `false !== true` for disabled-state assertion | REPRODUCED; see fix below |
| Complete suite after fix | `npm test`: 44 checks passed, zero failed/skipped | PASS for automated coverage only |
| Dependency advisories | `npm audit --json`: zero reported advisories | PASS for known-advisory check, not proof of no vulnerabilities |
| Runtime ZIP | `npm run package:release`: 23 allowlisted files, 77,288 bytes; archive CRC and SHA-256 independently read/checked | PASS for package integrity |
| Reproducibility/reference closure | Release tests verify byte equality across builds, checksum, referenced assets/imports, exclusions, icon dimensions, versions/styles, symlink rejection | PASS |
| Extracted-package browser UI | Real packaged HTML/JS/CSS served to Chromium with mocked Chrome APIs; six UI scenarios plus parent check | PASS: 7 reported checks, zero failed/skipped; still NOT native extension evidence |

Toolchain: Node v24.19.0, Python 3.12.14, Chromium 151.0.7922.173.

## Confirmed UI issue and minimal patch

Evidence: `popup/popup.js:perform` always set `button.disabled = false` in
`finally`, overriding `render`'s disabled state for the already-locked button.
The regression fixture verifies a storage-write failure remains retryable, then
retries successfully and asserts that the button is disabled and says
**Already locked**. Before the patch the success assertion failed; after the
patch it passes in both the source and extracted runtime package.

Impact: misleading/redundant lock action after success. Confidence: high, real
UI/controller reproduction with mocked APIs. This is a UI-state defect; the
controller still controls authorization, so the reproduction does not establish
a password or lock bypass. Remediation: preserve the state chosen by render
for a successful Lock action; re-enable a failed action for retry. No worker,
verifier, storage-boundary, or sender-validation logic changed.

Loop record: inspect → reproduce with regression → minimal popup patch →
complete suite → extracted-package independent check. One reproduction run,
one patch, and passing verification; no failing assertion disabled or hidden.
No retries attempted to evade browser policy or network restrictions.

## Review candidate identity

Filename: `dist/padlox-1.0.1.zip`.
SHA-256: `511e18801e27f00b4c06de228005911bfb703ff4f1c918b2856e77a3db43377f`.

Version 1.0.1 remains a development review candidate. Confirm the highest
published store version and choose a greater version for a real update. Align
manifest/package/lockfile/Settings text, rerun checks/package, and test the
actual versioned upgrade. Changing the version now would invent store state.

## Remaining gates and next action

The user confirmed local Chrome with Developer mode/Load unpacked is available.
This is not a test result. Follow [the native worksheet](NATIVE-CHROME-VALIDATION.md)
using a disposable profile and the identified ZIP. Begin with N01–N06; record
actual Chrome version and outcomes. All N01–N18 remain UNRUN until reported.
Native lock, permissions, Incognito, restart/upgrade, first paint, and registration
failure gates are not closed by automated fixtures.

Current official sources require network access to `developer.chrome.com` and
`www.meity.gov.in` (plus official notification destinations used). No environment
allowlist was replaced. Verify current policy wording, privacy-questionnaire
categories, image requirements, and DPDP applicability/commencement before release.
The public privacy URL was checked; its acceptance by the store is still pending.
Publisher display name, appropriate private contact, store fields, highest
published version, and final native screenshots also remain pending.

No new verified critical security issue was established in the checks that ran.
This limited statement does not assert that untested native behavior is secure.
No release approval, legal compliance, store submission, or Google approval is
claimed. The policy and browser blockers prevent finishing P3 in this cloud.
