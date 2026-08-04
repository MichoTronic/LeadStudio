# Future Firebase Migration Notice - Lead Studio

Last updated: 2026-08-04

## Intent

Lead Studio currently lives in the ContactLeadForms project and is a candidate for future migration from Google Apps Script patterns to Firebase Hosting, Firestore, and Cloud Functions.

The shared `TimelessStudioAuth` project should be used for sign-in and policy checks when this Studio is connected to the new Studio access model.

No full Firebase/Firestore port is active right now. This file is a future migration guardrail only. Keep Lead Studio on the current Apps Script architecture until a separate owner-approved migration phase is opened.

## Expected Benefits

- Centralized access management from Marketing Studio Console.
- Cleaner per-user and per-domain roles through `studioPolicies/contact-lead-forms`.
- Better UI performance and deploy control than Apps Script web app pages.
- A stronger path for private lead data handling through backend-only Cloud Functions.
- Easier reuse of the same auth pattern across Signature, Raffle, and future Studios.

## What Must Be Preserved

- Existing lead capture flows and any embedded form URLs.
- Existing Google Sheet or Apps Script data contracts.
- Duplicate detection, email notifications, campaign routing, and any manual review workflow.
- Privacy of lead/contact data. Public browser code must not receive private source credentials or unrestricted data.
- Expected access policy: small explicit team, not automatically company-wide unless approved.

## Migration Risks

- Lead data is sensitive. Firestore rules and Cloud Functions must be designed before moving private records.
- Existing forms may post to Apps Script endpoints; changing endpoints can silently break campaigns.
- If Sheets remain the human-readable ledger, synchronization rules must be explicit.
- Email notification behavior may depend on Apps Script services and needs a replacement plan.
- Role design must be precise: viewer, editor, admin, and any campaign-specific actions should not be mixed casually.

## Safe Migration Rule

Keep the current Apps Script version live while a Firebase version is built and tested in parallel. Only switch Marketing Studio Console links after:

- sample lead creation works;
- private data is not exposed in browser responses;
- authorized users can read/write as intended;
- unauthorized users are denied by backend checks;
- rollback to the current Apps Script endpoint is documented.

## Recipe Maintenance Rule

Do not keep changing the shared Firebase migration recipe speculatively. Update the recipe only when a real Lead Studio migration pilot starts, when a measured Apps Script limitation is documented, or when a completed auth integration changes the reusable pattern.
