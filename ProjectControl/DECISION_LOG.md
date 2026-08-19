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

## Pending Decisions

- When one naturally delivered trusted lead completes push acceptance and the
  broad reconciliation window can be narrowed.
- Whether unresolved Jira/onboarding conflicts need a dedicated operator queue.
- Final date to remove the deployed GAS UI after the post-live rollback window.
