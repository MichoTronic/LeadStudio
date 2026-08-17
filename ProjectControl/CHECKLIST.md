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

- [x] Revoke the Jira API token exposed on 2026-08-17, update the GAS Script Property, and set the replacement directly as Firebase secret `LEAD_STUDIO_JIRA_API_TOKEN`.
- [ ] Move all operational secrets into Apps Script Script Properties or managed secret storage.
- [ ] Confirm `DocumentationArchive/NOTES.md` remains excluded from `clasp` pushes and external sharing.
- [ ] Review `appsscript.json` web app access and execution API settings before broader team use.
- [x] Add shared `TimelessStudioAuth` gate and backend verifier calls for Lead Studio.
- [x] Register local auth rules for `studioPolicies/lead-studio`.
- [x] Deploy Lead Studio shared-auth integration to the stable Apps Script web app.
- [x] Run shared-auth phase completion cleanup and preserve scheduled/internal refresh paths.
- [ ] Browser-test Mitja access through shared auth on the live Lead Studio URL.
- [ ] Browser-test Gaja and Vanesa access after deployment.
- [ ] Browser-test a denied account after deployment.
- [x] Replace the Firebase Gmail credential-file plan with keyless IAM `signJwt` domain-wide delegation; Firebase stores no service-account JSON key or user OAuth access token.
- [x] Disable setup/test URL endpoints by default behind explicit Script Properties.

## Gmail Lead Parsing

- [x] Add parser smoke cases for current `New Contact`, old `Contact Form (TLT-Webpage-*)`, and legacy `Form submission from:` formats.
- [x] Add a small sample-based check for hidden body artifacts and HTML entity cleanup.
- [x] Review Gmail query limits for fast scan and deep scan after the next historical refresh.
- [ ] Decide whether rejected lead samples should be surfaced in UI diagnostics or only written to `Debug Log`.
- [x] Use `noreply@timelesstech.io` as the current `New Contact` form sender while still rejecting external `Re: New Contact` replies.

## Onboarding And Jira

- [x] Verify email-based onboarding matches against a fresh sample of completed onboarding rows.
- [x] Verify responsible-person fallback matches do not create false positives.
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
- [x] Rename total dashboard metric label from `Leads` to `Contacts`.
- [x] Add Settings Operations status for daily trigger count and latest scheduled run.
- [x] Add Settings `Run Smoke Tests` action.
- [x] Reserve four-digit display space for dashboard metric counters.
- [x] Make Contacts metric reflect active visible filters.
- [x] Make New Lead metric/filter include onboarded Jira-key rows with missing Jira status so lifecycle chips reconcile with Onboarding.
- [ ] Review table density and column order after the first real user feedback round.
- [ ] Add clearer empty/error states for missing Jira credentials, Gmail delegation failure, and onboarding sheet access failure.
- [x] Verify Firebase CSV/XLSX export output for filtered rows, Jira links, quoting, and special characters.
- [ ] Consider saving active filter/search state between sessions if repeated use needs it.

## Operations

- [x] Run `Settings > Refresh Leads` after version 57 and confirm post-2026-06-21 `noreply@timelesstech.io` form notices are appended.
- [ ] Observe the next scheduled daily Refresh Leads run after version 57 and confirm it writes `SCHEDULED_REFRESH_COMPLETE`.
- [x] Add a scheduled Refresh Leads wrapper with overlap protection.
- [x] Add install/status/remove helpers for the daily 06:00 project-time refresh trigger.
- [x] Add visible Apps Script execution-log output for daily refresh trigger install/status/remove helpers.
- [x] Owner authorization required: run `installDailyRefreshLeadsTrigger()` once successfully.
- [x] Confirm the daily refresh trigger is installed and visible in Apps Script triggers after deployment.
- [x] Confirm `getDailyRefreshLeadsTriggerStatus()` reports `triggerCount: 1`.
- [x] Tag V2 rollback state as `v2-stable`.
- [x] Create `../Archive/Snapshots/Lead Studio V2 Stable/` before V3 changes.
- [x] Add Apps Script smoke tests for parser formats, Jira lifecycle mapping, date range boundaries, and export row shaping.
- [x] Add parser smoke cases for current `New Contact`, old `Contact Form (TLT-Webpage-*)`, and legacy `Form submission from:` formats.
- [x] Remove duplicate shadowed sort-glyph helper from `Script.html`.
- [x] Deploy V3 as Apps Script version 54.
- [x] Create `../Archive/Snapshots/Lead Studio V3/` and matching V3 archive.
- [x] Create final `../Archive/Snapshots/Lead Studio V3 Stable/` archive after metric fixes.
- [x] Run `runLeadStudioSmokeTests()` from Apps Script editor or Settings after V3 deployment.
- [x] Tag V3 rollback state as `v3-stable`.
- [x] Run the full `../Phase_Completion_Review_Pack/` for V2.
- [x] Run the full `../Phase_Completion_Review_Pack/` for V3.
- [x] Save completed V3 completion-review reports in `../Reports/`.
- [x] Move remaining V3 action items into this checklist.
- [x] Declare V3 as the current viable/stable Lead Studio baseline.
- [x] Save completed V2 completion-review reports in `../Reports/`.
- [x] Move remaining V2 action items into this checklist.
- [x] Create `../Archive/Snapshots/Lead Studio V2/` and matching V2 archive.
- [x] Remove old versioned Apps Script deployments.
- [x] Confirm remaining Apps Script deployments are stable version 60 plus read-only `@HEAD`.
- [x] Initialize git repository on `main`.
- [x] Create local V2 commit `c17001e` (`Prepare Lead Studio V2`).
- [x] Push safe V2 project files to `https://github.com/MichoTronic/LeadStudio.git`.
## V4 Backlog

