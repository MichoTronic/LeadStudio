# Lead Studio V4 Gmail Push Timeout Hotfix

Date: 2026-09-02
Status: ACCEPTED PRODUCTION

## Incident

On 2026-09-01, two Pub/Sub deliveries to `leadStudioGmailPushV4` returned HTTP
504 after exactly 360 seconds. While the single configured Cloud Run instance
was occupied, subsequent deliveries returned HTTP 429 and were retried.

The two timed-out executions did not crash. Both later logged successful
completion at approximately 15:10 UTC, more than six minutes after their HTTP
request deadlines. They processed only one or two candidate messages, accepted
no lead or onboarding message, and changed/appended zero Sheet rows. Later
deliveries returned HTTP 204 normally, including successful runs on
2026-09-02.

## Root Cause

The Gmail, IAM Credentials, and Google Sheets clients had no explicit request
deadline. A transient provider request could therefore outlive the Function's
360-second Cloud Run request deadline. The distributed writer lock expired
after five minutes, shorter than the Function deadline, so a second retry could
acquire a new generation while the original execution was still alive.

This was a timeout/serialization defect, not a malformed lead, parser failure,
authorization failure, or confirmed data-loss event.

## Fix

- Bound Gmail/OAuth fetches to 30 seconds with a sanitized
  `deadline-exceeded` failure.
- Configure IAM Credentials and Sheets requests with a 30-second timeout and no
  implicit client retry; Pub/Sub remains responsible for retrying the complete
  idempotent operation.
- Extend the shared writer-lock lease to 15 minutes, longer than every Lead
  Function request deadline.
- Add metadata-only stage timing for push start, Gmail history load, Sheet
  snapshot load, completion, and failure.
- Keep the Gmail push at one instance and one request of concurrency.

## V4 Naming And Environment Alignment

Lead Studio's active application version is V4. Production identifiers remain:

- `leadStudioActionV4` and the five other V4 Function names;
- Auth client `lead-studio-v4`;
- package version `4.0.0`.

Lead Studio has one production environment and no persistent staging or
preview environment. The retired preview Auth client/source fixture, browser
selection branch, and preview Function origin are removed from current source.
Historical reports keep their exact V2/V3/V4 evidence.

## Pre-Release Evidence And Rollback

- Local suite: 83/83 passing after the hotfix.
- Browser/source syntax: passing.
- Auth production registry: all six clients pass, including `lead-studio-v4`.
- Only Firebase Hosting channel `live` exists.
- Current Hosting rollback version: `298d0a3af1bf3263`.
- Function rollback revisions:
  - action: `leadstudioactionv4-00022-qoj`;
  - Gmail push: `leadstudiogmailpushv4-00004-tew`;
  - health check: `leadstudiohealthcheckv4-00003-xut`;
  - manual Jira: `leadstudiomanualjirav4-00011-xon`;
  - Gmail-watch renewal: `leadstudiorenewgmailwatchv4-00003-won`;
  - scheduled refresh: `leadstudioscheduledrefreshv4-00007-lew`.

No Google Sheet, Form connection, Jira record, Workspace sharing, IAM, secret,
Pub/Sub topic, Scheduler gate, or GAS trigger was changed during diagnosis and
candidate preparation.

## Production Promotion And Acceptance

Owner approval for the production-only rollout was given in-session on
2026-09-02. Source commit `1e5ee1e` was deployed to all six V4 Functions and
Firebase Hosting with zero Function deployment errors.

- Hosting version: `d30e9c52d40b5b98`; live release
  `1788344092595000`.
- Action: `leadstudioactionv4-00023-geb`.
- Gmail push: `leadstudiogmailpushv4-00005-jid`.
- Health check: `leadstudiohealthcheckv4-00004-nak`.
- Manual Jira: `leadstudiomanualjirav4-00012-xok`.
- Gmail-watch renewal: `leadstudiorenewgmailwatchv4-00004-buc`.
- Scheduled refresh: `leadstudioscheduledrefreshv4-00008-qad`.
- Every Function serves 100% of traffic from the listed revision.

Production verification passed:

- Hosting returned HTTP 200 with the required cache policy and contained only
  Auth client `lead-studio-v4`.
- An unsigned action request returned the expected HTTP 401 before protected
  data access.
- The scheduled health check returned HTTP 200 in 4.65 seconds and logged a
  passing runtime status.
- A manual invocation of the existing Gmail-watch renewal job returned HTTP
  200 in 4.05 seconds and renewed the watch successfully.
- A controlled Pub/Sub notification exercised the new Gmail-push revision. It
  returned HTTP 204 in 6.86 seconds, loaded one Gmail history page and the
  309-row Sheet snapshot, found zero candidates, and completed in 6.82 seconds
  with zero changed or appended rows.
- The local suite passed 83/83 and the production dependency audit found zero
  vulnerabilities.

The watch renewal updated the normal private Gmail watch state as designed;
the controlled push updated its success timestamps/cursor without changing any
lead row. Firebase deployment refreshed the existing Scheduler job definitions
without changing their schedules or enabled gates. Firebase CLI also enabled
the Cloud Billing API during its standard billing-linked deployment preflight;
no billing account or budget setting changed.
