# Lead Studio

Timeless Tech lead-management application for contact-form intake, onboarding
tracking, Gmail conversation activity, Jira lifecycle status, filtering, and
sales export.

## Live Service

- URL: `https://timeless-lead-studio.web.app`
- Firebase project: `timeless-lead-studio`
- Live Hosting version: `2ebf4cbe315f4974`
- Active branch: `phase/v4-firebase-sso`
- Production record commit: `7f72c56`
- Auth policy: `studioPolicies/lead-studio`

Firebase Node 22 Functions, Scheduler, Gmail push/watch, monitoring, and the
responsive Hosting UI are active. Google Apps Script v60 has zero triggers and
no versioned web deployment; its source and version history remain in
`AppsScript/` and Apps Script as rollback/reference material only.

## Start Here

| Need | Canonical file |
| --- | --- |
| Current runtime and deployment truth | `PROJECT_STATUS.md` |
| Architecture and ownership boundaries | `ProjectControl/SYSTEM_OVERVIEW.md` |
| Active and deferred tasks | `ProjectControl/CHECKLIST.md` |
| Release and rollback rules | `ProjectControl/RELEASE_GOVERNANCE.md` |
| Durable decisions | `ProjectControl/DECISION_LOG.md` |
| Documentation ownership | `ProjectControl/DOCUMENTATION_GOVERNANCE.md` |
| Auth policy contract | `ProjectControl/AUTHENTICATOR_RULES.md` |
| Dated evidence | `Reports/README.md` |
| Legacy GAS source | `AppsScript/` |

## Ownership Boundary

- The existing Google Sheets remain operational data sources.
- Firebase owns the live UI, protected actions, Gmail ingestion, scheduled
  refresh, Jira synchronization, writer serialization, and monitoring.
- `TimelessStudioAuth` owns identity and policy decisions; Lead Studio verifies
  authorization again before protected reads or writes.
- Marketing Studio Console only launches the app and administers policy. It
  contains no Lead business logic.
- The Google Form-linked onboarding sheet connection must not be replaced or
  broken by maintenance work.

## Verification

```powershell
npm test --prefix functions
node --check public/app.js
git diff --check
```

Use `PROJECT_STATUS.md` for the complete runtime inventory, current acceptance
evidence, and remaining post-live monitoring items.
