# Lead Studio Project Status

Current status source of truth for Lead Studio.

Last updated: 2026-09-02

Repository: `https://github.com/MichoTronic/LeadStudio.git`

Active release branch: `release/v5`; production source commit `4323dda`.

## V5 Google Client Upgrade Accepted - 2026-09-02

Lead Studio V5 is live. The monolithic `googleapis` dependency was replaced by
`@googleapis/sheets` 14 and `@googleapis/iamcredentials` 11, Cloud Storage was
upgraded to 8.0.1, and Firebase Admin/Functions were upgraded within their
supported Node 22 lines. `google-auth-library` remains intentionally pinned to
10.9.1 so Lead Studio shares the same auth major used by the Google/Firebase
dependency graph instead of loading a second incompatible auth engine.

All 97 tests pass with 96.49% line, 75.72% branch, and 96.35% function coverage;
the dependency audit reports zero vulnerabilities. The service-specific Google
client module has 100% line/function coverage, explicit least-privilege scopes,
30-second request limits, and disabled implicit retries. The installed
dependency tree is 70,987,955 bytes; the retired `googleapis` package alone was
183,392,484 bytes. Warm isolated module loading measured about 0.12 seconds,
versus about 0.95-1.03 seconds for the old umbrella client after filesystem
warm-up (and 20.70 seconds on the first Drive-backed cold load).

Production Hosting version `51c69433f1156591`, release
`1788366679323000`, and these exact revisions are active:

- `leadstudioactionv5-00001-xom`
- `leadstudiogmailpushv5-00001-ceq`
- `leadstudiohealthcheckv5-00001-nid`
- `leadstudiomanualjirav5-00001-bub`
- `leadstudiorenewgmailwatchv5-00001-gim`
- `leadstudioscheduledrefreshv5-00001-pup`

The independent inventory found exactly six active V5 Functions, three enabled
V5 Scheduler jobs, and one V5 Eventarc Gmail trigger, with no V4 runtime left.
The live desktop/mobile shell, production V5 configuration, cache revision,
security headers, and unsigned 401 boundary passed. Runtime-identity exercises
passed for health (1.48 seconds), Gmail watch renewal (1.33 seconds), and the
full scheduled refresh (2.52 seconds; 55 changed rows, zero appends, replayed).
No lock or compatibility object remained. The only warning after deployment was
the deliberate unsigned 401 security probe. See
`Reports/2026_09_02_V5_Google_Client_Compatibility_And_Performance_Review.md`.

## V4.0.2 Ordered Completion Review Accepted - 2026-09-02

The ordered 01-05 completion review is complete with a final **GO** decision.
The review found a callable-deadline risk in sequential settings-only Jira
diagnostics and consolidated four duplicate bounded-map implementations into a
single tested utility. Jira diagnostic work is now limited to four concurrent
requests with deterministic output ordering. Firebase Admin and the vulnerable
transitive `qs` package were patched; the production audit is clean. Browser
hardening now includes clickjacking protection and integrity verification for
the pinned Lucide asset.

All 93 tests pass with 96.43% line, 75.69% branch, and 96.32% function
coverage. The live desktop/mobile signed-out shell passes without overflow,
runtime errors, or failed resources. An unsigned callable request returns 401.
A production health check passed in 4.86 seconds, and the full scheduled refresh
completed in 9.79 seconds with 55 changed rows, zero appends, and no replay. The
post-exercise log window is clean.

Hosting version `9f7db17955b94011`, release `1788363918838000`, and these six
Function revisions are active:

- `leadstudioactionv4-00026-pow`
- `leadstudiogmailpushv4-00008-tax`
- `leadstudiohealthcheckv4-00007-tov`
- `leadstudiomanualjirav4-00015-kod`
- `leadstudiorenewgmailwatchv4-00007-lex`
- `leadstudioscheduledrefreshv4-00011-bil`

One malformed-JSON error at 15:46:31 UTC was synthetic review traffic and is
documented so it is not misclassified as an application incident. See
`Reports/2026_09_02_Phase_V4_0_2_Completion_Review_Pack_Run_Report.md`.

## V4.0.1 Deep Maintenance Accepted - 2026-09-02

