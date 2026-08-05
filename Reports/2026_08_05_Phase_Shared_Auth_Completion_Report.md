# Lead Studio Shared Auth Phase Completion Report - 2026-08-05

## Decision

GO WITH CONDITIONS.

The shared `TimelessStudioAuth` integration is deployed and clean enough to use as the Lead Studio access baseline. Remaining conditions are live browser checks for Mitja, Gaja, Vanesa, and one denied external account.

## Review Scope

- Reviewed the new auth gate, hosted browser module integration, backend verifier calls, and scope mapping.
- Checked for stale documentation, dead paths, and contradictory deployment notes.
- Checked whether internal script jobs were accidentally routed through browser-only authorization.

## Findings Fixed

- Scheduled refresh and temporary import endpoint helpers were calling protected UI wrappers after the auth integration.
- Those internal paths now call `refreshEmailMatchesWithOptions_()` directly, so they still run as script-owner operations without a browser Firebase token.
- Sign-in and sign-out handlers now guard against an unavailable auth client and show a clear message instead of throwing a client-side error.
- Deployment documentation now records version `60`, not just the initial auth deployment at `59`.
- Checklist wording was corrected so the active deployment inventory no longer references old V2 deployment posture.

## Verification

- `.js` files passed `node --check`.
- `appsscript.json` parsed successfully.
- `Script.html` parsed successfully with `node`/`vm.Script`.
- `git diff --check` passed.
- Accidental secret scan found no Firebase API key or private key material.
- Apps Script source was pushed with `clasp push --force`.
- Stable deployment was promoted to:

```text
AKfycbwDqwHWHOsur0fWcpiIC4uQh-DZ1VZ7nyYxYB8fH4lyL5Jtblo9Ww3R8aBdVdBQbGSNvA @60 - v60 auth phase cleanup 2026-08-05
```

## Remaining Conditions

- Browser-test approved Mitja access.
- Browser-test approved Gaja and Vanesa access.
- Browser-test denied external account behavior.
- Keep broader V4 items in `ProjectControl/CHECKLIST.md`; do not expand this auth cleanup into unrelated refactors.
