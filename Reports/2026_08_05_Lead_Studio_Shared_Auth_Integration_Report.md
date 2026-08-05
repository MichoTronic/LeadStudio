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
- `clasp deployments` confirmed the active deployment was `@58` before deployment.
- `clasp versions` confirmed latest version was `58` before deployment.
- `.js` files passed `node --check`.
- `appsscript.json` parsed successfully.
- `Script.html` parsed successfully with `node`/`vm.Script`.
- `git diff --check` passed.
- Accidental secret scan found no Firebase API key or private key material.
- Post-deploy `clasp deployments` confirmed the stable deployment is `@59`.
- The stable web app URL returned HTTP 200 from an unauthenticated shell and redirected to Google sign-in, which is expected outside a signed-in browser session.

## Deployment Status

Deployed on 2026-08-05 to the existing stable web app deployment ID:

```text
AKfycbwDqwHWHOsur0fWcpiIC4uQh-DZ1VZ7nyYxYB8fH4lyL5Jtblo9Ww3R8aBdVdBQbGSNvA @59 - v59 shared TimelessStudioAuth gate 2026-08-05
```

Live signed-in browser verification remains open for Mitja, Gaja, Vanesa, and one denied external account.