The full production code/runtime sweep found and repaired a future replay
integrity defect in fixed-range audit lookup, an unbounded Jira discovery
burst, the remaining unbounded Gmail contact-activity path, CSV formula
interpretation risk, invalid XLSX control characters, permissive HTTP browser
links, stale Preview labeling, and default callable concurrency. The daily
refresh now has two bounded retries after an August 27 transient Jira 404 was
found to have skipped that day's zero-retry run.

All 90 checks pass with 96.42% line coverage and zero dependency
vulnerabilities. Hosting `21a11812cbf8c21f` and all six final Function
revisions are active at 100% traffic. Six retired acceptance/refresh variables
were removed from the local production environment and every deployed Function.
A production health check passed in 4.39 seconds; an end-to-end scheduled
refresh then completed successfully with 55 normal row updates, zero appends,
and no replay. No post-deployment runtime error was found. See
`Reports/2026_09_02_V4_Deep_Maintenance_Sweep.md`.

## V4 Gmail Push Timeout Hotfix Accepted - 2026-09-02

Two Gmail Pub/Sub requests on 2026-09-01 returned HTTP 504 at the exact
360-second deadline. The executions later completed successfully with one or
two candidates, no accepted lead/onboarding messages, and zero Sheet changes;
subsequent deliveries are healthy. The defect is an unbounded provider-request
path combined with a five-minute writer-lock lease shorter than the Function
deadline.

The accepted production fix adds 30-second Gmail/OAuth, IAM Credentials, and Sheets
request bounds; disables implicit Google-client retries in favor of the existing
whole-event Pub/Sub retry/idempotency; extends the shared lock lease to 15
minutes; and adds metadata-only stage timing. All 83 checks pass and the
production dependency audit reports zero vulnerabilities.

At that checkpoint source used package `4.0.0`, V4 Function names,
and production Auth client `lead-studio-v4`. Lead Studio has no persistent
staging/preview environment, so retired preview selection, origin, and Auth
fixture are removed. All six new revisions serve 100% traffic. A controlled
production push returned HTTP 204 in 6.86 seconds and completed in 6.82 seconds
with zero changed/appended rows. See
`Reports/2026_09_02_V4_Gmail_Push_Timeout_Hotfix.md`.

## Final Validation And Runtime Cleanup - 2026-08-20

The post-release validation passes 81/81 checks after removing obsolete
acceptance-only code. Hosting version `298d0a3af1bf3263` is live and no longer
contains the retired GAS operations link or browser hooks for the old Notes
write acceptance. `leadStudioRefreshV4` and
`leadStudioWriteAcceptanceV4` were deleted from Firebase; their accepted test
history remains in Git and this document.

The operational Jira writer was redeployed without its old acceptance-only
branch as `leadstudiomanualjirav4-00011-xon`. The remaining six Functions are
the action API, manual Jira writer, scheduled refresh, Gmail push, Gmail-watch
renewal, and health check. The latest 24-hour Cloud Run/Function error query is
clean for Lead Studio.

## Cross-Studio Completion Review - 2026-08-19

All 83 Lead checks pass. Source/runtime reconciliation, tracked-secret and
payload review, Gmail-push idempotency, anomaly detection, export allowlists,
and retained GAS ownership were rechecked with no release-blocking finding.
The accepted Firebase baseline remains **GO** and no deployment or live-data
mutation was part of this review. See
`Reports/Cross_Studio_Completion_Review_2026_08_19.md`.

## Natural Gmail-Push Acceptance - 2026-08-19

A trusted contact-form notice arrived naturally on 2026-08-18 at 18:23 UTC.
`leadStudioGmailPushV4` reported one candidate, one accepted lead, one appended
row, zero changed rows, and no replay. The Gmail message ID occurs exactly once
in `Email Matches`, at row 305. `Debug Log` rows 1628-1629 contain the matching
`FIREBASE_GMAIL_PUSH_STARTED` / `COMPLETE` pair with the same idempotency key,
one append, verified source/target hashes, and duration only; no contact values,
message IDs, or message bodies are present in the audit.

