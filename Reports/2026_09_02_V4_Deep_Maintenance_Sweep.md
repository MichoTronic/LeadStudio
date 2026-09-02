# Lead Studio V4.0.1 Deep Maintenance Sweep

Date: 2026-09-02
Status: RELEASE CANDIDATE

## Scope

This production-only V4 maintenance pass reviewed the Firebase Functions,
browser application, automated tests, package health, current Cloud Function
inventory, Scheduler jobs, Hosting channels, and recent production error logs.
It does not add a new product feature, change the Google Sheet/Form contract,
alter a Jira record, change Workspace sharing, or reactivate Apps Script.

## Production Findings

- The accepted V4 deployment is healthy. All six Functions are active and
  serving their latest revisions, all three Scheduler jobs are enabled, and
  only the permanent `live` Hosting channel exists.
- The September 1 Gmail-push timeout incident is already resolved by the
  accepted timeout hotfix. No later natural recurrence was found.
- One transient Jira HTTP 404 caused the August 27 scheduled refresh to fail.
  The job had zero retries, so that day's refresh was missed; later daily runs
  succeeded without intervention.
- The production page still showed the historical `Preview` badge even though
  its runtime and Auth client were production-only.
- Contact-activity Gmail reads did not use the shared request deadline and
  could occupy an action instance until its 60-second Function deadline.
- Jira discovery for new contacts launched every request simultaneously. This
  was bounded by input size but not by provider concurrency.
- Both write paths searched only `Debug Log!A1:E5000` for idempotency records.
  Once the audit grows beyond 5,000 rows, recent completed operations could be
  missed and replay protection could perform a duplicate mutation.
- CSV cells beginning with spreadsheet formula characters were quoted but not
  neutralized. XLSX strings did not strip XML-disallowed control characters.
- Browser link validation allowed plaintext HTTP URLs.
- Hosting lacked baseline referrer, content-type sniffing, and unused-device
  permission headers.
- The action/manual Jira Functions retained platform-default concurrency of
  80 despite their external API load and single-writer design.
- The deployed Function environment still contains four obsolete acceptance
  gate variables removed from source. They are inert but should be removed
  after the source deployment so runtime configuration matches the V4 model.

## Maintenance Changes

- Apply a 15-second deadline to every Gmail contact-activity request using the
  shared sanitized timeout implementation.
- Deduplicate new-contact Jira lookups and cap discovery at four concurrent
  requests (hard maximum eight, maximum 500 validated contact emails).
- Give the daily scheduled refresh two bounded retries over a maximum 15-minute
  retry window.
- Set action concurrency to 10 and the manual Jira writer to one.
- Replace fixed oldest-first replay scans with a shared newest-first, bounded
  audit-tail reader (up to five 1,000-row pages).
- Neutralize formula-like CSV values, remove invalid XML controls from XLSX
  string cells, and accept only HTTPS browser links.
- Correct the production badge, add the dialog label relationship, add baseline
  Hosting security headers, and use one V4.0.1 browser asset revision.
- Add a root coverage command and remove an unused duplicate browser date
  parser.

## Verification

- Syntax and full automated suite: 90/90 passing.
- Coverage: 96.42% lines, 75.53% branches, 96.42% functions.
- Production dependency audit: zero vulnerabilities.
- Dependency freshness reviewed. `@google-cloud/storage` and `googleapis` have
  major-version updates available; these are intentionally deferred to V5.
  `firebase-admin` has a non-security minor update available and is also left
  unchanged to keep this production maintenance release narrow.
- Tracked credential/secret filename and source-pattern review found no
  committed credential artifact.
- Diff whitespace validation passed.

## Rollback Baseline

- Source: commit `1e5ee1e`; accepted documentation commit `64a2b30` / tag `V4`.
- Hosting: `d30e9c52d40b5b98`.
- Action: `leadstudioactionv4-00023-geb`.
- Gmail push: `leadstudiogmailpushv4-00005-jid`.
- Health check: `leadstudiohealthcheckv4-00004-nak`.
- Manual Jira: `leadstudiomanualjirav4-00012-xok`.
- Gmail-watch renewal: `leadstudiorenewgmailwatchv4-00004-buc`.
- Scheduled refresh: `leadstudioscheduledrefreshv4-00008-qad`.

## Production Promotion

Pending deployment and production smoke verification.
