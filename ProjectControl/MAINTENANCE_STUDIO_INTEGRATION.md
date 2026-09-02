# Maintenance Studio Integration

Lead Studio is the first reference consumer for the planned centralized
Maintenance Studio at `../../MaintenanceStudio/`.

The integration is currently documentation-only. No agent, scheduler, service
account, webhook, repository token, production write, or automatic dependency
upgrade is enabled.

Lead Studio may later expose metadata-only evidence described by the shared
integration contract: repository/version state, dependency audit summaries,
test and coverage results, deployment inventory, alert health, and dated 01-05
review outcomes. Contact data, message bodies, tokens, secrets, and unrestricted
logs are excluded.

Any future automated change must use a Studio-owned branch, pass the Studio's
release gates, preserve rollback, and receive the same explicit authority that
would be required without Maintenance Studio.
