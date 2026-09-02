# Lead Studio V5 Google Client Compatibility And Performance Review

Date: 2026-09-02  
Decision: **GO / accepted in production**

## Scope

Upgrade the deferred Google client-library majors without changing Lead Studio's
Sheet, Gmail, Jira, onboarding, UI, authorization, or writer-ownership contract.
Extract practices that can later be applied to other Studios.

## Dependency Decision

- Replaced `googleapis` 153 with `@googleapis/sheets` 14 and
  `@googleapis/iamcredentials` 11.
- Upgraded `@google-cloud/storage` from 7 to 8.0.1.
- Upgraded `firebase-admin`/`firebase-functions` within supported Node 22 lines.
- Retained direct `google-auth-library` 10.9.1. Auth 11 is not required by the
  chosen clients and would duplicate the auth major already used by the graph.
- Kept explicit 30-second provider limits, `retry: false`, least-privilege
  scopes, whole-event Pub/Sub retries, and idempotent serialized writes.

The official `googleapis` 178 release identifies Node 22 as its breaking
requirement; Lead was already on Node 22. Google's client README recommends
service-specific packages to reduce startup time. Storage 8 also requires Node
22. Sources:

- https://github.com/googleapis/google-api-nodejs-client/releases/tag/googleapis-v178.0.0
- https://github.com/googleapis/google-api-nodejs-client/blob/main/README.md
- https://www.npmjs.com/package/@google-cloud/storage

## Compatibility Evidence

- 97/97 tests passed.
- Coverage: 96.49% lines, 75.72% branches, 96.35% functions.
- New Google-client module: 100% line/function coverage.
- Dependency audit: zero vulnerabilities.
- Firebase source dry-run: exactly six V5 endpoints with unchanged service
  accounts, concurrency, secrets, schedules, gates, and deadlines.
- Local browser emulator and live desktop/mobile shell: pass with no runtime
  errors, failed resources, or overflow.
- Auth suite: 70 passed, three emulator-only skipped; all seven live client
  registrations verified after creating `lead-studio-v5`.

Local user ADC could read the Storage watch state and create/delete a unique
compatibility lock. Its Sheets and IAM probes returned 403 because the user ADC
does not possess the writer service account's Sheet/DWD authority. This was
treated as an identity-boundary result, not concealed as a pass. Production
Scheduler exercises closed both gaps under the actual runtime identity.

## Performance And Packaging

- Retired `googleapis` package unpacked size: 183,392,484 bytes.
- New complete installed Functions dependency tree: 70,987,955 bytes.
- Reduction versus the old umbrella package alone: at least 112 MB.
- Old umbrella warm isolated load: approximately 0.95-1.03 seconds; first
  Drive-backed cold sample: 20.70 seconds.
- New service-specific client module load: approximately 0.12 seconds.
- Firebase deployment source archive: 116.6 KB.

These measurements show a material startup/package improvement but are not a
promise that every Cloud Run cold start will improve by the same amount.

## Production Acceptance

- Hosting version: `51c69433f1156591`
- Hosting release: `1788366679323000`
- Functions: exactly six active V5 revisions; no V4 Function remains.
- Scheduler: exactly three enabled V5 jobs; no V4 job remains.
- Eventarc: exactly one V5 Gmail push trigger; no V4 trigger remains.
- Health check: HTTP 200, 1.48 seconds.
- Gmail watch renewal: HTTP 200, 1.33 seconds.
- Full refresh: HTTP 200, 2.52 seconds, 55 changed rows, zero appends, replayed.
- Security boundary: valid unsigned callable request returned 401.
- Final warnings/errors: only that deliberate 401; no runtime failure.
- Writer lock and `compatibility/` object counts after testing: zero.

## Cross-Studio Pattern

For each Studio: verify its Node runtime gate; prefer service-specific clients;
map exact API methods/scopes; keep a single auth major where possible; codify
timeouts and retry ownership; test real method surfaces; measure package/load
before and after; distinguish local ADC from runtime identity; deploy with a
rollback baseline; exercise read, delegated-auth, and writer paths; reconcile
Functions/Scheduler/Eventarc inventories; and close with clean logs and locks.

The reusable procedure and governance boundaries are recorded in
`../../MaintenanceStudio/Knowledge/GOOGLE_NODE_CLIENT_UPGRADE_PATTERN.md`.
