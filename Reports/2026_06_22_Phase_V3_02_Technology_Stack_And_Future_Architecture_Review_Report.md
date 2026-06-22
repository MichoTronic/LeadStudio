# 02 Technology Stack And Future Architecture Review Report - 2026-06-22

Scope: Lead Studio V3 technology stack, integration boundaries, and future scaling path.

## Current Stack Strengths

- Google Apps Script remains a good fit for the current workflow: Gmail, Sheets, Drive, Apps Script deployment, and simple scheduled refresh all live naturally in the Google ecosystem.
- Native time-driven triggers are enough for the current daily Refresh Leads need.
- The Google Sheet remains a useful operational store and human-readable audit surface.
- The app now has basic smoke tests and an Operations panel, which makes Apps Script less opaque than it was in V2.
- GitHub and `clasp` are now aligned, with rollback tags for V2 and V3.

## Future Constraints

- Apps Script execution limits remain the main future scaling constraint for deep Gmail scans and Jira refreshes.
- Gmail refresh currently fetches full message payloads for candidate messages; if candidate volume grows, refresh time will grow with it.
- The UI is still Apps Script HTML and one large browser script. This is acceptable for V3, but complex interaction growth will eventually favor smaller modules or a separate frontend.
- Secrets in Script Properties are acceptable for the current project, but historical credentials in notes should still be rotated/reviewed.
- There is no CI runner. Smoke tests can be run manually from Settings/Apps Script, but not yet automatically on every commit.

## Architecture Options

Near-term:

- Keep Apps Script + Google Sheet.
- Add small, targeted performance improvements before considering migration.
- Add more smoke tests around sheet writes and debug-log reads.
- Split client code only where it lowers risk, starting with export/date/filter utilities.

Mid-term:

- Add a lightweight build/test step locally or in GitHub Actions for pure JavaScript checks.
- Move expensive refresh/indexing work to a scheduled Cloud Run/Cloud Functions job only if Apps Script limits become real.

Long-term:

- Consider separate frontend only if UI workflows become dense enough that Apps Script HTML becomes a drag on maintainability.
- Consider an indexed backing table/cache if the Contacts table grows into thousands of rows and client-side filtering becomes visibly slow.

## Approval-Required Decisions

- Confirm whether current web app access settings are acceptable for the intended team.
- Confirm whether setup/test URL endpoints should be removed entirely later or kept disabled by default for emergency maintenance.
- Confirm acceptable refresh volume before optimizing Gmail scanning more aggressively.

## Final Assessment

Decision: **CONTINUE CURRENT STACK WITH CONDITIONS**.

Summary:

- Apps Script is still the right stack for V3.
- The next work should be optimization inside the current architecture, not migration.

