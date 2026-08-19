# Documentation Governance

## Canonical Documents

| File | Purpose |
| --- | --- |
| `README.md` | Short project front door |
| `PROJECT_STATUS.md` | Current operational truth |
| `ProjectControl/SYSTEM_OVERVIEW.md` | Stable architecture and ownership |
| `ProjectControl/CHECKLIST.md` | Active/deferred/completed work once only |
| `ProjectControl/DECISION_LOG.md` | Durable decisions and supersessions |
| `ProjectControl/RELEASE_GOVERNANCE.md` | Environment, promotion, and rollback rules |
| `Reports/README.md` | Dated evidence index |

## Rules

- Update current status when deployment, scheduler, trigger, IAM, secret,
  ingestion, or data-source reality changes.
- Keep implementation chronology in dated reports or the existing documentation
  archive, not in README.
- Preserve historical reports; add a supersession note when they are actively
  linked and their stated runtime is no longer current.
- Keep the active task once in `CHECKLIST.md`.
- Never document Jira tokens, OAuth tokens, raw contact data, message bodies,
  service-account keys, or private exports.
- Run `git diff --check` after documentation changes.
