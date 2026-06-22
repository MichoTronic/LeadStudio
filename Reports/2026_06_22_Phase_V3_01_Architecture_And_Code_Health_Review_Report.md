# 01 Architecture And Code Health Review Report - 2026-06-22

Scope: Lead Studio V3 stable candidate after observability, smoke-test, endpoint-hardening, metric-counter, and Contacts-filtering changes. Stable Apps Script deployment is version 55.

## Review Inputs

- `README.md`
- `PROJECT_STATUS.md`
- `ProjectControl/CHECKLIST.md`
- `AppsScript/`
- `Reports/`
- `Phase_Completion_Review_Pack/`
- Git tags: `v2-stable`, `v3-stable`

## Findings

### Healthy

- `AppsScript/` remains the only live deployment source root and `.clasp.json` still points at `AppsScript`.
- `clasp status` confirms only live Apps Script files are tracked for deployment.
- V2 and V3 rollback points exist in both git tags and local snapshots.
- Setup/test URL endpoints are now disabled by default behind explicit Script Properties.
- V3 added a smoke-test harness in `SmokeTests.js`, reducing risk for parser, status-map, date-range, and export-row changes.
- Settings now exposes operations status, making trigger visibility better than V2.
- The metric counter and Contacts filtering issues found after V3 were fixed in version 55.

### Risks

- `Script.html` is now about 1,571 lines. It is functional, but it owns too many responsibilities: UI event binding, filtering, table rendering, dialogs, metrics, export, XLSX generation, operations status, and smoke-test UI plumbing.
- `GmailScanner.js` is about 897 lines and still combines Gmail querying, lead parsing, onboarding notice parsing, diagnostics, normalization, and test helpers.
- `Storage.js` is about 615 lines and handles sheet reads/writes, Jira/onboarding updates, manual Jira edits, debug logging, and debug-log reads.
- The smoke-test harness covers important pure logic but does not yet cover sheet-write/update behavior or browser interaction.
- `PROJECT_STATUS.md` has accumulated a long Latest Change list. It is still useful, but the top section should eventually be tightened into “current state” plus “recent release notes.”

### Stale Or Unclear Items

- Some checklist items from earlier phases are stale, such as adding parser smoke cases, because V3 now has parser smoke tests.
- `README.md` still names V2 conditions in one section; this should be revised during the next documentation polish.
- The setup/test endpoint functions still exist by design, but their lifecycle should be revisited after another stable operating period.

## Changes Implemented During Review

- No code changes were made during this review pass.
- Findings were captured as V3 review reports and follow-up checklist/status updates.

## Verification Results

```text
clasp status
```

Result: passed. Only the Apps Script source files under `AppsScript/` are tracked.

```text
node --check AppsScript/Code.js
node --check AppsScript/Setup.js
node --check AppsScript/SmokeTests.js
node --check AppsScript/Storage.js
Script.html browser-script syntax check
```

Result: passed.

User-provided runtime smoke test result:

```json
{
  "passed": 6,
  "failed": 0,
  "ok": true
}
```

## Final Assessment

Decision: **PASS WITH CONDITIONS**.

Summary:

- Architecture is stable enough for V3.
- The main condition is not a release blocker: do not keep growing `Script.html` and `GmailScanner.js` without stronger tests or smaller modules.

