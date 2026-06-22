# 04 Full Feature Verification And QA Review Template

Scope: end-to-end functional behavior and UI verification.

## Review Inputs

- `../AppsScript/`
- Latest project status and checklist.
- Current stable web app deployment or Apps Script project head, depending on test target.

## Feature Checklist

- [ ] App loads and viewer identity displays.
- [ ] Refresh Leads completes without UI lockup.
- [ ] Fast Gmail scan respects the configured recent window.
- [ ] Deep Scan Marketing Inbox works when intentionally triggered.
- [ ] Business Type, Target Region, and Interested In filters work.
- [ ] Filter/export dropdowns close on outside click and Escape.
- [ ] Toolbar controls do not jump while selecting dropdown options.
- [ ] Search filters visible rows correctly.
- [ ] Metric chips filter rows correctly.
- [ ] Table sort works for Email Date and Company Name.
- [ ] Lead detail opens and displays contact/message/tracking fields.
- [ ] Manual Jira link save works for a safe test row or reviewed sample.
- [ ] Jira links open in a new tab without opening lead details.
- [ ] CSV export matches visible filtered rows.
- [ ] XLSX export matches visible filtered rows.
- [ ] Settings diagnostics open and report useful output.

## Viewports

- [ ] Desktop wide viewport.
- [ ] Laptop width viewport.
- [ ] Mobile/narrow viewport if the app is expected to be used there.

## Findings

### Passed

- 

### Failed Or Not Tested

- 

### UX Issues

- 

## Final Assessment

Decision: `PASS`, `PASS WITH CONDITIONS`, or `BLOCKED`.

Summary:

- 
