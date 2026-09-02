# Maintenance Integration

Lead Studio owns lead ingestion, Gmail/Jira/Sheets workflows, business state,
runtime recovery and release decisions. Maintenance Studio owns the reusable
01-11 deep sweep, ecosystem hygiene and shared code/dependency/API assurance.

Keep Lead-specific contracts and runbooks here. Store dated Lead evidence in
`Reports/`; do not copy generic Maintenance templates back into this repository.
The former `Phase_Completion_Review_Pack/` is retained in Git history only.

## Shared `_Workspace` boundary

The shared non-product container is identified portably by Google Drive folder
ID `1nFuxKWVW-fJYDKq6PJpgDjPP6eE5epg9`. Use it only for registered secondary
Git worktrees under `WorkingCopies/` and documented non-authoritative recovery
material under `LegacySnapshots/`. It is never a production source, release,
asset library, credential store, ZIP dump, cache, or replacement for this
Studio's repository.
