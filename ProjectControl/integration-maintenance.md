# Maintenance Integration

Lead Studio owns lead ingestion, Gmail/Jira/Sheets workflows, business state,
runtime recovery and release decisions. Maintenance Studio owns the reusable
01-11 deep sweep, ecosystem hygiene and shared code/dependency/API assurance.

Keep Lead-specific contracts and runbooks here. Store dated Lead evidence in
`Reports/`; do not copy generic Maintenance templates back into this repository.
The former `Phase_Completion_Review_Pack/` is retained in Git history only.

The integration is documentation-only: no Maintenance agent, scheduler,
service account, webhook, repository token, production write or dependency
upgrade is enabled. Future automation must use a Lead-owned branch, pass Lead's
release gates and receive the same authority required without Maintenance.

Permitted future evidence is metadata-only: repository/version state,
dependency summaries, tests/coverage, deployment inventory, alert health and
dated reviews. Contact data, message bodies, tokens, secrets and unrestricted
logs remain excluded.

## Shared workspace reference

The canonical `_Workspace` identity and use rules are owned by
`../../MaintenanceStudio/registry/ecosystem-roots.json` and
`../../MaintenanceStudio/ProjectControl/governance-workspace-and-repository-structure.md`.
This Studio does not redefine them; it treats `_Workspace` only as shared
non-product infrastructure.