The accepted event closes the broad-scan hold. The 06:00 reconciliation now
uses a 14-day Gmail lookback while retaining the full Sheet, Form-linked
onboarding, and Jira reconciliation behavior. Expired Gmail-history recovery
still forces the intentionally broad scan. Configuration-only revisions
`leadstudioactionv4-00022-qoj`, `leadstudiorefreshv4-00008-mer`,
`leadstudioscheduledrefreshv4-00007-lew`, and
`leadstudiogmailpushv4-00004-tew` are active with 100% traffic. All 83 tests
pass and no post-deployment Function errors were found.

## Deep Data-Quality Production Checkpoint - 2026-08-19

Commit `179f1d3` is deployed in `leadStudioActionV4` revision
`leadstudioactionv4-00021-moq`; previous revision
`leadstudioactionv4-00020-wes` remains the immediate rollback. Lead bootstrap
metadata now reports bounded row-number-only anomalies for duplicate contact
emails, Gmail message IDs, and Jira keys; malformed emails or Jira keys; and
Jira URL/key mismatches. Contact values and provider IDs remain absent from the
anomaly payload and normal browser lead rows. The full Lead suite passes 83/83,
the production dependency audit is clean, unsigned access returns HTTP 401,
and the new revision produced no error logs. No Hosting, other Function,
Scheduler, Sheet, Form, Gmail, or Jira mutation was part of this promotion.

## Runtime Posture

The obsolete Firebase preview channel, central Auth preview registration, and
versioned GAS web deployment were retired on 2026-08-20 after their accepted
rollback windows ended. Production Firebase Hosting and the retained
operational Functions remain active. GAS source, immutable versions, and Git
history remain available, but GAS has zero triggers and no callable web
deployment.

