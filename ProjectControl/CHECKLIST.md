# Lead Studio Checklist

Current task and backlog ledger. This file is intentionally short.

For current status, use `../PROJECT_STATUS.md`.
For historical implementation detail, use `DocumentationArchive/NOTES.md` with care because it contains sensitive information.

## Active Cleanup

- [x] Add root `README.md` with canonical project orientation.
- [x] Add `PROJECT_STATUS.md` as the current status source of truth.
- [x] Add this active checklist under `ProjectControl/`.
- [x] Move stable snapshot folders and zip archives into `Archive/Snapshots/`.
- [x] Update `.claspignore` so archived Apps Script files are not pushed.
- [x] Move live Apps Script source files into `../AppsScript/` and update `.clasp.json` `rootDir`.
- [x] Move database shortcuts into `../Resources/`.
- [x] Move historical sensitive notes into `DocumentationArchive/`.
- [x] Add `../Phase_Completion_Review_Pack/` with ordered completion-review templates.
- [x] Add `../Reports/` for dated review/audit/QA outputs.
- [x] Add `.gitignore` rules for sensitive notes, snapshots, local zip archives, and Drive shortcut files.
- [ ] Decide whether both `../Resources/Lead Studio Database.gsheet` and `../Resources/Lead Studio Database.url` need to stay.
- [ ] Decide whether `Setup.js` and setup/test token endpoints should remain available in the deployed app.

## Security And Secrets

- [ ] Rotate any Jira/API credentials that were stored in historical notes or exposed outside Script Properties.
- [ ] Move all operational secrets into Apps Script Script Properties or managed secret storage.
- [ ] Confirm `DocumentationArchive/NOTES.md` remains excluded from `clasp` pushes and external sharing.
- [ ] Review `appsscript.json` web app access and execution API settings before broader team use.
- [ ] Document who owns the Gmail service-account JSON file and who can rotate it.

## Gmail Lead Parsing

- [ ] Add parser smoke cases for current `New Contact`, old `Contact Form (TLT-Webpage-*)`, and legacy `Form submission from:` formats.
- [ ] Add a small sample-based check for hidden body artifacts and HTML entity cleanup.
- [ ] Review Gmail query limits for fast scan and deep scan after the next historical refresh.
- [ ] Decide whether rejected lead samples should be surfaced in UI diagnostics or only written to `Debug Log`.

## Onboarding And Jira

- [ ] Verify email-based onboarding matches against a fresh sample of completed onboarding rows.
- [ ] Verify responsible-person fallback matches do not create false positives.
- [ ] Add a conflict review path when manual Jira key differs from onboarding-sheet Jira key.
- [ ] Add visibility for unmapped Jira statuses so new lifecycle statuses are not missed.
- [ ] Confirm whether Jira status should refresh on every normal Gmail refresh or only through explicit Jira refresh actions.

## UI And Export

- [x] Stabilize toolbar dropdown/search/export/settings positioning so menus do not reflow controls while selecting.
- [x] Close filter and export dropdown menus when clicking outside the menu or pressing Escape.
- [x] Create Apps Script version 47 and redeploy the stable web app URL to the toolbar/dropdown fix.
- [x] Add `Clear filters` before dropdown filters.
- [x] Prevent dropdown labels/counts from wrapping and changing toolbar height.
- [x] Lock visible table column widths so filtered rows do not resize the table.
- [x] Add Email Date range filtering with Last 7 days, Last 30 days, and custom from/to dates.
- [x] Make `Clear filters` reset dropdown, status, and date filters.
- [ ] Review table density and column order after the first real user feedback round.
- [ ] Add clearer empty/error states for missing Jira credentials, Gmail delegation failure, and onboarding sheet access failure.
- [ ] Verify CSV/XLSX export output for filtered rows, Jira links, and special characters.
- [ ] Consider saving active filter/search state between sessions if repeated use needs it.

## Operations

- [x] Add a scheduled Refresh Leads wrapper with overlap protection.
- [x] Add install/status/remove helpers for the daily 06:00 project-time refresh trigger.
- [ ] Owner authorization required: run `installDailyRefreshLeadsTrigger()` once successfully.
- [ ] Confirm the daily refresh trigger is installed and visible in Apps Script triggers after deployment.
- [ ] Confirm `getDailyRefreshLeadsTriggerStatus()` reports `triggerCount: 1`.
- [x] Run the full `../Phase_Completion_Review_Pack/` for V2.
- [x] Save completed V2 completion-review reports in `../Reports/`.
- [x] Move remaining V2 action items into this checklist.
- [x] Create `../Archive/Snapshots/Lead Studio V2/` and matching V2 archive.
- [x] Remove old versioned Apps Script deployments.
- [x] Confirm remaining Apps Script deployments are stable V2 plus read-only `@HEAD`.
- [x] Initialize git repository on `main`.
- [x] Create local V2 commit `c17001e` (`Prepare Lead Studio V2`).
- [ ] Push safe V2 project files to `https://github.com/MichoTronic/LeadStudio.git` after GitHub HTTPS credential/token is available.
- [ ] Add a lightweight local lint or syntax-check path for Apps Script files if future work becomes regular.
- [ ] Keep rollback checkpoints only for meaningful deployments; archive or remove duplicate local copies after a stable deployment is confirmed.
- [ ] Update `../PROJECT_STATUS.md` and this checklist after every meaningful code, config, workflow, or folder-structure change.

## Completed Current-Scope Anchors

- [x] Gmail delegated read/search against the marketing mailbox is implemented.
- [x] Fast Gmail refresh and deep historical scan are implemented.
- [x] Lead parsing supports current, old, and legacy contact-form email formats.
- [x] Lead records persist to the `Email Matches` sheet.
- [x] Onboarding sent count/date/message tracking is implemented.
- [x] Onboarding request sheet matching is implemented by email and responsible-person fallback.
- [x] Jira status reads and Lead Studio lifecycle mapping are implemented.
- [x] Manual Jira issue link editing is implemented.
- [x] Dashboard counters and metric filters are implemented.
- [x] Target region filter and display are implemented.
- [x] Visible-table CSV and XLSX export is implemented.
- [x] Gmail hidden body artifact cleanup is implemented.
