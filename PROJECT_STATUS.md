# Lead Studio Project Status

Current status source of truth for Lead Studio.

## Runtime Posture

- Product: `Lead Studio`
- Stable UI/rollback platform: Google Apps Script web app version 60
- Operational refresh platform: Firebase Node 22 Functions and Cloud Scheduler in `timeless-lead-studio`
- Storage: `Lead Studio Database` Google Sheet
- Local folder: `D:\GoogleDrive\_Share\TimelessTech\Marketing\Optmizations\LeadStudio`
- Parent Google Drive folder: `1keVmyWTXwqQM0cK5AWQzFPIKM7K7hyt1`
- Current local code line: V3 source line, with toolbar stability, date filters, fixed table columns, operations status, smoke tests, endpoint hardening, and scheduled refresh helpers present
- Apps Script source root: `AppsScript/`
- Official Version 1 checkpoint: Version 45
- Current stable deployment: Version 60 - Auth phase cleanup
- Current stable web app deployment ID: `AKfycbwDqwHWHOsur0fWcpiIC4uQh-DZ1VZ7nyYxYB8fH4lyL5Jtblo9Ww3R8aBdVdBQbGSNvA`
- Firebase pilot preview: `https://timeless-lead-studio--v4-firebase-pilot-l3jpap21.web.app`
- Firebase pilot function: `leadStudioActionV4`, region `europe-west1`, runtime Node 22
- Firebase pilot function revision: `leadstudioactionv4-00014-jek`; canonical operational refresh planner deployed read-only
- Firebase refresh callable: `leadStudioRefreshV4` revision `leadstudiorefreshv4-00005-hem`, dedicated writer identity, one instance/concurrency, operational and acceptance gates disabled
- Firebase scheduled writer: `leadStudioScheduledRefreshV4` revision `leadstudioscheduledrefreshv4-00002-fen`, daily 06:00 Europe/Ljubljana, no retries, one instance/concurrency, operational gate enabled
- Firebase Hosting mode: preview; central Auth policy `studioPolicies/lead-studio`
- Firebase write acceptance: `leadStudioWriteAcceptanceV4` revision `leadstudiowriteacceptancev4-00004-vad`, disabled by configuration and bound to dedicated `lead-studio-writer@timeless-lead-studio.iam.gserviceaccount.com`
- Firebase manual Jira pilot: `leadStudioManualJiraV4` revision `leadstudiomanualjirav4-00003-tep`, disabled by configuration and bound to the same dedicated writer identity
- Firebase Gmail delegation: keyless IAM `signJwt` as `819383433430-compute@developer.gserviceaccount.com`, impersonating `marketing@timelesstech.io` with Gmail readonly scope
- Firebase Jira credential: `LEAD_STUDIO_JIRA_API_TOKEN` in Secret Manager; scheduled synchronization is operational
- Current V3 review decision: `GO WITH CONDITIONS`
- Current viable/stable baseline: `V3`
- Current deployment inventory: stable version 60 GAS web app plus read-only `@HEAD`, Firebase preview, disabled callable writers, and enabled Firebase scheduled refresh
- Current V3 rollback tag: `v3-stable`
- Current V57 hotfix rollback tag: `v57-noreply-hotfix`
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

