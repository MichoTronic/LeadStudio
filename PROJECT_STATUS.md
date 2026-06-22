# Lead Studio Project Status

Current status source of truth for Lead Studio.

## Runtime Posture

- Product: `Lead Studio`
- Platform: Google Apps Script web app
- Storage: `Lead Studio Database` Google Sheet
- Current local code line: V2 source line, with toolbar stability, date filters, fixed table columns, and scheduled refresh helpers present
- Apps Script source root: `AppsScript/`
- Official Version 1 checkpoint: Version 45
- Current stable deployment: Version 54 - Lead Studio V3 optimization and observability sweep
- Current stable web app deployment ID: `AKfycbwDqwHWHOsur0fWcpiIC4uQh-DZ1VZ7nyYxYB8fH4lyL5Jtblo9Ww3R8aBdVdBQbGSNvA`
- Current V2 review decision: `GO WITH CONDITIONS`
- Current deployment inventory: stable version 54 web app deployment plus Apps Script read-only `@HEAD`
- Current V3 rollback tag: `v3-stable`
- V2 rollback tag: `v2-stable`
- Stable Jira checkpoint: Version 43
- Stable Gmail/UI pre-Jira checkpoint: Version 30
- Rollback snapshots: `Archive/Snapshots/`

## Current Scope

- Discover marketing contact-form leads from Gmail.
- Save lead records into the Google Sheet.
- Track onboarding-sent notices.
- Match leads to onboarding submissions.
- Read Jira issue status and map it into Lead Studio lifecycle buckets.
- Show Jira links, lifecycle counters, filters, export actions, and manual Jira link edits in the UI.
- Filter visible leads by Email Date using Last 7 days, Last 30 days, or a custom from/to range.
- Support an owner-installed scheduled daily Refresh Leads job.

## Latest Change

- 2026-06-22: Ran the full V2 completion review pack and saved the ordered reports in `Reports/`.
- 2026-06-22: Added `.gitignore` guardrails for GitHub publishing; sensitive historical notes, snapshots, local zip archives, and Google Drive shortcuts stay out of git.
- 2026-06-22: Created `Archive/Snapshots/Lead Studio V2/` and `Archive/Snapshots/Lead Studio V2.zip`.
- 2026-06-22: Removed all old versioned Apps Script deployments; Apps Script still reports a read-only `@HEAD` deployment that `clasp` will not delete.
- 2026-06-22: Initialized local git repository on `main` and created local commit `c17001e` (`Prepare Lead Studio V2`).
- 2026-06-22: Pushed local V2 commits to `https://github.com/MichoTronic/LeadStudio.git` on branch `main`.
- 2026-06-22: Added visible `Logger.log` JSON output for daily refresh trigger install/remove/status helpers and deployed version 52.
- 2026-06-22: Renamed the total dashboard metric label from `Leads` to `Contacts` and deployed version 53.
- 2026-06-22: Tagged V2 rollback state as `v2-stable` and created `Archive/Snapshots/Lead Studio V2 Stable/`.
- 2026-06-22: Completed V3 optimization/observability sweep and deployed version 54.
- 2026-06-22: Created `Archive/Snapshots/Lead Studio V3/` and `Archive/Snapshots/Lead Studio V3.zip`.
- 2026-06-22: Added Settings Operations status for daily trigger count, timezone, latest scheduled run, latest trigger change, and refresh time.
- 2026-06-22: Added Apps Script smoke tests for lead parser formats, Jira lifecycle mapping, date-range boundaries, and export-row shaping.
- 2026-06-22: Added Settings `Run Smoke Tests` action and Apps Script `runLeadStudioSmokeTests()` function.
- 2026-06-22: Disabled setup/test URL endpoints by default; they require temporary Script Properties to re-enable. Direct Apps Script editor functions and Settings diagnostics remain available.
- 2026-06-22: Removed a duplicate shadowed sort-glyph helper from `Script.html`.
- 2026-06-22: Stabilized the table toolbar into fixed metric/filter and search/export/settings rows, and added outside-click/Escape closing behavior for filter/export dropdowns.
- 2026-06-22: Pushed the updated Apps Script source files to project head with `clasp push`; no new version or stable deployment repoint has been created yet.
- 2026-06-22: Moved live Apps Script files into `AppsScript/`, set `.clasp.json` `rootDir` accordingly, added `Phase_Completion_Review_Pack/`, `Reports/`, and `Resources/`, and moved sensitive historical notes into `ProjectControl/DocumentationArchive/`.
- 2026-06-22: Created Apps Script version 47, `Fix toolbar dropdown stability`, and redeployed the stable web app deployment ID to `@47`.
- 2026-06-22: Added a `Clear filters` button, locked dropdown label wrapping/count behavior, and fixed table column widths to reduce layout jumps.
- 2026-06-22: Added client-side Email Date range filtering with Last 7 days, Last 30 days, and custom from/to selectors; `Clear filters` now resets dropdown, status, and date filters.
- 2026-06-22: Added `scheduledRefreshLeads()` plus trigger install/remove/status helpers for a daily 06:00 project-time Refresh Leads job.
- 2026-06-22: Added token-protected setup endpoint actions for installing, removing, and checking the daily refresh trigger.
- 2026-06-22: Deployed trigger helpers at version 51. One-time owner authorization/install is still required before the daily trigger is active.

