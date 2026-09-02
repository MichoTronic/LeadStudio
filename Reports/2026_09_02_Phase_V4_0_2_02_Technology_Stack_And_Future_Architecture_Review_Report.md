# 02 - Technology Stack And Future Architecture Review

Date: 2026-09-02  
Release: Lead Studio V4.0.2  
Verdict: **GO**

## Current Stack

| Layer | Production choice | Review result |
| --- | --- | --- |
| UI | Static HTML/CSS/JavaScript on Firebase Hosting | Appropriate for the current interaction and deployment size |
| Identity | TimelessStudioAuth plus backend policy verification | Correct separation of central identity and destination authority |
| API/workers | Firebase Functions gen 2, Node.js 22 | Supported runtime and suitable isolation |
| Events | Gmail watch, Pub/Sub, Cloud Scheduler | Correct event-driven path with daily reconciliation fallback |
| Data | Existing Google Sheets and Form-linked onboarding Sheet | Preserves the operational contract |
| Integrations | Gmail delegation and Jira REST API | Bounded, server-side, and credential-minimized |
| Secrets | Google Secret Manager and keyless IAM signing | No active private-key file in the repository/runtime |

## Dependency Review

The lockfile now resolves Firebase Admin 14.3.0 and `qs` 6.16.0. The latter
removes the newly reported moderate denial-of-service advisory. The production
dependency audit reports zero vulnerabilities.

Two available upgrades are intentionally deferred:

- `@google-cloud/storage` 7.22.0 to 8.0.1.
- `googleapis` 153.0.0 to 178.0.0.

Both are major-version changes. Promoting them inside a live-only maintenance
release would widen risk without solving an active vulnerability. They require
a V5 compatibility review and focused Gmail/Storage integration acceptance.

## Architecture Direction

The present architecture does not need a framework rewrite or database migration.
The next justified changes are incremental:

1. Keep common timeout/concurrency/retry behavior in small shared backend utilities.
2. Preserve one-writer serialization and deterministic idempotency keys.
3. Upgrade Google client majors only with recorded API compatibility evidence.
4. Add UI state persistence or denser table presentation only after user feedback.
5. Preserve Sheets/Form ownership until a separately approved data migration has
   reconciliation, rollback, and operator-process coverage.

## Conclusion

The stack is current enough, security-supported, and proportional to Lead Studio's
needs. No technology replacement is required for continued V4 production use.

