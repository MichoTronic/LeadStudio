# Lead Studio V5 Google API Efficiency Review

Date: 2026-09-02  
Decision: **GO / accepted in production as V5**  
Source commit: `1d8a7d0`

## Scope

Reduce unnecessary Google API work without changing Lead Studio's user-visible
features, data model, schedules, authorization, writer safety, reconciliation,
or V5 identity. This is an in-place V5 optimization, not a new release line.

## Changes

- A complete refresh now creates one delegated Gmail credential and shares it
  across the lead and onboarding scans. Expired-history recovery also shares
  the same credential across history, reconciliation, and watch renewal.
- Sheets, IAM Credentials, and Google client objects are reused within warm
  Function instances instead of being constructed again for each request.
- Gmail and Sheets requests use partial-response field selectors so Google
  returns only values the Studio consumes.
- Lead reconciliation still lists all candidate Gmail IDs, but it does not
  download and parse an immutable Gmail message again when that ID is already
  stored in `Email Matches`.
- Onboarding scanning remains complete because its messages are still needed to
  recompute sent counts, dates, and message tracking.
- Duplicate onboarding message IDs are collapsed before contact-activity
  metadata fetches.

The optimistic snapshot reread, idempotency lookup, post-write verification,
writer lock, audit appends, and the two-spreadsheet reads remain in place. They
protect correctness and cannot be removed merely to reduce request count.

## Why Functionality Is Preserved

Gmail message IDs identify immutable messages. Before this change, the refresh
plan already rejected accepted lead messages whose IDs existed in the Sheet;
their parsed bodies could not update an existing row. Skipping those redundant
body downloads therefore produces the same refresh plan. New IDs are still
downloaded, parsed, enriched through Jira/onboarding, and appended normally.
The scheduled reconciliation remains a fallback for dropped Gmail push events.

## Verification

- 100/100 automated tests passed.
- Coverage: 96.58% lines, 76.06% branches, 96.44% functions.
- Dependency audit: zero known vulnerabilities.
- Firebase dry-run discovered exactly six V5 Functions with unchanged names,
  service accounts, schedules, secrets, concurrency, and deadlines.
- Production deployment updated all six V5 Functions with zero errors.
- Desktop and 390 px production UI smoke passed without runtime errors, failed
  resources, or overflow.
- Gmail push IAM verification passed on revision
  `leadstudiogmailpushv5-00002-wow`.
- Production health check: HTTP 200 in 1.79 seconds.
- Production Gmail watch renewal: HTTP 200 in 1.32 seconds.
- Production scheduled refresh: HTTP 200 in 5.67 seconds, 56 changed rows,
  zero appended rows, and no replay.
- That live refresh found 10 candidate lead messages, skipped 7 known IDs, and
  downloaded 3. This was 70% fewer full lead-message downloads for that run.
- The same refresh used one delegated credential exchange instead of two, a
  50% reduction for that path.
- Final production inventory: exactly six active V5 Functions, three enabled
  V5 Scheduler jobs, and no warning/error after the acceptance window.

Current production revisions:

- `leadstudioactionv5-00002-cez`
- `leadstudiogmailpushv5-00002-wow`
- `leadstudiohealthcheckv5-00002-hex`
- `leadstudiomanualjirav5-00002-tid`
- `leadstudiorenewgmailwatchv5-00002-vor`
- `leadstudioscheduledrefreshv5-00002-juq`

## Reusable Cross-Studio Rules

1. Share a short-lived credential promise only within one bounded operation;
   do not persist provider tokens in storage or logs.
2. Reuse stateless client objects on warm serverless instances while allowing
   their auth libraries to refresh credentials normally.
3. Request only response fields the application reads.
4. Skip immutable provider resources only when the destination already stores
   a durable provider ID and existing logic cannot update from that resource.
5. Keep verification, idempotency, locking, and recovery calls even when they
   cost extra requests.
6. Record candidate/skipped/downloaded counts without identifiers or message
   content, then validate savings against the real runtime identity.

Official guidance supports partial responses to reduce transfer, parsing, CPU,
and memory, while Gmail list responses expose message IDs for follow-up fetches:

- https://developers.google.com/workspace/gmail/api/guides/performance
- https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
- https://developers.google.com/workspace/sheets/api/guides/performance

