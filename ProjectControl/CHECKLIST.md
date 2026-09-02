# Lead Studio Checklist

Current task and backlog ledger.

For current status, use `../PROJECT_STATUS.md`.
For historical implementation detail, use `DocumentationArchive/NOTES.md` with care because it contains sensitive information.

## V4 Production Hardening - 2026-09-02

- [x] Reconcile live Hosting, all six V4 Functions, Auth client, and the absence
  of a persistent preview channel.
- [x] Diagnose the two 360-second Gmail push failures and confirm later
  successful zero-write completion plus healthy subsequent deliveries.
- [x] Add 30-second provider request bounds, a 15-minute writer-lock lease, and
  metadata-only stage-duration logging.
- [x] Align the original V4 source on package `4.0.0`, production Auth client
  `lead-studio-v4`, and V4 Function identifiers; remove retired preview paths.
- [x] Pass all 83 local checks and verify all six Auth production clients.
- [x] Deploy the approved production candidate and verify new revisions,
  Hosting, event processing, health logs, and rollback inventory.
- [x] Close V4 on `release/v4` with tag `V4`; start new feature work only in an
  explicitly opened V5 branch.

## V4.0.1 Deep Maintenance - 2026-09-02

- [x] Sweep all current Function/browser source, tests, dependencies, live
  revisions, Scheduler jobs, Hosting channels, and recent runtime errors.
- [x] Bound Gmail activity and Jira discovery requests; reduce callable
  concurrency and add bounded scheduled-refresh retries.
- [x] Repair idempotency lookup beyond 5,000 audit rows and add regression
  coverage for newest-first bounded paging.
- [x] Harden CSV/XLSX output, HTTPS link handling, Hosting headers, production
  labeling, accessibility, and cache revisioning.
- [x] Remove all six retired acceptance/refresh variables from the local
  production environment and every deployed Function.
- [x] Pass 90/90 tests, 96.42% line coverage, dependency audit, live Hosting,
  unsigned-auth, health, runtime-log, and full scheduled-refresh checks.
- [x] Promote and document V4.0.1 while retaining `V4` as the original rollback
  tag and reserving feature/dependency-major work for V5.

## V4.0.2 Ordered Completion Review - 2026-09-02

- [x] Run completion reviews 01 through 05 against the active Firebase runtime,
  using the Content Studio reports as a review framework only.
- [x] Bound settings-only Jira discovery/direct diagnostics to four concurrent
  requests while preserving deterministic output order.
- [x] Patch Firebase Admin and the vulnerable transitive `qs` dependency; retain
  major Google client upgrades for a separately reviewed release.
- [x] Add root entrypoint checking, dependency-audit scripts, and dependency-free
  desktop/mobile browser smoke automation.
- [x] Add clickjacking protection and integrity verification for the pinned
  third-party Lucide browser asset.
- [x] Update the reusable 01-05 templates from obsolete GAS-live assumptions to
  the current Firebase/central-auth/Gmail/Jira architecture.

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
- [x] Keep both ignored database shortcuts: `.gsheet` supports the native Drive
  client and `.url` is the portable browser fallback.
- [x] Keep `Setup.js` only in inactive rollback source; its setup/test endpoints
  remain disabled by default and are not exposed by Firebase production.

## Security And Secrets

- [x] Revoke the Jira API token exposed on 2026-08-17, update the GAS Script Property, and set the replacement directly as Firebase secret `LEAD_STUDIO_JIRA_API_TOKEN`.
- [x] Store active Firebase secrets in Secret Manager and retain only rollback
  GAS credentials in Script Properties; no credential file is tracked.
- [x] Confirm `DocumentationArchive/NOTES.md` remains excluded from Git and clasp
  deployment scope.
- [x] Treat `appsscript.json` access settings as rollback-only: GAS has zero
  triggers and no versioned web deployment.
- [x] Add shared `TimelessStudioAuth` gate and backend verifier calls for Lead Studio.
- [x] Register local auth rules for `studioPolicies/lead-studio`.
- [x] Deploy Lead Studio shared-auth integration to the stable Apps Script web app.
- [x] Run shared-auth phase completion cleanup and preserve scheduled/internal refresh paths.
- [x] Browser-test Mitja access through shared auth on the live Lead Studio URL.
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
- [x] Refresh Jira status in the daily 06:00 reconciliation; narrow Gmail push
  ingestion remains focused on message/onboarding changes.

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
- [x] Restore Firebase All leads and lifecycle metric filtering with New lead results aligned to the GAS lifecycle rule.
- [x] Restore multi-select Business type, Target region, and Interested in filters in the Firebase preview.
- [x] Restore Date and Company sorting in the Firebase preview.
- [x] Show the authorized Inquiry field in Firebase contact details while keeping private message/body fields out of browser responses.
- [x] Add inclusive custom From/To date inputs alongside the existing date presets.
- [x] Restrict Interested in display/filter values to Game Aggregator, Bonus Engine, White Label, BetExchange, and Other; map known aliases and display unrelated historical values as `-` without rewriting Sheet data.
- [x] Align the Firebase preview accents with the blue Marketing Studio Console palette.
- [x] Restore row-wide mouse and keyboard opening of desktop contact details.
- [ ] Consider saving active filter/search state between sessions if repeated use needs it.

