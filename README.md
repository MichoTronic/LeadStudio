# Lead Studio

Timeless Tech lead-management application for contact-form intake, onboarding
tracking, Gmail conversation activity, Jira lifecycle status, filtering, and
sales export.

## Live Service

- URL: `https://timeless-lead-studio.web.app`
- Firebase project: `timeless-lead-studio`
- Live Hosting version: `21a11812cbf8c21f`
- Active release: Lead Studio V4
- Maintenance version: `4.0.2`
- Active release branch: `release/v4`
- Production source commit: `8920416`
- Production Auth client: `lead-studio-v4`
- Auth policy: `studioPolicies/lead-studio`

Firebase Node 22 Functions, Scheduler, Gmail push/watch, monitoring, and the
responsive Hosting UI are active. Google Apps Script v60 has zero triggers and
no versioned web deployment; its source and version history remain in
`AppsScript/` and Apps Script as rollback/reference material only.

Lead Studio has one production environment and no persistent staging or preview
  environment. V4.0.2 reliability, replay-integrity, export-safety, dependency
  security, and runtime
cleanup are accepted in production; new feature work starts from a separately
opened V5 branch.

The obsolete callable refresh and write-acceptance Functions, their browser
hooks, and the retired GAS UI link were removed on 2026-08-20. The six active
Functions are the action API, manual Jira writer, scheduled refresh, Gmail
push, Gmail-watch renewal, and health check.

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
npm run audit
node --check public/app.js
git diff --check
```

With the Firebase Hosting emulator running on port `5000`, run the repeatable
desktop/mobile browser shell check with `npm run smoke:browser`. Pass a live URL
as the final argument to verify a deployed release.

Use `PROJECT_STATUS.md` for the complete runtime inventory, current acceptance
evidence, and remaining post-live monitoring items.

## Brand And Public Assets

Lead Studio is a Timeless Tech product. Public images use
[Timeless Public Assets](https://github.com/MichoTronic/TimelessPublicAssets)
under the central [integration standard](https://github.com/MichoTronic/TimelessPublicAssets/blob/main/docs/STUDIO_ASSET_INTEGRATION_STANDARD.md)
and [Timeless Tech brand standard](https://github.com/MichoTronic/TimelessPublicAssets/blob/main/docs/TIMELESS_TECH_BRAND_STANDARD.md).
Direct Google Drive image delivery and Studio-local duplicate publishing are
not supported.