- Product: `Lead Studio`
- Retained rollback material: Google Apps Script version 60 source and history; zero triggers and no versioned web deployment
- Operational refresh platform: Firebase Node 22 Functions and Cloud Scheduler in `timeless-lead-studio`
- Storage: `Lead Studio Database` Google Sheet
- Local folder: `D:\GoogleDrive\_Share\TimelessTech\Marketing\Optmizations\LeadStudio`
- Parent Google Drive folder: `1keVmyWTXwqQM0cK5AWQzFPIKM7K7hyt1`
- Current local code line: V5 Firebase production, with the dark Console UI, responsive lead workflow, protected Gmail contact activity, event-driven Gmail ingestion, and accepted Firebase scheduled-refresh runtime
- Legacy Apps Script rollback source: `AppsScript/`
- Official Version 1 checkpoint: Version 45
- Final GAS version checkpoint: Version 60 - Auth phase cleanup; web deployment retired 2026-08-20
- Firebase production: `https://timeless-lead-studio.web.app`; accepted V5 Hosting version `51c69433f1156591` promoted on 2026-09-02
- Firebase action Function: `leadStudioActionV5` revision `leadstudioactionv5-00001-xom`, region `europe-west1`, runtime Node 22, maximum four instances and concurrency 10; canonical operational refresh planner, authorized bounded Gmail contact activity, settings-authorized metadata-only operations status, and 14-day reconciliation status
- Firebase scheduled writer: `leadStudioScheduledRefreshV5` revision `leadstudioscheduledrefreshv5-00001-pup`, daily 06:00 Europe/Ljubljana, two retries within 15 minutes, one instance/concurrency, operational gate enabled, and 14-day Gmail reconciliation lookback
- Firebase Hosting mode: live only; central Auth policy `studioPolicies/lead-studio`
- Firebase manual Jira workflow: `leadStudioManualJiraV5` revision `leadstudiomanualjirav5-00001-bub`, one instance/concurrency, signed key-based QA passed, issue-key/API-host/custom-browser-host input enabled, canonical `jira.at.semper7.net` links stored, operational gate enabled, editor enabled on Firebase Hosting, dedicated writer identity
- Firebase writer serialization: private `timeless-lead-studio-writer-locks` bucket with atomic object-generation acquisition shared by scheduled refresh, Gmail push, and manual Jira mutation paths
- Firebase Gmail delegation: keyless IAM `signJwt` as `819383433430-compute@developer.gserviceaccount.com`, impersonating `marketing@timelesstech.io` with Gmail readonly scope
- Firebase Gmail push: topic `lead-studio-gmail-changes`, daily 03:00 watch renewal in revision `leadstudiorenewgmailwatchv5-00001-gim`, durable private history cursor, retrying single-instance `leadStudioGmailPushV5` revision `leadstudiogmailpushv5-00001-ceq`, 30-second provider bounds, 15-minute shared writer lock, and topic-only Gmail publisher IAM
- Firebase health: `leadStudioHealthCheckV5` revision `leadstudiohealthcheckv5-00001-nid` every six hours plus enabled `Lead Studio runtime failures` log-match alert policy to `mitja@timelesstech.io`
- Firebase Jira credential: `LEAD_STUDIO_JIRA_API_TOKEN` in Secret Manager; scheduled synchronization is operational
- Current V5 production decision: `GO`; Google client compatibility accepted in production
- Current release branch/tag: `release/v5` / `V5` (V4.0.2 retained as rollback)
- Current viable/stable baseline: `V5`
- Current deployment inventory: retained GAS v60 source with zero triggers and no web deployment, live Firebase Hosting, enabled manual Jira workflow, enabled 06:00 refresh, enabled Gmail watch/push, and enabled health monitoring; obsolete acceptance/callable-refresh Functions are deleted; Console launches the Firebase app
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
- Show Jira links, lifecycle counters, All leads, GAS-parity facet filters, Date/Company sorting, Inquiry details, filtered exports, manual Jira key-or-URL edits, and bounded Gmail conversation activity in the UI.
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
- 2026-08-17: Split manual Jira operational and acceptance gates, fixed the dormant preview editor status-element error, and briefly enabled the operational path for a real same-key save on test row 6. Provider validation passed, the row version changed, and idempotent replay caused no second write; `Debug Log` rows 1590-1591 contain metadata-only STARTED/COMPLETE records. Because no controllable browser was connected, the preview editor was hidden again and both gates were disabled.
- 2026-08-17: Added a shared distributed writer lock for every Firebase mutation path. The dedicated writer atomically creates a generation-checked object in private bucket `timeless-lead-studio-writer-locks`, waits at most five seconds for contention, deletes only its acquired generation, and recovers locks after a five-minute expiry. All 57 tests pass. Revisions `leadstudiorefreshv4-00006-kab`, `leadstudioscheduledrefreshv4-00003-sup`, `leadstudiowriteacceptancev4-00005-bey`, and `leadstudiomanualjirav4-00006-sed` are live with only the scheduled gate enabled. A controlled Scheduler run returned HTTP 200 through the lock, replayed its existing idempotency key without mutation, released the lock object, and produced no service errors.
- 2026-08-17: Opened the already accepted manual Jira workflow for signed preview browser QA. Preview config exposes the editor, operational backend revision `leadstudiomanualjirav4-00007-xiw` is enabled, and the acceptance gate remains false. The preview release expires 2026-08-31; production Hosting was not changed.
- 2026-08-18: Observed the first natural 06:00 Europe/Ljubljana Firebase Scheduler run. Revision `leadstudioscheduledrefreshv4-00003-sup` returned HTTP 200 in 15.4 seconds, changed 55 existing rows, appended one new lead, and updated two onboarding-notice matches. `Debug Log` rows 1592-1593 contain STARTED/COMPLETE with `restored: false`, and no retry or error occurred.
- 2026-08-18: Accepted signed manual Jira preview QA after a successful same-key save on row 6. `Debug Log` rows 1594-1595 contain STARTED/COMPLETE with `restored: false`. Fixed the reported compressed Jira-key field by replacing the form's conflicting flex sizing with stable desktop and mobile grids, then redeployed the preview.
- 2026-08-18: Restored core GAS list parity in the Firebase preview: All leads and clickable lifecycle metrics, multi-select Business type / Target region / Interested in facets, Date and Company sorting, and Inquiry in the contact dialog. The manual Jira editor now accepts either a key or a full HTTPS `/browse/KEY` URL from the configured Atlassian tenant and stores the canonical key/link; unrelated origins and paths are rejected. Revisions `leadstudioactionv4-00015-yoy` and `leadstudiomanualjirav4-00008-yil` are active, preview version `397c4a870f889c09` is released, and all 62 automated checks pass. Production Hosting and GAS v60 were unchanged.
- 2026-08-18: Reconciled the old Jira host split: API calls remain on `gaming-universe.atlassian.net`, while pasted and stored browser links use `jira.at.semper7.net`. Added a fixed five-product Interested in vocabulary with alias matching (`Turnkey Solution` maps to White Label and unrelated historical text maps to blank display), inclusive custom From/To date filtering, Console-aligned blue accents, and row-wide desktop detail opening. Manual Jira revision `leadstudiomanualjirav4-00009-rof` and preview version `059e8e6ecb556666` are active; all 64 automated checks pass. Historical Sheet/Form rows, the Form connection, production Hosting, GAS v60, and Scheduler ownership were unchanged.
- 2026-08-18: Replaced the preview's light interface with the full dark navy Marketing Studio Console visual system across authentication, navigation, lifecycle metrics, filters, date controls, lead tables/cards, dialogs, Jira editing, and responsive states. Preview version `86ef5e4acc0bed48` is active and all 64 automated checks pass. This was a Hosting-preview-only visual release; Functions, production Hosting, Sheet/Form data, GAS v60, and Scheduler ownership were unchanged.
- 2026-08-18: Adopted the Gmail API watch + Cloud Pub/Sub direction for near-real-time lead ingestion. The planned Function will consume incremental Gmail history under the existing writer lock and message-ID idempotency controls; a daily watch renewal and the 06:00 reconcile/Jira job remain for reliability. The active Gmail schedule was not changed in this step. Preview version `fea9e9cd86d3322e` now keeps desktop controls visible around a viewport-contained scrolling table with sticky headers and uses the canonical white-on-Console-blue Timeless Tech favicon; mobile retains its responsive contact-card layout.
- 2026-08-18: Added protected, on-demand Gmail contact activity to the Firebase preview. `leadStudioActionV4` revision `leadstudioactionv4-00016-dux` resolves a browser-supplied Sheet row only after central read authorization, then combines the stored original thread, onboarding threads, and exact participant-matched related threads. The response is capped at eight conversations, 40 messages, and 12,000 plain-text characters per message; it excludes Gmail IDs and delegated tokens, strips quoted history/unsafe HTML, and does not persist message bodies. Preview version `84976f8054e38660` presents a wide two-panel desktop dialog and mobile `Details` / `Conversation` tabs with compact message accordions; a follow-up layout fix gives direction, timestamp, subject, and excerpt independent rows so native disclosure rendering cannot overlap them. All 68 automated checks pass, preview assets return HTTP 200, production Hosting was unchanged, and signed desktop/mobile conversation acceptance remains open.
- 2026-08-18: Extended the filtered CSV/XLSX sales export from 14 to 19 columns while preserving every legacy column position. The appended fields are Lead Status, Inquiry, Onboarding Sent At, Onboarding Submitted At, and Last Contacted / Last Activity At. Activity prefers an exact timestamp when supplied and otherwise selects the latest parseable Email Date/onboarding event across ISO and day-first Sheet formats; Last Checked is intentionally not treated as customer activity. Preview version `9b46cb12635f5e1a` is active, all 69 automated checks pass, and production Hosting/backend/Sheet/scheduler state was unchanged.
- 2026-08-18: The production-readiness review confirmed 303 populated lead rows, no duplicate Gmail message IDs, no missing source email/message IDs, and no impossible lifecycle state. Twenty-two repeated contact-email groups are retained as distinct form submissions. New Gmail ingestion now stores only the approved five-product Interested in vocabulary with conservative alias matching; unrelated text is blank. Refresh now canonicalizes every linked Jira browser URL to `jira.at.semper7.net`. All 82 tests pass. The affected Node 22 Function revisions are deployed with source hash `18c9fdf57b29023796bdc5d65c9eb70067b28e88`; preview Hosting version `2ebf4cbe315f4974` returns HTTP 200 and the callable rejects unauthenticated data access with HTTP 401. Production Hosting remains empty and signed acceptance is pending.
- 2026-08-19: The 06:00 scheduled refresh and one controlled diagnostic retry failed with HTTP 500 because the dedicated writer no longer had permission to read Form-linked spreadsheet `TLT_Onboarding_Form`. Gmail watch, Gmail push, the main Lead Sheet, writer lock, health checks, Scheduler authentication, and Jira credentials remained healthy. Restored only Reader access for `lead-studio-writer@timeless-lead-studio.iam.gserviceaccount.com`; the Google Form connection and Sheet content were untouched. The controlled catch-up at 08:46 UTC returned HTTP 200, reconciled 56 existing rows, appended zero rows, and left Scheduler status clear.
- 2026-08-18: Owner desktop/mobile acceptance passed. Exact preview version `2ebf4cbe315f4974` was cloned to live Hosting, direct live HTTP/title/favicon checks passed, and Marketing Studio Console now launches `https://timeless-lead-studio.web.app`. Source commit `d29396a` is pushed. GAS v60 remains trigger-free rollback source only.
- 2026-08-18: Implemented and enabled Gmail `users.watch` plus Pub/Sub incremental history ingestion. The topic grants publisher only to Google's Gmail push identity; Eventarc uses the dedicated writer identity with explicit receiver/invoker access. Watch renewal passed, current-cursor delivery passed end to end, queued retries completed with zero mutations, and idempotent replay passed. A private GCS cursor, expired-history reconciliation, narrow Gmail-only mutation planner, bounded Operations status, refresh duration metadata, six-hour health check, and Cloud Monitoring email policy are active. All 79 automated checks passed. Hosting and the Console tile were unchanged.
- 2026-08-19: Closed natural Gmail-push acceptance using the trusted lead delivered at 18:23 UTC on 2026-08-18. Structured logs recorded one candidate, one accepted lead, one append, and no replay; the Gmail message ID appears exactly once at `Email Matches` row 305. Metadata-only `Debug Log` rows 1628-1629 contain the matching STARTED/COMPLETE pair and no lead or Gmail content. Enabled the planned 14-day daily Gmail reconciliation lookback on the action, callable refresh, scheduled refresh, and push-recovery Functions; explicit expired-history recovery remains broad. All 83 tests pass and the four active revisions have no post-deployment errors.
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
- The first natural 06:00 Firebase scheduled run passed on 2026-08-18. Continue normal monitoring through the planned Operations visibility work.
- Filtered exports, key-based manual Jira linking, canonical custom-host Jira URLs, five-product normalization, custom dates, row interaction, dark Console styling, and desktop/mobile layout passed owner acceptance and are live.
- The expiring Hosting preview is retained only for QA/rollback; production uses the permanent live channel.
- Drive permission metadata confirms the source Sheet has no anonymous permission. Named collaborators and the dedicated runtime identities retain explicit access.
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

