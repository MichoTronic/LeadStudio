# Lead Studio Phase Completion Review Pack

Run this ordered review pack after a meaningful phase, release candidate, or integration milestone is completed and locally verified.

Order matters:

1. `01_Architecture_And_Code_Health_Review_Template.md`
2. `02_Technology_Stack_And_Future_Architecture_Review_Template.md`
3. `03_Stability_Logging_And_Debugging_Review_Template.md`
4. `04_Full_Feature_Verification_And_QA_Review_Template.md`
5. `05_CTO_Go_No_Go_Readiness_Review_Template.md`

`05` is intentionally last because it is the go/no-go decision after the deeper checks.

Completed review outputs belong in `../Reports/` with this naming pattern:

```text
YYYY_MM_DD_Phase_<phase-or-topic>_<review-name>_Report.md
```

The review pack is reusable instruction/template material. Do not edit these files with one-off phase conclusions unless the review process itself changes.

## Before Running

- Read `../README.md`, `../PROJECT_STATUS.md`, and `../ProjectControl/CHECKLIST.md`.
- Confirm `clasp status` points at `AppsScript/`.
- Confirm whether the stable Apps Script deployment has been updated or only project head has changed.
- Do not copy secrets from `../ProjectControl/DocumentationArchive/NOTES.md` into review reports.

## After Running

- Save the completed report in `../Reports/`.
- Update `../PROJECT_STATUS.md` with the final decision and verification results.
- Move surviving action items into `../ProjectControl/CHECKLIST.md`.
- Keep historical findings in the dated report, not in the active checklist.
