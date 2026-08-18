# Timeless Tech Lead Studio

Lead management studio for tracking marketing contact-form leads, onboarding submissions, and Jira lifecycle status. Firebase V4 owns the operational runtime and preview; Google Apps Script version 60 is inactive rollback-only code pending final retirement.

## Start Here

| Need | Canonical file |
| --- | --- |
| Current status, deployment posture, and next work | `PROJECT_STATUS.md` |
| Active task/backlog checklist | `ProjectControl/CHECKLIST.md` |
| Completion review templates | `Phase_Completion_Review_Pack/README.md` |
| Dated review/audit/QA reports | `Reports/README.md` |
| External shortcuts/resources | `Resources/README.md` |
| Historical implementation notes and deployment ledger | `ProjectControl/DocumentationArchive/NOTES.md` |
| Legacy Apps Script rollback source | `AppsScript/` |
| Live Apps Script manifest | `AppsScript/appsscript.json` |
| Live app configuration | `AppsScript/Config.js` |
| Live backend entry points | `AppsScript/Code.js` |
| Lead storage and Jira/onboarding sheet updates | `AppsScript/Storage.js` |
| Gmail parsing and scan logic | `AppsScript/GmailScanner.js` |
| Onboarding sheet bridge | `AppsScript/OnboardingSheet.js` |
| Jira API bridge | `AppsScript/Jira.js` |
| UI shell, styles, and browser logic | `AppsScript/Index.html`, `AppsScript/Styles.html`, `AppsScript/Script.html` |
| Rollback snapshots | `Archive/Snapshots/` |

Folder identity:

- Local folder: `D:\GoogleDrive\_Share\TimelessTech\Marketing\Optmizations\LeadStudio`
- Parent Optimization Google Drive folder ID: `1keVmyWTXwqQM0cK5AWQzFPIKM7K7hyt1`

## Current Rules

- `AppsScript/` is the source-controlled legacy rollback snapshot; `.clasp.json` must keep `rootDir` set to `AppsScript`, but do not push or redeploy it during normal Firebase operation.
- Root should stay navigation/control-only: README, status, clasp config, and top-level project folders.
- `ProjectControl/DocumentationArchive/NOTES.md` is historical and sensitive. Do not paste it into tickets, chats, public repos, or screenshots without redacting secrets.
- `ProjectControl/DocumentationArchive/NOTES.md`, `Archive/`, local zip snapshots, and Google Drive shortcut files must stay out of git commits.
- Active tasks should live in `ProjectControl/CHECKLIST.md`, not inside the historical notes ledger.
- `PROJECT_STATUS.md` is the current project-status source of truth.
- Reusable completion-review templates live in `Phase_Completion_Review_Pack/`.
- Completed dated review/audit/QA reports live in `Reports/`; each stable phase should have a run report plus ordered review reports.
- External shortcuts and non-source references live in `Resources/`.
- Checkpoint folders and zip archives belong under `Archive/Snapshots/`.
- `.claspignore` must keep archives, reports, resources, and historical notes out of Apps Script pushes.
- `.gitignore` must keep sensitive notes, snapshots, local shortcuts, and local noise out of GitHub.
- Meaningful code/config/workflow changes should update `PROJECT_STATUS.md` and/or `ProjectControl/CHECKLIST.md` in the same work session.

## Current Technical Boundary

