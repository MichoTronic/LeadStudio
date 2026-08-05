# Lead Studio Shared Auth Integration Report - 2026-08-05

## Scope

Added source-level integration with the shared `TimelessStudioAuth` system so Lead Studio can be controlled from Marketing Studio Console policy `studioPolicies/lead-studio`.

## Changes

- Added `TRACKER_CONFIG.studioAuth` with hosted-popup and verifier URLs.
- Added a visible sign-in gate and top-bar sign-out button.
- Loaded the shared hosted browser module from Firebase Hosting.
- Added `getLeadStudioAuthRuntimeConfig()`.
- Added backend `assertAuthorizedUser_()` and verifier endpoint integration.
- Passed Firebase ID tokens through protected `google.script.run` calls.
- Mapped backend scopes:
  - `read` for bootstrap, lead reads, and operations status.
  - `write` for Gmail refreshes, Jira refreshes, and manual Jira link save.
  - `settings` for diagnostics and smoke tests.
- Added `ProjectControl/AUTHENTICATOR_RULES.md`.

## Verification

- `clasp status` confirmed `AppsScript/` is the active source root and only live source files are tracked.
- `clasp deployments` confirmed the active deployment is still `@58` before deployment.
- `clasp versions` confirmed latest version is `58` before deployment.
- `.js` files passed `node --check`.
- `appsscript.json` parsed successfully.
- `Script.html` parsed successfully with `node`/`vm.Script`.
- `git diff --check` passed.

## Deployment Status

Not deployed yet at the time this source report was created. The stable web app deployment still points to:

```text
@58 - Align lifecycle metrics with onboarded Jira rows
```

Deployment and live account verification should be recorded after the approved Apps Script push/promotion.
