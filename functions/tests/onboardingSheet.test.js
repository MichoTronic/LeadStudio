"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var onboarding = require("../src/onboardingSheet");

test("builds the legacy onboarding lookup and keeps the newest eligible row", function () {
  var values = [
    ["Timestamp", "Operating Markets", "Responsible Person", "Email Address", "JIRA task ID"],
    ["2026-08-01 10:00", "row, Asia", "Špela Novak", "lead@example.com", "SF-10"],
    ["2026-08-02 10:00", "LATAM", "Spela Novak", "lead@example.com", "SF-11"],
    ["2026-08-03 10:00", "ROW", "Ignored", "ignored@example.com", ""]
  ];
  var lookup = onboarding.buildOnboardingLookup(values);
  assert.equal(lookup.eligibleRows, 2);
  assert.equal(lookup.byEmail["lead@example.com"].rowNumber, 3);
  assert.equal(lookup.byResponsiblePerson["spela novak"].jiraIssueKey, "SF-11");
  assert.equal(lookup.byEmail["lead@example.com"].targetRegion, "LATAM");
});

test("matches leads by email before normalized responsible person", function () {
  var lookup = onboarding.buildOnboardingLookup([
    ["Timestamp", "Operating Markets", "Responsible Person", "Email Address", "JIRA task ID"],
    ["2026-08-01", "ROW", "Špela Novak", "other@example.com", "SF-10"]
  ]);
  var result = onboarding.findOnboardingRequest(lookup, {
    contactEmail: "missing@example.com",
    name: "Spela",
    lastName: "Novak"
  });
  assert.equal(result.source, "responsiblePerson");
  assert.equal(result.match.jiraIssueKey, "SF-10");
});