- Firebase V4 owns automatic Gmail/onboarding/Jira work through keyless domain-wide delegation and Secret Manager. GAS v60 has zero installed triggers and is retained only as source-controlled rollback until final promotion; do not run its manual refresh while Firebase writers are active.
- Lead records are stored in the `Lead Studio Database` Google Sheet.
- Gmail scans support fast recent refreshes and deeper historical scans.
- Lead parsing supports current `New Contact`, old `Contact Form (TLT-Webpage-*)`, and legacy `Form submission from:` email formats.
- Onboarding status comes from Gmail onboarding notices plus the onboarding request spreadsheet.
- Firebase stores the rotated Jira token in Secret Manager and owns scheduled status synchronization. It reads the Form-linked onboarding Sheet without modifying its Google Form response connection.
- Function revision `leadstudioactionv4-00016-dux` and disabled callable writer `leadstudiorefreshv4-00006-kab` share one canonical, PII-minimized refresh planner. The action Function also provides authorized, bounded, read-only Gmail contact activity without exposing provider IDs or tokens. The 69-row write/verify/restore/replay acceptance passed exactly. Scheduled writer `leadstudioscheduledrefreshv4-00003-sup` then persisted the same plan and verified its final 302-row snapshot hash.
- Firebase write acceptance is isolated in `leadStudioWriteAcceptanceV4`, requires central settings authorization, uses optimistic row versions and idempotency keys, and audits only metadata to `Debug Log`. Its dedicated writer service account has Sheet Editor access; the normal runtime remains Viewer. The endpoint is deployed disabled at revision `leadstudiowriteacceptancev4-00005-bey` after a successful write/verify/restore/replay test.
- All Firebase mutation paths share an atomic generation-checked lock in the private `timeless-lead-studio-writer-locks` bucket. The lock has bounded waiting, exact-generation release, and stale-lock recovery so manual commands cannot overlap the scheduled whole-Sheet refresh.
- Gmail `users.watch` now publishes to `lead-studio-gmail-changes`; only `gmail-api-push@system.gserviceaccount.com` has topic publisher access. `leadStudioGmailPushV4` consumes added-message history under the shared lock, persists its cursor privately in the lock bucket, and uses history-range plus Gmail-message-ID idempotency. `leadStudioRenewGmailWatchV4` renews daily at 03:00 Europe/Ljubljana. Both gates are enabled.
- `leadStudioHealthCheckV4` runs every six hours, validates scheduler freshness and Gmail watch/push health, and feeds the enabled `Lead Studio runtime failures` Cloud Monitoring policy. Error notifications go to `mitja@timelesstech.io`. The settings-authorized `operationsStatus` action reads at most five bounded Debug Log pages and returns metadata only.
- The Firebase preview exports its currently filtered contacts as CSV or XLSX with the legacy 14-column contract preserved first, followed by Lead Status, Inquiry, Onboarding Sent At, Onboarding Submitted At, and Last Contacted / Last Activity At. The activity value uses an exact activity timestamp when available and otherwise the latest known Email Date/onboarding event; it never substitutes the system-only Last Checked value. The UI includes All leads and lifecycle metric filters, Business type / Target region / Interested in facets, preset and custom From/To dates, Date and Company sorting, Inquiry details, and row-wide desktop detail opening. Historical Interested in text is display-normalized to Game Aggregator, Bonus Engine, White Label, BetExchange, or Other; unrelated values display as `-` without rewriting the Sheet. `leadStudioManualJiraV4` revision `leadstudiomanualjirav4-00009-rof` accepts either an issue key, the API tenant browse URL, or the canonical `https://jira.at.semper7.net/browse/KEY` URL. API validation remains on the Atlassian tenant and stored/browser links use the canonical custom host. The editor remains enabled in the preview, its acceptance gate remains disabled, and GAS v60 remains the manual rollback UI.
- Jira lifecycle buckets are mapped in `Config.js`.
- The app reads and updates lead status; it does not create Jira issues.
- Manual Jira issue linking is supported from the lead detail UI.
- Apps Script daily-trigger helpers remain for rollback, but the Apps Script project has zero installed triggers. Firebase Scheduler runs `leadStudioScheduledRefreshV4` daily at 06:00 Europe/Ljubljana with no retries and one concurrent instance.
- Lead Studio uses shared `TimelessStudioAuth` integration so Marketing Studio Console policy `studioPolicies/lead-studio` controls access.

## Gmail Ingestion Runtime

The event-driven path is deployed and enabled:

1. Gmail API `users.watch` publishes mailbox-change notifications to a dedicated Cloud Pub/Sub topic.
2. A Firebase Function reads only changes after the last committed Gmail `historyId` with `users.history.list`, fetches the added messages, and reuses the existing trusted-message parsers.
3. New contacts are appended through the existing writer lock, snapshot verification, Gmail-message-ID idempotency, and metadata-only audit controls.
4. A daily job renews the Gmail watch before its seven-day expiry. The 06:00 reconciliation remains as a safety net for delayed/dropped notifications and continues Jira/onboarding synchronization; it should no longer perform a broad three-month inbox scan after push acceptance.
5. An expired history checkpoint or Gmail `404` triggers the bounded full reconciliation path before a new checkpoint is committed.
6. The current-cursor Pub/Sub delivery/replay acceptance passed with zero Sheet changes. The broad daily scan remains intentionally active until one naturally arriving trusted form lead is appended through push; only then may `LEAD_STUDIO_GMAIL_NARROW_RECONCILIATION_ENABLED` be set to `true` for the 14-day fallback.