- 2026-08-17: Created and billed the standalone Firebase project `timeless-lead-studio` without changing the stable GAS deployment.
- 2026-08-17: Deployed the read-only `leadStudioActionV4` Node 22 Function and an isolated Hosting preview. The Function verifies central Auth before reading the existing `Email Matches` Sheet and returns only curated UI fields.
- 2026-08-17: Registered `lead-studio-v4` and `lead-studio-v4-test` with the central SSO broker. The preview completed signed Chrome acceptance with 302 contacts, lifecycle metrics `32 / 4 / 10 / 9 / 55`, working filters/details, no network or console errors, and no horizontal overflow at 390px.
- 2026-08-17: Kept Gmail scanning, Jira synchronization, Sheet writes, onboarding matching, exports, and the installed daily trigger on GAS v60. Console remains only the access/authentication front door.
- 2026-08-17: Enabled IAM Credentials and Gmail APIs, granted the Firebase runtime service account permission to sign its own Workspace JWTs, and verified the delegated `marketing@timelesstech.io` mailbox profile from the signed Hosting preview. The probe returned mailbox metadata only and completed without browser/runtime errors; no service-account key or user OAuth access token is stored by the Firebase runtime.
- 2026-08-17: Rotated the exposed Jira API token, updated the GAS operational credential, stored the replacement as Firebase secret `LEAD_STUDIO_JIRA_API_TOKEN`, and deployed a settings-only Jira connection probe in Function revision `leadstudioactionv4-00003-run`. Signed preview acceptance confirmed the active Mitja Jira account, 302 Sheet rows, continued Gmail delegation, and no browser errors. GAS v60 independently passed `Check Jira Auth` after the rotation.
- 2026-08-17: Deployed bounded Firebase Jira bulk-status reads in Function revision `leadstudioactionv4-00004-weh`. The settings-only parity run checked 48 unique Sheet-linked keys: all 45 records with cached Jira statuses matched live Jira exactly, with no mismatches; `SF-226`, `SF-248`, and `SF-34` had blank cached statuses and were not returned by Jira. The diagnostic caps runs at 100 validated keys, batches at 50, and returns no contact data.
- 2026-08-17: Added PII-minimized contact-email Jira discovery in revision `leadstudioactionv4-00005-peb`. A 12-contact sample rediscovered 10 exact Sheet issue keys with zero mismatches; `SF-226` and `SF-190` returned no search result. The diagnostic returns row numbers and issue keys only, never contact emails or Jira content.
- 2026-08-17: Added validated direct Jira issue lookup in revision `leadstudioactionv4-00006-sam`. An independent 12-key sample matched 11 cached statuses exactly with zero mismatches; only the already-unresolved `SF-226` returned 404. The client rejects malformed keys and safely treats Jira 404 responses as missing records.
- 2026-08-17: Added bounded keyless Gmail lead search and parser parity in revision `leadstudioactionv4-00007-pev`. The diagnostic mirrored the GAS three-month `New Contact` / `Contact Form` queries, fetched at most 12 unique messages, accepted 7 trusted lead notices, and matched all 7 to existing Sheet rows by message ID, contact email, and company name with zero missing rows or field mismatches. Message bodies, contact values, delegated tokens, and internal Gmail IDs remain absent from normal browser bootstrap data.
- 2026-08-17: Deployed read-only onboarding and deep-query parity in revision `leadstudioactionv4-00011-zoy`. Twelve recent onboarding notices matched stored message IDs and contact fields exactly. The Form-linked `OnboardingRequests` comparison found 55 Lead Studio matches across 101 eligible rows (51 by email and four by responsible-person fallback), with all 55 cached Form rows, Jira keys, and regions exact. The bounded deep Gmail sample exercised all seven undated GAS queries; two trusted lead messages were accepted and both matched cached rows. No Form or Sheet values were changed, normal bootstrap still excludes internal IDs, and Chrome reported no browser errors.
- 2026-08-17: Completed the first audited Firebase write acceptance on `Email Matches` row 2. A settings-only callable checked the client-supplied SHA-256 row version, wrote a unique marker only to `Notes`, verified it, restored the original empty value, and verified the full original row hash exactly. Replaying the idempotency key performed no second mutation. `Debug Log` contains STARTED and COMPLETE records with no lead content. The general runtime was returned to Viewer; a dedicated writer identity now owns Editor access. Final revision `leadstudiowriteacceptancev4-00004-vad` is deployed with acceptance disabled, and Chrome confirmed `failed-precondition` while the normal 302-row preview remained healthy.
- 2026-08-17: Ported filtered CSV/XLSX exports to the Firebase preview using the same 13 visible GAS columns plus Jira Issue URL. Signed Chrome acceptance exported four Qualified Leads as five-row files with 14 headers, valid UTF-8 CSV quoting/BOM and a valid XLSX package; desktop and 390px mobile had no overflow or browser errors.
- 2026-08-17: Deployed disabled manual Jira linking in `leadStudioManualJiraV4`. The command validates the Jira issue live, derives the Atlassian URL, allows only eight GAS-equivalent fields, checks whole-row versions immediately before mutation, uses idempotency keys, and writes metadata-only audits. A settings-only acceptance on row 6 changed the row hash, verified all fields, restored the exact original hash, and suppressed replay. `Debug Log` rows 1584-1585 contain STARTED/COMPLETE with `restored: true`. Final revision `leadstudiomanualjirav4-00003-tep` has its gate false, the UI editor hidden, and no Cloud Run errors.
- 2026-08-17: Deployed a settings-only refresh dry-run in `leadstudioactionv4-00012-yip`. Live central-Auth acceptance loaded all 302 current leads; the bounded scans matched 7/7 accepted lead notices, 12/12 onboarding notices, and all 55 cached Form-linked onboarding matches. Jira planning covered 55 rows and 48 unique keys, with 45 exact live statuses, no planned status changes, and the same three unresolved keys (`SF-226`, `SF-248`, `SF-34`). The PII-minimized response planned zero appends/onboarding mutations and exposed no email or message identifiers. `Email Matches` remained at 483 allocated rows, `Debug Log` remained at 1585 rows, and Cloud Run had no recent errors. GAS v60 remains the sole writer and scheduler because full append payload parsing and operational Gmail pagination are not yet implemented.
- 2026-08-17: Closed the refresh parser/pagination blockers in `leadstudioactionv4-00013-lax`. The backend now produces all 35 GAS `Email Matches` columns privately and follows Gmail page tokens with 100-message pages up to the existing 500-result per-query fast-refresh limit. Live operational acceptance completed both lead-query pages and both onboarding-query pages: 95 lead candidates yielded 18 trusted notices, all 18 matched the Sheet exactly; 27 onboarding candidates yielded 27 exact matches. The public plan exposed counts only, reported `appendPayloadReady: true` and `gmailPaginationComplete: true`, and retained only the disabled mutation/acceptance gate plus active GAS ownership as blockers. Sheet allocation and `Debug Log` remained unchanged, and no recent Cloud Run errors were present.
- 2026-08-17: Added the disabled `leadStudioRefreshV4` whole-refresh writer with whole-Sheet snapshot versions, idempotency, metadata-only audit events, exact post-write verification, and acceptance rollback. Its dedicated service account can read delegated Gmail and write the Lead Sheet, while the normal action runtime remains read-only. The writer is limited to one instance and one concurrent request; both acceptance and operational gates are false.
- 2026-08-17: Replaced the earlier lightweight dry-run with the canonical mutation planner in `leadstudioactionv4-00014-jek` and the disabled writer now at `leadstudiorefreshv4-00003-bet`. Live central-auth acceptance produced the same snapshot hash and summary from both endpoints: 302 source/target rows, 69 planned row updates, zero appends, zero Jira conflicts, complete 95/18 lead and 27/27 onboarding scans, and no PII in either response. Planned fields are Last Jira Check (55), Last Checked (55), Onboarding Submitted At (55), Info Sheet (34), Onboarding Doc (34), and Onboarding Sent At (25). This supersedes the narrower dry-run's zero-change conclusion. No mutation or audit event occurred; `Email Matches` remains 483x35 and `Debug Log` remains 1585x8. Revision 00003 also restores an exact target snapshot after an ambiguous write-response failure.
- 2026-08-17: Removed the Apps Script `scheduledRefreshLeads` trigger and verified the project shows zero triggers. Enabled only the Firebase acceptance gate long enough to write all 69 planned rows, verify the target hash, restore the exact original 302-row hash, and suppress an idempotent replay. `Debug Log` rows 1586-1587 contain metadata-only STARTED/COMPLETE events with `restored: true`. The callable returned to revision `leadstudiorefreshv4-00005-hem` with both mutation gates false and the temporary central-auth signing grant removed.
- 2026-08-17: Deployed `leadStudioScheduledRefreshV4` as the sole automatic writer at 06:00 Europe/Ljubljana, with no retries, one instance/concurrency, and the dedicated writer identity. A disabled-gate invocation first returned HTTP 200 without writes. After enabling only the scheduler gate, a production run persisted the canonical 69-row plan with zero appends/conflicts; `Debug Log` rows 1588-1589 record STARTED/COMPLETE with `restored: false`. An independent read-only plan confirmed the current Sheet hash exactly matches the audited written hash and now requires only the expected 55 daily Jira timestamp updates. Final revision is `leadstudioscheduledrefreshv4-00002-fen`; the next automatic run is 2026-08-18 at 06:00 Ljubljana time.
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
- 2026-06-22: Browser smoke tests passed with `passed: 6`, `failed: 0`.
- 2026-06-22: Reserved four-digit metric counter space and made the Contacts metric reflect active visible filters.
- 2026-06-22: Created final `Archive/Snapshots/Lead Studio V3 Stable/` and `Archive/Snapshots/Lead Studio V3 Stable.zip`.
- 2026-06-22: Ran the full V3 completion review pack and saved the ordered reports in `Reports/`.
- 2026-07-20: Pushed sender-filter fix to Apps Script, created version 56, and redeployed the stable web app deployment ID to `@56`.
- 2026-07-20: Tightened current `New Contact` sender configuration so form notices are accepted from `noreply@timelesstech.io` / `no-reply@timelesstech.io`, not the marketing mailbox sender; created version 57 and redeployed the stable web app deployment ID to `@57`.
- 2026-07-20: Operator confirmed `Settings > Refresh Leads` found the missing post-2026-06-21 contacts after the version 57 sender fix.
- 2026-07-20: Ran V57 hotfix completion review pack, saved dated reports in `Reports/`, and recorded final decision `GO WITH CONDITIONS`.
- 2026-07-20: Investigated lifecycle metric mismatch. Four onboarded rows had Jira keys but blank Jira/Lead Status, so they counted in Onboarding but not in lifecycle chips; updated New Lead metric/filter to include onboarded Jira-key rows with missing status.
- 2026-07-20: Pushed lifecycle metric fix to Apps Script, created version 58, and redeployed the stable web app deployment ID to `@58`.
- 2026-06-22: Stabilized the table toolbar into fixed metric/filter and search/export/settings rows, and added outside-click/Escape closing behavior for filter/export dropdowns.
- 2026-06-22: Pushed the updated Apps Script source files to project head with `clasp push`; no new version or stable deployment repoint has been created yet.
- 2026-07-20: Investigated stalled contact updates. Scheduled refreshes were succeeding but adding 0 rows because current `New Contact` form notices now arrive from `noreply@timelesstech.io`; added trusted form sender handling and smoke coverage.
- 2026-06-22: Moved live Apps Script files into `AppsScript/`, set `.clasp.json` `rootDir` accordingly, added `Phase_Completion_Review_Pack/`, `Reports/`, and `Resources/`, and moved sensitive historical notes into `ProjectControl/DocumentationArchive/`.
- 2026-06-22: Created Apps Script version 47, `Fix toolbar dropdown stability`, and redeployed the stable web app deployment ID to `@47`.
- 2026-06-22: Added a `Clear filters` button, locked dropdown label wrapping/count behavior, and fixed table column widths to reduce layout jumps.
- 2026-06-22: Added client-side Email Date range filtering with Last 7 days, Last 30 days, and custom from/to selectors; `Clear filters` now resets dropdown, status, and date filters.
- 2026-06-22: Added `scheduledRefreshLeads()` plus trigger install/remove/status helpers for a daily 06:00 project-time Refresh Leads job.
- 2026-06-22: Added token-protected setup endpoint actions for installing, removing, and checking the daily refresh trigger.
- 2026-06-22: Deployed trigger helpers at version 51. One-time owner authorization/install is still required before the daily trigger is active.
- 2026-08-05: Added shared `TimelessStudioAuth` integration for `studioPolicies/lead-studio`, pushed the Apps Script source, and redeployed the stable web app deployment ID to `@59`.
- 2026-08-05: Completed shared-auth phase cleanup, rerouted scheduled/internal refresh paths away from protected UI wrappers, and redeployed the stable web app deployment ID to `@60`.

