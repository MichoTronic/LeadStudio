"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var list = require("../../public/lead-list-utils");

var STATUS_MAP = { "01 new lead": "Lead", "02 qualified lead": "Qualified Leads" };
var LEADS = [
  { rowNumber: 2, emailDate: "2026-08-10", companyName: "Zulu", businessType: "Provider", targetRegion: "ROW, Asia", interestedIn: "Bonus Engine", inquiry: "Sportsbook request", jiraStatus: "01 New Lead" },
  { rowNumber: 3, emailDate: "2026-08-17", companyName: "Alpha", businessType: "Operator", targetRegion: "LATAM", interestedIn: "White Label, Other", inquiry: "Casino launch", jiraStatus: "02 Qualified Lead", onboardingComplete: "Yes" },
  { rowNumber: 4, emailDate: "2026-08-15", companyName: "Beta", businessType: "Provider", targetRegion: "Asia", interestedIn: "Other", inquiry: "Aggregator" }
];

test("shows all leads by default and sorts newest first", function () {
  var result = list.filterAndSort(LEADS, { statusMap: STATUS_MAP, sort: { field: "emailDate", direction: "desc" } });
  assert.deepEqual(result.map(function (lead) { return lead.rowNumber; }), [3, 4, 2]);
});

test("combines legacy facet filters and inquiry search", function () {
  var result = list.filterLeads(LEADS, {
    query: "sportsbook",
    businessTypes: ["Provider"],
    targetRegions: ["Asia"],
    interests: ["Bonus Engine"],
    status: "Lead",
    statusMap: STATUS_MAP
  });
  assert.deepEqual(result.map(function (lead) { return lead.rowNumber; }), [2]);
});

test("keeps untracked contacts in All leads but out of the New lead lifecycle bucket", function () {
  var all = list.filterLeads(LEADS, { statusMap: STATUS_MAP });
  var newLeads = list.filterLeads(LEADS, { status: "Lead", statusMap: STATUS_MAP });
  assert.deepEqual(all.map(function (lead) { return lead.rowNumber; }), [2, 3, 4]);
  assert.deepEqual(newLeads.map(function (lead) { return lead.rowNumber; }), [2]);
});

test("sorts companies and builds deduplicated multi-value facets", function () {
  var sorted = list.sortLeads(LEADS, { field: "companyName", direction: "asc" });
  assert.deepEqual(sorted.map(function (lead) { return lead.companyName; }), ["Alpha", "Beta", "Zulu"]);
  assert.deepEqual(list.facetValues(LEADS, "targetRegion"), ["Asia", "LATAM", "ROW"]);
  assert.deepEqual(list.facetValues(LEADS, "interestedIn"), ["Bonus Engine", "Other", "White Label"]);
});

test("normalizes only the supported Interested in products and drops unrelated legacy text", function () {
  assert.equal(list.canonicalInterestValue("turnkey solution; bonus_engine_gamification"), "Bonus Engine, White Label");
  assert.equal(list.canonicalInterestValue("game aggregator and betting exchange"), "Game Aggregator, BetExchange");
  assert.equal(list.canonicalInterestValue("1x2 Gaming"), "");
  assert.deepEqual(list.interestOptions, ["Game Aggregator", "Bonus Engine", "White Label", "BetExchange", "Other"]);
});

test("filters an inclusive custom date range and lets it override a preset", function () {
  var result = list.filterLeads(LEADS, {
    fromDate: "2026-08-11",
    toDate: "2026-08-15",
    days: 7,
    now: new Date("2026-08-18T12:00:00Z").getTime(),
    statusMap: STATUS_MAP
  });
  assert.deepEqual(result.map(function (lead) { return lead.rowNumber; }), [4]);
});