## Current Risks

- `NOTES.md` contains sensitive historical setup details and must stay excluded from push/share workflows.
- Daily refresh trigger code is deployed, but the trigger is not confirmed active until the project owner authorizes/installs it and `getDailyRefreshLeadsTriggerStatus()` reports one trigger.
- Setup/test URL token handlers still exist in `Code.js`, but URL access is disabled by default unless `LEAD_STUDIO_SETUP_ENDPOINTS_ENABLED=true` or `LEAD_STUDIO_TEST_ENDPOINTS_ENABLED=true` is set temporarily.
- There is a lightweight Apps Script smoke-test harness for parser, Jira mapping, date-range, and export-row behavior; sheet-update behavior still needs deeper automated coverage later.
- `Script.html` and `GmailScanner.js` are large modules; future changes should stay focused or be split only after behavior is covered.
- Only files inside `AppsScript/` are live deployment candidates; archive/support folders must stay outside the `clasp` source root.
- Because source now lives in `AppsScript/`, verify `clasp status` before every push to confirm only live source files are tracked.

## Verification Set

Use this minimum check before code/config deployment:

```text
clasp status
```

Use these runtime checks after deployment or when touching integrations:

```text
Settings > Test Marketing Mailbox Access
Settings > Check Jira Connection
Settings > Refresh Leads
Settings > Deep Refresh Jira Matches
```

Scheduled refresh setup/status functions:

```text
installDailyRefreshLeadsTrigger()
getDailyRefreshLeadsTriggerStatus()
removeDailyRefreshLeadsTrigger()
runLeadStudioSmokeTests()
```

Expected V2 scheduled-refresh readiness state after owner authorization:

```text
getDailyRefreshLeadsTriggerStatus() => triggerCount: 1
```

## Completion Review Rules

- Run `Phase_Completion_Review_Pack/` before declaring a major phase stable.
- Save dated reports in `Reports/` using the existing `YYYY_MM_DD_Phase_<phase>_*_Report.md` naming pattern.
- Move any open review conditions into `ProjectControl/CHECKLIST.md`.
- Create a snapshot under `Archive/Snapshots/` only after the review reports and control docs are updated.
- Do not commit `ProjectControl/DocumentationArchive/NOTES.md`, `Archive/`, local zip snapshots, or Google Drive shortcut files to GitHub.

## V3 Notes

- Stable deployment is version 54.
- V2 remains available as git tag `v2-stable`.
- V3 is intended to be tagged as `v3-stable` after this deployment/snapshot commit is pushed.
- `clasp run runLeadStudioSmokeTests` is blocked by the local Apps Script execution permission context, so use Apps Script editor or Settings > Run Smoke Tests for runtime validation.

## Documentation Rules

- Update this file after meaningful runtime, deployment, integration, or folder-structure changes.
- Keep active tasks in `ProjectControl/CHECKLIST.md`.
- Keep historical deployment details in `ProjectControl/DocumentationArchive/NOTES.md`, but do not copy secrets into status/control docs.
- Use `Phase_Completion_Review_Pack/` for reusable phase-review templates and save completed dated reports in `Reports/`.
