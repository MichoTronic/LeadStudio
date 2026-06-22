# 01 Architecture And Code Health Review Report - 2026-06-22

Scope: Lead Studio V2 candidate after UI stabilization, date filtering, folder restructuring, review-pack setup, scheduled-refresh helper implementation, and deployment through Apps Script version 51.

## Architecture Findings

Healthy:

- Live Apps Script deployment source is isolated under `AppsScript/`.
- `.clasp.json` points `rootDir` to `AppsScript`, so root control docs and archives are no longer deploy candidates.
- Root is now mostly navigation/control material: `README.md`, `PROJECT_STATUS.md`, `.clasp.json`, `.claspignore`, and top-level project folders.
- Current source boundaries are understandable:
  - `Code.js`: web entry points, UI-callable backend functions, setup/test endpoint routing, scheduled refresh wrapper.
  - `Config.js`: app, Gmail, Jira, onboarding-sheet, table, and option configuration.
  - `GmailScanner.js`: Gmail querying, lead/onboarding parsing, text cleanup.
  - `Storage.js`: sheet reads/writes, onboarding/Jira persistence, debug logging.
  - `OnboardingSheet.js`: onboarding request lookup and normalization.
  - `Jira.js`: Jira auth, issue status lookup, lifecycle mapping.
  - `GoogleAuth.js`: delegated Gmail OAuth.
  - `Setup.js`: setup helpers, Script Properties helper, trigger install/remove/status helpers.
  - `Index.html`, `Styles.html`, `Script.html`: UI shell, styling, and browser behavior.
- Rollback snapshots are under `Archive/Snapshots/`.
- Reusable completion-review templates are under `Phase_Completion_Review_Pack/`.
- Completed review reports now live under `Reports/`.

## Risks Still Present

- `ProjectControl/DocumentationArchive/NOTES.md` contains sensitive historical material and must not be committed or shared.
- `Setup.js` and token-protected setup/test URL actions still exist. They are useful for setup but should be narrowed or removed after V2 stabilization if not needed.
- `Script.html` and `GmailScanner.js` are large files. They are acceptable for V2 but should not absorb every future feature without tests.
- There is no automated Apps Script unit/smoke test harness for parser behavior, date filtering, Jira matching, or sheet updates.
- The scheduled refresh helper is implemented, but the actual time-driven trigger still needs one-time owner authorization/install.

## Verification Results

Completed locally:

```text
clasp status
```

Result:

- Passed.
- `clasp status` tracks only the 12 live files under `AppsScript/`.
- No untracked deploy files are shown.

Deployment state checked:

- Current stable deployment ID is deployed to version 51.
- Older deployments still existed at review time and are planned for cleanup after the V2 snapshot.

## Final Assessment

Decision: **PASS WITH CONDITIONS**.

The architecture is clean enough to call this V2 after snapshot/deployment cleanup. The main conditions are trigger authorization/install, deployment cleanup, and git hygiene to keep secrets out of the repository.
