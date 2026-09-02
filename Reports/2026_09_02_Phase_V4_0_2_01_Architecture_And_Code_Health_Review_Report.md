# 01 - Architecture And Code Health Review

Date: 2026-09-02  
Release: Lead Studio V4.0.2  
Production source: `29e7ec1`  
Verdict: **GO**

## Scope

This review applied the supplied Content Studio report structure as a checklist,
not as implementation instructions. The inspected system is Lead Studio's active
Firebase Hosting and Node 22 Functions runtime, plus the retained inactive Apps
Script rollback source.

## Findings And Repairs

1. Settings-only Jira discovery and direct lookup could issue as many as twelve
   provider calls sequentially inside a 60-second callable. Each request could
   independently consume its timeout, so the diagnostic path had a real deadline
   risk even though the normal lead bootstrap remained bounded.
2. Four backend modules carried local variants of the same bounded asynchronous
   mapping helper. This duplication made concurrency behavior harder to audit and
   easier to change inconsistently.
3. Reusable completion-review templates still described Apps Script as the live
   engine and therefore no longer matched operational ownership.
4. Local deployment scope contained avoidable generated artifacts and lacked a
   repeatable browser-shell smoke runner.

The Jira diagnostics now run with a limit of four concurrent requests and retain
deterministic result order. `functions/src/asyncUtils.js` is the single helper used
by Lead diagnostics, Jira, Gmail contact activity, and Workspace delegation.
Regression tests cover concurrency bounds, ordering, empty input, and invalid
limits. Deployment ignore rules and review templates now match the six-function
Firebase production architecture; Apps Script remains explicitly rollback-only.

## Ownership And Structure

- Firebase Hosting owns the production browser UI.
- Six Node 22 Functions own reads, controlled writes, Gmail ingestion/watch,
  scheduled reconciliation, and health monitoring.
- TimelessStudioAuth owns identity and policy; Lead Functions enforce destination
  authorization again.
- Google Sheets and the Form-linked onboarding sheet remain operational sources.
- Firebase Scheduler is the only automatic writer. GAS v60 remains trigger-free
  and has no versioned web deployment.

No circular dependency, second active writer, duplicate live UI, or release-
blocking dead path was found. Source boundaries remain appropriate for V4.

## Evidence

- `npm run check`: 93/93 passing.
- Coverage: 96.43% lines, 75.69% branches, 96.32% functions.
- Shared async utility: 100% lines/branches/functions.
- `git diff --check`: clean.
- `clasp status`: 13 intended tracked files, zero untracked files.
- Production deployment: six successful Function updates, zero errors.

## Residual Work

Major dependency migrations and new product behavior belong in a separately
reviewed V5 release. They are not code-health blockers for V4.0.2.

