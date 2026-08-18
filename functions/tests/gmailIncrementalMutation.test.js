"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var parser = require("../src/gmailLeadParser");
var incremental = require("../src/gmailIncrementalMutation");
var refresh = require("../src/refreshMutation");

function values(overrides) {
  return Object.assign(parser.emptyAppendValues(), {
    "Found At": "2026-08-18 10:00",
    "Email Date": "2026/08/18",
    "Name": "Ada",
    "Last Name": "Lovelace",
    "Contact Email": "ada@example.com",
    "Company Name": "Analytical Engines",
    "Gmail Message ID": "lead-1",
    "Onboarding Complete": "No"
  }, overrides || {});
}

test("builds a narrow Gmail plan without changing Jira fields", function () {
  var headers = parser.APPEND_HEADERS.slice();
  var existingValues = values({
    "Jira Issue Key": "SF-1",
    "Jira Status": "02 Qualified Lead",
    "Lead Status": "Qualified Leads",
    "Last Jira Check": "2026-08-18 06:00",
    "Onboarding Sent": "1",
    "Onboarding Sent At": "2026/08/17",
    "Onboarding Message ID": "onboarding-old"
  });
  var original = headers.map(function (header) { return existingValues[header]; });
  var snapshot = { headers: headers, rows: [original], version: refresh.snapshotVersion(headers, [original]) };
  var newLeadValues = values({
    "Name": "Grace",
    "Last Name": "Hopper",
    "Contact Email": "grace@example.com",
    "Company Name": "Navy",
    "Gmail Message ID": "lead-2"
  });
  var plan = incremental.buildIncrementalPlan({
    snapshot: snapshot,
    leadMessages: [
      { messageId: "lead-1", values: existingValues },
      { messageId: "lead-2", values: newLeadValues }
    ],
    onboardingMessages: [
      { messageId: "onboarding-old", contactEmail: "ada@example.com", emailDate: "2026/08/17", countHint: 1 },
      { messageId: "onboarding-new", contactEmail: "ada@example.com", emailDate: "2026/08/18", countHint: 2 }
    ]
  });
  var indexes = Object.fromEntries(headers.map(function (header, index) { return [header, index]; }));
  assert.equal(plan.summary.changedRows, 1);
  assert.equal(plan.summary.appendedRows, 1);
  assert.equal(plan.targetRows[0][indexes["Onboarding Sent"]], "2");
  assert.equal(plan.targetRows[0][indexes["Onboarding Message ID"]], "onboarding-old, onboarding-new");
  assert.equal(plan.targetRows[0][indexes["Jira Status"]], "02 Qualified Lead");
  assert.equal(plan.targetRows[0][indexes["Last Jira Check"]], "2026-08-18 06:00");
  assert.equal(plan.targetRows[1][indexes["Gmail Message ID"]], "lead-2");
});

test("creates deterministic Gmail history idempotency keys", function () {
  var key = incremental.pushIdempotencyKey("100", "110");
  assert.equal(key, incremental.pushIdempotencyKey("100", "110"));
  assert.match(key, /^gmailpush_[a-f0-9]{32}$/);
});
