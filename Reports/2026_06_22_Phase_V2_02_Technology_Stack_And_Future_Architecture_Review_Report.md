# 02 Technology Stack And Future Architecture Review Report - 2026-06-22

Scope: Lead Studio V2 technology stack and future architecture path.

## Current Stack Strengths

- Google Apps Script is still a reasonable fit for Lead Studio's current scale and workflow.
- The app is tightly integrated with Google Sheets, Gmail API, Drive, and Apps Script deployment, which keeps operational overhead low.
- The current expected lead volume is modest enough for the fast Gmail refresh and candidate-based Jira refresh model.
- The frontend is now more usable after toolbar stabilization, date filtering, fixed table widths, and clearer folder/project control.
- The scheduled-refresh design uses native Apps Script time-driven triggers, which is the right first step for a daily refresh.

## Current Stack Constraints

- Apps Script authorization is owner/user-centric. Time-driven trigger setup needs a one-time authorized owner run.
- Apps Script time-driven triggers are not exact cron jobs; `atHour(6).nearMinute(0)` means "around 6:00" in the script timezone.
- The web app access mode is still broad. Before wider or external use, access settings should be reviewed.
- The app has no automated CI, local Apps Script test runner, or browser regression harness.
- If imports/refreshes become slow or frequent, Apps Script execution limits may become a constraint.

## Future Architecture Options

Keep current stack for V2:

- Continue Apps Script + Google Sheet while usage is small and operational needs remain simple.
- Add a lightweight local parser/test harness before major parsing or matching changes.
- Consider disabling or narrowing setup/test endpoints after V2.

Potential future move:

- If multi-user usage, concurrency, or reporting grows, move scheduled jobs and API integration logic to a Cloud Run/Cloud Functions service while keeping the Sheet as a visible operational store.
- If UI complexity keeps growing, consider a separate frontend instead of further expanding `Script.html`.

## Approval-Required Decisions

- Confirm whether the app remains accessible as currently configured or should get stricter access control.
- Confirm whether setup/test endpoint actions should remain available after trigger installation.
- Confirm whether the daily trigger should use 6:00 project time permanently or another business timezone.

## Final Assessment

Decision: **CONTINUE CURRENT STACK WITH CONDITIONS**.

Apps Script remains the right stack for V2. The conditions are operational: authorize/install the trigger, clean old deployments, snapshot V2, and protect secrets before pushing to GitHub.