Gmail notifications do not contain message bodies or contact data; they contain the mailbox and a new history position. Pub/Sub is therefore the event signal, while the Gmail API remains the source for the exact added messages.

## V2 Completion Review

V2 completion review was run on 2026-06-22 and saved under `Reports/` as `2026_06_22_Phase_V2_*`.

Current V2 decision: `GO WITH CONDITIONS`.

The original V2 GAS-trigger conditions are superseded by the V4 cutover. Apps Script must remain at zero triggers while the Firebase Scheduler is enabled. Historical notes and rollback snapshots remain outside GitHub commits.

## Current Stable Baseline

Current operational baseline: Firebase V4 owns the daily refresh; GAS `V3` version 60 remains the stable UI and manual rollback deployment while Hosting promotion is pending.

- Apps Script stable deployment: version `60`
- Git rollback tag: `v3-stable`
- Local stable snapshot: `Archive/Snapshots/Lead Studio V3 Stable.zip`
- V3 completion review reports: `Reports/2026_06_22_Phase_V3_*`
- V3 decision: `GO WITH CONDITIONS`

The current Firebase preview is `https://timeless-lead-studio--v4-firebase-pilot-l3jpap21.web.app`; it reads the existing lead and Form-linked onboarding Sheets after central Auth, restores the useful GAS list/filter/sort workflow in the full dark navy Marketing Studio Console visual system, supports filtered exports, and shows on-demand Gmail activity in a responsive contact dialog. Its manual Jira editor remains enabled in the preview; all acceptance and callable refresh gates remain disabled. The dedicated 06:00 Scheduler remains the only automatic writer; its first natural run passed on 2026-08-18. GAS v60 has no trigger and must be treated as rollback-only for refreshes.

V3 hotfix on 2026-07-20: version `57` uses `noreply@timelesstech.io` as the current `New Contact` notice sender; run `Settings > Refresh Leads` to verify/backfill post-2026-06-21 form notices.

V3 hotfix on 2026-07-20: version `58` aligns lifecycle metrics so onboarded rows with Jira keys but missing Jira status are counted under New Lead.

Shared auth deployment on 2026-08-05: version `59` adds the hosted TimelessStudioAuth sign-in gate, top-bar sign-out, and backend verifier checks for `studioPolicies/lead-studio`.

Shared auth cleanup on 2026-08-05: version `60` keeps browser calls protected while preserving scheduled refresh and temporary internal endpoint behavior.

## V4 Backlog Themes

- Observe one naturally arriving trusted form lead through Pub/Sub, verify its Sheet/audit result, then enable the 14-day reconciliation fallback.
- Surface the already-available settings-authorized Operations metadata in a future admin view only if operators need it; monitoring and email alerting are already active.
- Add Gmail scan controls only if candidate volume grows beyond current bounds.
- Add sheet-write smoke tests.
- Deep Refresh Jira Matches remains a later controlled diagnostic slice.
- Split large client utilities from `Script.html` only after more test coverage exists.

## Folder Layout

```text
.
|-- README.md
|-- PROJECT_STATUS.md
|-- .gitignore
|-- .clasp.json
|-- .claspignore
|-- firebase.json
|-- .firebaserc
|-- functions/
|   |-- index.js
|   |-- src/
|   `-- tests/
|-- public/
|   |-- index.html
|   |-- styles.css
|   |-- config.js
|   `-- app.js
|-- AppsScript/
|   |-- appsscript.json
|   |-- Code.js
|   |-- Config.js
|   |-- GmailScanner.js
|   |-- GoogleAuth.js
|   |-- Jira.js
|   |-- OnboardingSheet.js
|   |-- Storage.js
|   |-- Setup.js
|   |-- Index.html
|   |-- Styles.html
|   `-- Script.html
|-- ProjectControl/
|   |-- CHECKLIST.md
|   `-- DocumentationArchive/
|-- Phase_Completion_Review_Pack/
|-- Reports/
|-- Resources/
|-- Archive/
|   `-- Snapshots/
`-- desktop.ini
```

## Verification Habit

For safe Apps Script changes, start with:

```text
clasp status
```

Before deploying, also run the in-app diagnostics:

```text
Settings > Test Marketing Mailbox Access
Settings > Check Jira Connection
Settings > Deep Refresh Jira Matches
```

Use `PROJECT_STATUS.md` for the latest exact verification set.

For V2 scheduled refresh readiness:

```text
getDailyRefreshLeadsTriggerStatus()
installDailyRefreshLeadsTrigger()
```

The install step may require owner authorization in Apps Script before it can run unattended.