## Current Risks

- Firebase Scheduler is the sole automatic refresh writer. GAS v60 still exposes manual refresh controls as a rollback path, so operators must not use them while the Firebase schedule is active.
- The first natural 06:00 Firebase scheduled run still needs observation even though an identical manually launched production Scheduler run completed successfully.
- Filtered exports and the reversible manual Jira-link command have passed Firebase acceptance. The Firebase manual Jira endpoint/editor remain disabled; GAS continues to provide the manual rollback workflow until Hosting promotion.
- The Hosting preview expires on 2026-08-31 unless renewed or replaced. Production Hosting has not been promoted.
- The source Sheet is currently readable by link, matching its pre-migration state. Tightening Drive sharing should be a separate reviewed data-access change after a dedicated runtime identity can be granted access.
- `NOTES.md` contains sensitive historical setup details and must stay excluded from push/share workflows.
- Apps Script shows zero installed triggers. Do not reinstall its daily trigger unless explicitly rolling back and first disabling the Firebase scheduled-refresh gate.
- Setup/test URL token handlers still exist in `Code.js`, but URL access is disabled by default unless `LEAD_STUDIO_SETUP_ENDPOINTS_ENABLED=true` or `LEAD_STUDIO_TEST_ENDPOINTS_ENABLED=true` is set temporarily.
- There is a lightweight Apps Script smoke-test harness for parser, Jira mapping, date-range, and export-row behavior; sheet-update behavior still needs deeper automated coverage later.
- `Script.html` and `GmailScanner.js` are large modules; future changes should stay focused or be split only after behavior is covered.
- Only files inside `AppsScript/` are live deployment candidates; archive/support folders must stay outside the `clasp` source root.
- Because source now lives in `AppsScript/`, verify `clasp status` before every push to confirm only live source files are tracked.
- Shared-auth source integration now expects Marketing Studio Console / TimelessStudioAuth policy `studioPolicies/lead-studio` to control who can access Lead Studio.