- [x] Create and bill standalone Firebase project `timeless-lead-studio`.
- [x] Add Node 22 Firebase Functions and Hosting structure on `phase/v4-firebase-sso`.
- [x] Register production and preview Lead Studio clients with central Auth.
- [x] Deploy isolated read-only Firebase preview without changing GAS v60.
- [x] Verify unsigned Function access is denied before Sheet reads.
- [x] Complete signed Chrome acceptance against the real Sheet.
- [x] Verify desktop filters, contact details, lifecycle metrics, and the GAS operations link.
- [x] Verify 390px mobile layout has no horizontal overflow.
- [x] Keep Gmail, Jira, writes, onboarding matching, exports, and the daily trigger on GAS.
- [x] Design audited Firebase write commands with optimistic row-version checks.
- [x] Bind the rotated Jira token from Secret Manager and verify a settings-only Firebase Jira profile probe.
- [x] Port bounded Jira bulk-status reads by key and compare all 48 Sheet-linked keys with live Jira; all 45 cached statuses matched and three blank-status historical keys remained unresolved.
- [x] Port PII-minimized contact-email Jira discovery; a 12-contact sample produced 10 exact matches, two no-results, and zero mismatches.
- [x] Port validated direct Jira issue lookup; a 12-key sample produced 11 exact status matches, one known 404, and zero mismatches.
- [x] Configure keyless domain-wide Gmail delegation and prove mailbox-profile access from the signed Firebase preview.
- [x] Port bounded Gmail lead searches and current/old/legacy parsing; all 7 accepted messages in the live 12-candidate sample matched existing Sheet rows and fields.
- [x] Port onboarding-notice reads, Form-linked onboarding matching, and deep-query parity before moving Gmail refresh ownership.
- [x] Deploy and live-verify a settings-only, PII-minimized refresh dry-run; all 302 rows loaded, bounded Gmail/onboarding parity stayed exact, Jira planned no status changes, and the Sheet/Debug Log remained unchanged.
- [x] Produce the complete GAS-compatible 35-column Gmail lead append payload and add operational Gmail pagination while the refresh path remains read-only; live acceptance completed 95 lead candidates and 27 onboarding candidates with no parity gaps.
- [ ] Add new-lead Jira discovery/onboarding enrichment and an audited, disabled refresh mutation command with snapshot versioning, idempotency, and rollback acceptance.
- [x] Select row 2 and complete disabled-by-default Firebase Notes write/verify/restore/replay acceptance.
- [ ] Replace the GAS scheduled trigger only after duplicate execution is prevented.
- [x] Port filtered exports and manual Jira-link operations; keep the Jira command/editor disabled while GAS owns writes.
- [ ] Run write/parity/rollback acceptance before changing the Console production tile.
- [ ] Add bounded Debug Log reads for Operations status.
- [ ] Add refresh duration logging and display.
- [ ] Add scheduled-refresh failure alerting.
- [ ] Add Gmail scan candidate/accepted-count performance tracking.
- [ ] Add Gmail scan controls if candidate count grows.
- [x] Add sheet-write smoke tests for exact restoration, stale-version rejection, audit events, and idempotent replay.
- [ ] Run live QA for Refresh Leads.
- [x] Run live Firebase QA for CSV/XLSX export after filters on desktop and 390px mobile.
- [x] Run live Firebase manual Jira write/verify/restore/replay acceptance on row 6 and redeploy the gate disabled.
- [ ] Run live QA for Deep Refresh Jira Matches.
- [ ] Review web app access settings before broader team/external use.
- [ ] Review whether setup/test endpoint functions should remain present or be removed entirely.
- [ ] Split client utilities from `Script.html` after test coverage improves.
- [ ] Tighten `PROJECT_STATUS.md` Latest Change history into current-state summary plus release notes.
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