## Operations

- [x] Run `Settings > Refresh Leads` after version 57 and confirm post-2026-06-21 `noreply@timelesstech.io` form notices are appended.
- [x] Retire the GAS scheduled-refresh observation condition after removing its trigger during the V4 Firebase Scheduler cutover.
- [x] Add a scheduled Refresh Leads wrapper with overlap protection.
- [x] Add install/status/remove helpers for the daily 06:00 project-time refresh trigger.
- [x] Add visible Apps Script execution-log output for daily refresh trigger install/status/remove helpers.
- [x] Owner authorization required: run `installDailyRefreshLeadsTrigger()` once successfully.
- [x] Confirm the daily refresh trigger is installed and visible in Apps Script triggers after deployment.
- [x] Historical V2 checkpoint: confirmed `triggerCount: 1`; V4 cutover later removed it and now requires zero Apps Script triggers.
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
- [x] Retire the final versioned GAS web deployment and obsolete Firebase/Auth
  preview surfaces after their rollback windows; retain source and immutable
  version history only (2026-08-20).
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
- [x] Add new-lead Jira discovery/onboarding enrichment and an audited, disabled refresh mutation command with snapshot versioning, idempotency, metadata-only audit records, and exact rollback support.
- [x] Deploy the disabled dedicated refresh writer and verify its canonical read-only plan matches `leadStudioActionV4`: 302 rows, 69 planned updates, zero appends/conflicts, no Sheet or audit writes.
- [x] Stop and verify removal of the GAS daily refresh trigger, then run live Firebase whole-refresh write/verify/restore/replay acceptance; all 69 rows restored exactly and replay caused no second mutation.
- [x] Select row 2 and complete disabled-by-default Firebase Notes write/verify/restore/replay acceptance.
- [x] Replace the GAS scheduled trigger with the single-instance Firebase 06:00 Europe/Ljubljana schedule; verify disabled-gate invocation and one persistent production run.
- [x] Port filtered exports and manual Jira-link operations; keep the Jira command/editor disabled while GAS owns writes.
- [x] Run refresh write/parity/rollback acceptance before changing the Console production tile.
- [x] Add bounded Debug Log reads for settings-authorized Operations status.
- [x] Add refresh duration logging and metadata-only status output.
- [x] Add six-hour runtime health checks and Cloud Monitoring email alerting for scheduler/watch/push failures.
- [x] Add Gmail candidate/accepted/change performance tracking to structured logs and private watch state.
- [ ] Add Gmail scan controls if candidate count grows.
- [x] Create the Lead Studio Gmail Pub/Sub topic and grant publisher access only to `gmail-api-push@system.gserviceaccount.com`.
- [x] Implement idempotent Gmail `history.list` processing from a durable committed `historyId`, including bounded recovery from an expired checkpoint.
- [x] Add daily Gmail `watch` renewal and keep the 06:00 reconciliation/Jira job as the dropped-notification safety net.
- [x] Verify one naturally push-delivered trusted lead was appended exactly once with a metadata-only STARTED/COMPLETE audit, then replace the broad daily scan with the 14-day reconciliation fallback; passed on 2026-08-19.
- [x] Add sheet-write smoke tests for exact restoration, stale-version rejection, audit events, and idempotent replay.
- [x] Run live Firebase QA for Refresh Leads through the production Scheduler path and verify the final whole-Sheet hash.
- [x] Observe the first natural 06:00 Firebase scheduled refresh and confirm its COMPLETE audit before retiring the GAS refresh code.
- [x] Run live Firebase QA for CSV/XLSX export after filters on desktop and 390px mobile.
- [x] Run live Firebase manual Jira write/verify/restore/replay acceptance on row 6 and redeploy the gate disabled.
- [x] Exercise the operational Firebase manual Jira path on row 6 with its existing issue key and verify idempotent replay, then return both gates/editor to disabled.
- [x] Add shared serialization between manual Jira writes and the scheduled whole-Sheet writer before enabling the editor operationally.
- [x] Complete signed browser QA for the Firebase manual Jira editor and correct its desktop/mobile field layout after operator acceptance.
- [x] Accept either a Jira issue key or a configured Atlassian HTTPS browse URL in the Firebase manual editor; reject unrelated hosts and paths.
- [x] Preserve the historical Jira API/browser host split: validate through the Atlassian API tenant and accept/store `jira.at.semper7.net/browse/KEY` links.
- [x] Run signed operator QA for the canonical Jira URL, Inquiry, fixed Interested in values, custom dates, list filters/sorting, row opening, and responsive dark Console styling.
- [x] Confirm desktop viewport-contained table scrolling and sticky headers, plus the existing 390px card/filter layout, in signed Chrome QA.
- [x] Promote accepted Hosting version `2ebf4cbe315f4974` to production and update the Console launcher.
- [x] Add current architecture, release, documentation, and decision governance files.
- [ ] Run live QA for Deep Refresh Jira Matches.
- [x] Retire GAS web-app access; Firebase production is gated by central SSO and
  backend scope verification.
- [x] Remove obsolete callable-refresh/write-acceptance Functions, browser
  hooks, and the retired GAS launcher while preserving test history in Git.
- [x] Do not refactor inactive `Script.html`; Firebase production already splits
  app, list, and export browser responsibilities.
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
