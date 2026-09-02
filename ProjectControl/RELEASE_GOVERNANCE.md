# Release Governance

## Release Rule

Hosting, Functions, Scheduler, IAM, Secret Manager, Pub/Sub, and GAS deployment
changes require an explicit release candidate and owner approval for the exact
production action.

## Google Workspace Sharing Preservation

Form responder visibility, Form collaborators, Sheet General access, named
Drive roles, and link sharing are owner-managed integration configuration.
Lead Studio code, Functions, GAS, deployment, tests, migrations, and audits
must preserve the exact existing state and must not mutate permissions. OAuth
scopes are not approval. Any exception requires an exact file-specific owner
instruction, before/after state, dependency check, and restore plan. Read-only
permission inspection is allowed. The ecosystem canonical rule is
`MarketingStudioConsole/ProjectControl/GOOGLE_WORKSPACE_SHARING_GOVERNANCE.md`.

## Pre-Deployment Gate

1. Read `../PROJECT_STATUS.md`, this file, and `CHECKLIST.md`.
2. Reconcile source branch/commit with live Hosting and Function revisions.
3. Confirm GAS still has zero installed triggers before Firebase writer changes.
4. Confirm the Form-linked onboarding Sheet connection remains intact.
5. Run Functions tests, browser syntax checks, and `git diff --check`.
6. Verify Auth production client/policy bindings.
7. Record current Hosting and Function rollback revisions.
8. Update status/checklist and obtain explicit approval.
9. Deploy one environment at a time and run signed read/write/restore smoke.

## Environment Rules

- Production: permanent `timeless-lead-studio.web.app` URL and production Auth
  client.
- Lead Studio has no persistent staging or preview environment. Validate
  locally, prepare a reviewed production candidate, and deploy only with exact
  owner approval. Hosting and Function revision history provide rollback.
- GAS v60: inactive rollback source. Do not run its refresh helpers while
  Firebase writers are active.
- Secrets stay in Secret Manager or approved Script Properties and never in
  source, reports, command history examples, or browser config.

## V4 Feature Freeze

Lead Studio V4 is the production/live release. V4 changes are limited to
narrowly scoped production fixes that preserve accepted behavior. New features,
workflow changes, data-model changes, and material UX changes require a
separately opened V5 branch and scope. Application-owned production identifiers
use V4 consistently; historical Google API versions and immutable asset paths
remain unchanged.

## Rollback

- Clone the previous accepted Hosting version.
- Restore the previous Function/Cloud Run revision and runtime configuration.
- Disable Firebase writers before deliberately restoring a GAS writer; never
  operate both writer engines together.
- Verify Sheet hash/rows, scheduler state, Gmail cursor, and Jira behavior.
- Record the restored versions and verification result.

## Public Asset Release Gate

- Resolve Drive IDs or URLs through the Timeless Public Assets manifest.
- Store and expose only active central URLs that pass anonymous HTTP 200 image
  verification without redirects.
- Apply the Timeless Tech brand standard.
- Preserve Drive, Form, and Sheet sharing and never delete permanent assets.
