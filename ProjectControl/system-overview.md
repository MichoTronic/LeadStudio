# System Overview

## Purpose

Lead Studio turns trusted marketing contact messages and onboarding records
into a searchable sales workflow with Jira lifecycle context and exports.

## Active Runtime

```text
Gmail users.watch / Pub/Sub
          |
Firebase Node 22 Functions + Scheduler
          |
Google Sheets source of truth <-> Jira API
          |
Firebase Hosting UI
          |
TimelessStudioAuth identity and policy
```

## Components

- `public/`: responsive Lead Studio UI, filters, detail/activity dialog, manual
  Jira linking, and CSV/XLSX export.
- `functions/`: protected reads/actions, Gmail history ingestion, scheduled
  reconciliation, Jira synchronization, writer lock, health checks, and tests.
- Google Sheets: Lead Studio database and Form-linked onboarding responses.
- Gmail API/Pub/Sub: event signal plus bounded message/history reads.
- Jira API: issue/status lookup and manually approved key/link updates.
- `AppsScript/`: inactive v60 rollback/reference implementation.

## Data And Write Rules

- Preserve the Google Form response connection.
- Firebase Scheduler is the only automatic writer while GAS remains trigger-free.
- All mutation paths share the generation-checked writer lock.
- Writes use idempotency keys, expected row versions, field allowlists, and
  metadata-only audit records.
- Browser payloads exclude provider IDs, tokens, raw delegated credentials, and
  unrestricted email bodies.

## Authorization

`TimelessStudioAuth` policy `studioPolicies/lead-studio` controls access. Lead
Studio Functions remain authoritative for protected reads and writes. Console
launcher visibility is not sufficient authorization.