V4 owns the operational daily refresh and live Hosting UI. It proves standalone billing/ownership, central SSO, protected Sheet reads, GAS-parity list filters/sorting, Inquiry details, lifecycle metrics, exports, mobile layout, Gmail/onboarding/Jira parity, audited whole-Sheet writes, and Cloud Scheduler execution. GAS v60 remains an explicit rollback deployment with zero triggers.

Next controlled slices:

- Continue monitoring daily Scheduler runs; the first natural 06:00 run and COMPLETE audit passed on 2026-08-18.
- Treat the signed desktop/mobile Lead Studio UI and functional pass as accepted.
- Monitor the first natural 06:00 run with the enabled 14-day Gmail reconciliation fallback; natural push acceptance and the configuration promotion passed on 2026-08-19.
- Keep bounded Operations metadata and Cloud Monitoring failure email active.
- Monitor the live Hosting/Console launch and Firebase writers through the post-live acceptance window.
- Retire the equivalent GAS UI/write path after post-live acceptance; retain its source in git.

### V4 GAS Parity Decisions

- Retained: secure list load, view refresh, lifecycle metrics, search, canonical attribute filters, preset/custom dates, Date/Company sorting, filtered CSV/XLSX export, contact details, manual Jira editing, responsive cards, and keyboard-accessible row opening.
- Replaced: the GAS automatic/manual refresh model is owned by the single Firebase Scheduler and audited Firebase writer; no second refresh writer is exposed in the preview.
- Intentionally excluded: raw Gmail IDs, delegated tokens, phone/address fields, setup/service-account details, and direct smoke-test buttons remain outside browser responses. Sanitized Gmail message text is returned only by the authorized, on-demand contact-activity action and is not persisted by Lead Studio.
- Operations: bounded Debug Log status and duration metadata are settings-authorized and non-user-facing; six-hour health checks and email failure alerts are active.

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
