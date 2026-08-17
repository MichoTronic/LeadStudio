# Lead Studio Project Status

Current status source of truth for Lead Studio.

## Runtime Posture

- Product: `Lead Studio`
- Stable platform: Google Apps Script web app version 60
- Parallel pilot: Firebase Hosting preview plus Node 22 Cloud Function in `timeless-lead-studio`
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
- Firebase pilot mode: read-only; central Auth policy `studioPolicies/lead-studio`
- Firebase Gmail delegation: keyless IAM `signJwt` as `819383433430-compute@developer.gserviceaccount.com`, impersonating `marketing@timelesstech.io` with Gmail readonly scope
- Firebase Jira credential: `LEAD_STUDIO_JIRA_API_TOKEN` in Secret Manager; the settings-only connection probe is deployed, while Jira issue reads and synchronization remain on GAS v60
- Current V3 review decision: `GO WITH CONDITIONS`
- Current viable/stable baseline: `V3`
- Current deployment inventory: stable version 60 web app deployment plus Apps Script read-only `@HEAD`
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

- The Firebase pilot is intentionally read-only. Do not point the Console production tile to it or retire GAS until write, Gmail, Jira, scheduled-refresh, export, and rollback acceptance is complete.
- Firebase Jira support now proves credentials, `/rest/api/3/myself`, and bounded bulk status reads by issue key. Keep contact-email discovery, direct issue lookup, refresh orchestration, and synchronization on GAS until their Firebase implementations pass parity and rollback acceptance.
- The Hosting preview expires on 2026-08-31 unless renewed or replaced. Production Hosting has not been promoted.
- The source Sheet is currently readable by link, matching its pre-migration state. Tightening Drive sharing should be a separate reviewed data-access change after a dedicated runtime identity can be granted access.
- `NOTES.md` contains sensitive historical setup details and must stay excluded from push/share workflows.
- Daily refresh trigger is installed and confirmed with `triggerCount: 1`; July 2026 scheduled runs are completing, and the 2026-07-20 noreply sender fix is deployed. Manual Refresh Leads backfilled the missing contacts; the remaining condition is observing the next automatic scheduled run after version 57.
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

- Stable deployment is version 60.
- V2 remains available as git tag `v2-stable`.
- V3 is tagged as `v3-stable`; final counter fixes are included.
- V57 hotfix completion review decision is `GO WITH CONDITIONS`.
- `clasp run runLeadStudioSmokeTests` is blocked by the local Apps Script execution permission context, so use Apps Script editor or Settings > Run Smoke Tests for runtime validation.
- Full V3 completion review decision is `GO WITH CONDITIONS`.
- Treat V3 as the current viable/stable Lead Studio baseline while V4 is planned.
- Shared-auth integration is deployed at version 60; controlled live verification is still needed for Mitja, Gaja, Vanesa, and a denied external account.

## V4 Firebase Pilot

The first V4 slice is active in parallel and read-only. It proves standalone billing/ownership, central SSO, protected Sheet reads, lifecycle metrics, filtering, contact details, and mobile layout. GAS v60 remains the stable operational baseline.

Next controlled slices:

- Design backend-only write commands with row/version conflict checks and an audit trail.
- Port contact-email Jira discovery and direct single-issue reads using the verified Secret Manager credential, then design refresh orchestration without enabling writes or duplicate synchronization.
- Extend the verified keyless Gmail delegation from mailbox-profile diagnostics to bounded message searches and parser parity. Do not introduce a service-account JSON key or store user OAuth access tokens.
- Recreate scheduled refresh with Cloud Scheduler only after duplicate execution is impossible.
- Port export and manual Jira-link workflows, then run parity and rollback acceptance.
- Switch the Console tile only after the Firebase runtime owns the full accepted workflow.

## Documentation Rules

- Update this file after meaningful runtime, deployment, integration, or folder-structure changes.
- Keep active tasks in `ProjectControl/CHECKLIST.md`.
- Keep historical deployment details in `ProjectControl/DocumentationArchive/NOTES.md`, but do not copy secrets into status/control docs.
- Use `Phase_Completion_Review_Pack/` for reusable phase-review templates and save completed dated reports in `Reports/`.
