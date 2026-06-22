# Timeless Tech Lead Studio

Google Apps Script web app for tracking marketing contact-form leads, onboarding submissions, and Jira lifecycle status.

## Start Here

| Need | Canonical file |
| --- | --- |
| Current status, deployment posture, and next work | `PROJECT_STATUS.md` |
| Active task/backlog checklist | `ProjectControl/CHECKLIST.md` |
| Completion review templates | `Phase_Completion_Review_Pack/README.md` |
| Dated review/audit/QA reports | `Reports/README.md` |
| External shortcuts/resources | `Resources/README.md` |
| Historical implementation notes and deployment ledger | `ProjectControl/DocumentationArchive/NOTES.md` |
| Live Apps Script source root | `AppsScript/` |
| Live Apps Script manifest | `AppsScript/appsscript.json` |
| Live app configuration | `AppsScript/Config.js` |
| Live backend entry points | `AppsScript/Code.js` |
| Lead storage and Jira/onboarding sheet updates | `AppsScript/Storage.js` |
| Gmail parsing and scan logic | `AppsScript/GmailScanner.js` |
| Onboarding sheet bridge | `AppsScript/OnboardingSheet.js` |
| Jira API bridge | `AppsScript/Jira.js` |
| UI shell, styles, and browser logic | `AppsScript/Index.html`, `AppsScript/Styles.html`, `AppsScript/Script.html` |
| Rollback snapshots | `Archive/Snapshots/` |

## Current Rules

- The live Apps Script project is `AppsScript/`; `.clasp.json` must keep `rootDir` set to `AppsScript`.
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

- Lead Studio reads the delegated marketing Gmail mailbox through a service-account OAuth flow.
- Lead records are stored in the `Lead Studio Database` Google Sheet.
- Gmail scans support fast recent refreshes and deeper historical scans.
- Lead parsing supports current `New Contact`, old `Contact Form (TLT-Webpage-*)`, and legacy `Form submission from:` email formats.
- Onboarding status comes from Gmail onboarding notices plus the onboarding request spreadsheet.
- Jira status is read through Script Properties: `JIRA_BASE_URL`, `JIRA_EMAIL`, and `JIRA_API_TOKEN`.
- Jira lifecycle buckets are mapped in `Config.js`.
- The app reads and updates lead status; it does not create Jira issues.
- Manual Jira issue linking is supported from the lead detail UI.
- Daily refresh trigger helpers exist in Apps Script, but the trigger requires one-time owner authorization before it is considered active.

## V2 Completion Review

V2 completion review was run on 2026-06-22 and saved under `Reports/` as `2026_06_22_Phase_V2_*`.

Current V2 decision: `GO WITH CONDITIONS`.

Open V2 conditions:

- Owner must authorize and install the daily Refresh Leads trigger once.
- Confirm `getDailyRefreshLeadsTriggerStatus()` reports exactly one active trigger.
- Verify the first scheduled run writes the expected Debug Log/status entries.
- Keep historical notes and rollback snapshots outside GitHub commits.

## Folder Layout

```text
.
|-- README.md
|-- PROJECT_STATUS.md
|-- .gitignore
|-- .clasp.json
|-- .claspignore
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