## Verification Set

Use this minimum check before code/config deployment:

```text
clasp status
clasp deployments
clasp versions
npm run check
```

Firebase pilot checks:

```text
firebase functions:list --project timeless-lead-studio
firebase hosting:channel:list --project timeless-lead-studio
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="leadstudioactionv4" AND severity>=ERROR' --project timeless-lead-studio --freshness=30m
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

Current Apps Script trigger state after the V4 cutover:

```text
Apps Script Triggers => 0 triggers
```

## Completion Review Rules

- Run `Phase_Completion_Review_Pack/` before declaring a major phase stable.
- Save dated reports in `Reports/` using the existing `YYYY_MM_DD_Phase_<phase>_*_Report.md` naming pattern.
- Move any open review conditions into `ProjectControl/CHECKLIST.md`.
- Create a snapshot under `Archive/Snapshots/` only after the review reports and control docs are updated.
- Do not commit `ProjectControl/DocumentationArchive/NOTES.md`, `Archive/`, local zip snapshots, or Google Drive shortcut files to GitHub.

## V3 Notes

- Stable deployment is version 60.
- V2 remains available as git tag `v2-stable`.
- V3 is tagged as `v3-stable`; final counter fixes are included.
- V57 hotfix completion review decision is `GO WITH CONDITIONS`.
- `clasp run runLeadStudioSmokeTests` is blocked by the local Apps Script execution permission context, so use Apps Script editor or Settings > Run Smoke Tests for runtime validation.
- Full V3 completion review decision is `GO WITH CONDITIONS`.
- Treat V3 as the stable UI/rollback baseline while V4 owns the operational daily refresh.
- Shared-auth integration is deployed at version 60; controlled live verification is still needed for Mitja, Gaja, Vanesa, and a denied external account.

## V4 Firebase Runtime

V4 owns the operational daily refresh and continues to serve its Hosting preview. It proves standalone billing/ownership, central SSO, protected Sheet reads, lifecycle metrics, filtering, contact details, exports, mobile layout, Gmail/onboarding/Jira parity, audited whole-Sheet writes, and Cloud Scheduler execution. GAS v60 remains the stable UI and explicit rollback deployment.

Next controlled slices:

- Observe the first natural 06:00 Scheduler run and verify its COMPLETE audit.
- Add bounded Debug Log reads, refresh duration, and scheduled-failure visibility to Operations.
- Promote the Hosting/Console tile only after final production QA and rollback review.
- Enable the already accepted Firebase manual Jira workflow only as part of the UI promotion, then retire the equivalent GAS write path.

### V4 Write Safety Contract

- Firebase Scheduler is the only automatic writer. GAS v60 must remain trigger-free while it is enabled.
- Every command is backend-only, requires central Auth write/settings scope, accepts an idempotency key, and permits only an explicit field allowlist.
- The client supplies an expected row version derived from stable persisted values. The Function rereads the row immediately before mutation and rejects stale versions without writing.
- Each attempt records actor, command, row number, idempotency key, expected/observed versions, allowed changed fields, timestamp, and outcome. Contact values, tokens, message bodies, and Jira payloads are excluded from audit records.
- Write acceptance begins on one owner-designated test lead. Cutover requires stopping the GAS trigger/writer first, running final read parity, enabling one Firebase writer, and proving rollback before any Console tile change.

## Documentation Rules

- Update this file after meaningful runtime, deployment, integration, or folder-structure changes.
- Keep active tasks in `ProjectControl/CHECKLIST.md`.
- Keep historical deployment details in `ProjectControl/DocumentationArchive/NOTES.md`, but do not copy secrets into status/control docs.
- Use `Phase_Completion_Review_Pack/` for reusable phase-review templates and save completed dated reports in `Reports/`.
