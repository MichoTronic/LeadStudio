# Lead Studio Authenticator Rules

## Shared Auth Project

Lead Studio uses the shared Timeless Studio Auth Firebase project:

```text
timeless-studio-auth
```

## Studio Policy

Firestore policy:

```text
studioPolicies/lead-studio
```

Marketing Studio Console should manage this policy. The expected initial access shape is:

- `mitja@timelesstech.io`: admin
- `vanesa@timelesstech.io`: editor
- `gaja@timelesstech.io`: editor

## Runtime Endpoints

Hosted browser module:

```text
https://timeless-studio-auth.web.app/studio-auth-client.js
```

Hosted auth popup:

```text
https://timeless-studio-auth.web.app/auth-popup.html
```

Verifier endpoint:

```text
https://europe-west1-timeless-studio-auth.cloudfunctions.net/verifyStudioAccess
```

## Apps Script Deployment Pattern

The web app remains reachable:

```text
ANYONE / USER_DEPLOYING
```

The page loads first, then the shared Firebase Google sign-in decides whether the user can enter the dashboard. Every private backend call must still verify the token server-side before returning lead data or changing the Sheet/Jira-derived state.

## Scope Mapping

- `read`: app bootstrap, saved lead reads, and operations status.
- `write`: Gmail refresh, deep Gmail scan, Jira refresh batches, and manual Jira link save.
- `settings`: Gmail/Jira/service-account diagnostics and smoke tests.

In the current shared role model, `viewer` can read, `editor` can read/write, and `admin` can also use settings diagnostics.

## Firebase Config Source

Lead Studio uses hosted-popup mode, so no Firebase web API key needs to be committed or stored in Apps Script Script Properties for the current implementation.

Do not pass Firebase ID tokens through URLs. Tokens stay in memory and are passed only through `google.script.run` payloads.
