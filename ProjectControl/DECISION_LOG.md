# Decision Log

## Active Decisions

| Date | Decision | Reason / consequence |
| --- | --- | --- |
| 2026-06-22 | Keep Google Sheets as the operational lead/onboarding source of truth. | Preserves existing workflows and the Google Form response connection. |
| 2026-08-05 | Use `TimelessStudioAuth` policy `lead-studio`. | Centralizes identity/policy while Lead Functions keep destination authority. |
| 2026-08-17 | Move the active Lead runtime to an isolated Firebase project. | Lead owns its Functions, IAM, secrets, Hosting, deployment, and rollback. |
| 2026-08-17 | Use keyless Gmail domain-wide delegation and Secret Manager for Jira. | Removes long-lived service-account keys and source-visible credentials. |
| 2026-08-17 | Make Firebase Scheduler the only automatic writer. | Prevents overlapping GAS/Firebase mutations. GAS v60 must remain trigger-free. |
| 2026-08-18 | Use Gmail watch/Pub/Sub for new-message signals with scheduled reconciliation as fallback. | Reduces broad inbox scanning while retaining recovery from dropped/expired history. |
| 2026-08-18 | Keep Console as launcher/auth front door only. | Lead business behavior remains in the Lead repository/project. |
| 2026-08-18 | Retain GAS source after runtime retirement. | Preserves rollback/reference without a second active engine. |
| 2026-08-20 | Preserve owner-configured Google Workspace sharing and prohibit automatic permission mutation. | Lead Forms/Sheets and outside-support access are external integration contracts; scopes and release approval do not authorize changing General access or named roles. |
| 2026-08-20 | Retire acceptance-only Firebase Functions and the dead GAS launcher after their rollback window. | Production keeps only six operational Functions; test history and GAS source remain in Git without a second live UI or writer. |
| 2026-09-02 | Treat Lead Studio V4 as the production/live release with no persistent staging environment (superseded by the V5 promotion later that day). | Use V4 consistently for application-owned Functions, Auth client, and package metadata. Remove retired preview selection/configuration from current source; keep historical evidence unchanged. New feature work requires V5. |
| 2026-09-02 | Bound provider requests and keep the writer-lock lease longer than every Function deadline. | A transient Google API stall outlived two 360-second Gmail-push requests, while the five-minute lock could expire underneath a live execution. Use 30-second provider request bounds, no implicit Google-client write retries, a 15-minute lock lease, and whole-event Pub/Sub retry/idempotency. |
| 2026-09-02 | Treat compatible hardening as V4 patch maintenance and defer dependency majors/features to V5. | V4.0.1 may correct bounded reliability, replay integrity, export safety, production labels, and runtime hygiene without changing the Sheet/Form/Jira product contract. |
| 2026-09-02 | Accept V4.0.2 after the ordered 01-05 completion review and keep major Google client upgrades in V5. | Bounded settings diagnostics, shared concurrency control, patched transitive dependencies, browser hardening, 93 tests, and live health/refresh evidence close the maintenance review without widening the product contract. |
| 2026-09-02 | Promote the Google client modernization as Lead Studio V5. | Replace the 183 MB umbrella `googleapis` package with service-specific Sheets/IAM Credentials clients, upgrade Storage, and validate the unchanged product contract under real production identities. |
| 2026-09-02 | Keep direct `google-auth-library` on 10.9.1 during V5. | Google/Firebase dependencies already share auth major 10; adding auth 11 would load a second auth engine and its request-contract breaking change without providing a Lead feature or security benefit. Revisit only as a coordinated graph migration. |
| 2026-09-02 | Use Maintenance Studio as a future advisory governance layer, not an autonomous production operator. | Studios retain deployment and data authority. Central checks may inventory, report, and prepare reviewed changes, but cannot mutate credentials, permissions, data, schedules, or production without explicit Studio-scoped authorization. |
| 2026-09-02 | Verify Eventarc-to-Cloud-Run invoke IAM after every event-Function rename or creation. | V5 creation produced a healthy Function and trigger but no service-level invoker binding. Grant only the trigger service account on the exact service, verify queued delivery, and keep a read-only release check; a successful deploy alone is insufficient. |

## Pending Decisions

- Whether unresolved Jira/onboarding conflicts need a dedicated operator queue.
