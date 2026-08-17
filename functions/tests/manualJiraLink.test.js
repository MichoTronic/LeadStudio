"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var manualJira = require("../src/manualJiraLink");

function createFixture() {
  var headers = [
    "Email Date", "Contact Email", "Company Name", "Jira Issue Key", "Jira Issue URL",
    "Jira Match Source", "Onboarding Complete", "Last Checked", "Jira Status", "Lead Status",
    "Last Jira Check", "Notes"
  ];
  var row = ["2026-08-17", "lead@example.com", "Example", "SF-1", "https://old.example/SF-1", "jira", "", "old", "01 New Lead", "Lead", "old", "note"];
  var logs = [];
  var updates = [];
  return {
    headers: headers,
    row: row,
    logs: logs,
    updates: updates,
    client: { spreadsheets: { values: {
      batchGet: async function () {
        return { data: { valueRanges: [{ values: [headers.slice()] }, { values: [row.slice()] }] } };
      },
      get: async function () { return { data: { values: logs.map(function (entry) { return entry.slice(); }) } }; },
      batchUpdate: async function (request) {
        updates.push(request);
        request.requestBody.data.forEach(function (entry) {
          var column = entry.range.match(/!([A-Z]+)2$/)[1];
          var index = column.split("").reduce(function (value, character) { return value * 26 + character.charCodeAt(0) - 64; }, 0) - 1;
          row[index] = entry.values[0][0];
        });
        return { data: { totalUpdatedCells: request.requestBody.data.length } };
      },
      append: async function (request) {
        logs.push(request.requestBody.values[0].slice());
        return { data: { updates: { updatedRows: 1 } } };
      }
    } } }
  };
}

function options(fixture) {
  return {
    sheetsClient: fixture.client,
    spreadsheetId: "sheet-1",
    rowNumber: 2,
    actor: "admin@example.com",
    jiraBaseUrl: "https://gaming-universe.atlassian.net",
    jiraIssueByKey: async function (key) { return { issueKey: key, status: "02 Qualified Lead" }; },
    now: new Date("2026-08-17T10:02:00Z"),
    timeZone: "Europe/Ljubljana"
  };
}

test("updates only the manual Jira allowlist and replays without a second mutation", async function () {
  var fixture = createFixture();
  var prepared = await manualJira.prepareManualJiraLink(options(fixture));
  var result = await manualJira.executeManualJiraLink(Object.assign(options(fixture), {
    issueKey: "sf-42",
    idempotencyKey: "manualjira42",
    expectedVersion: prepared.rowVersion
  }));

  assert.equal(result.restored, false);
  assert.equal(fixture.row[3], "SF-42");
  assert.equal(fixture.row[4], "https://gaming-universe.atlassian.net/browse/SF-42");
  assert.equal(fixture.row[5], "manual");
  assert.equal(fixture.row[6], "Yes");
  assert.equal(fixture.row[8], "02 Qualified Lead");
  assert.equal(fixture.row[9], "Qualified Leads");
  assert.equal(fixture.row[11], "note");
  assert.equal(fixture.updates.length, 1);
  assert.equal(fixture.updates[0].requestBody.data.length, manualJira.WRITE_FIELDS.length);

  var replay = await manualJira.executeManualJiraLink(Object.assign(options(fixture), {
    issueKey: "SF-42",
    idempotencyKey: "manualjira42",
    expectedVersion: prepared.rowVersion
  }));
  assert.equal(replay.replayed, true);
  assert.equal(fixture.updates.length, 1);
});

test("restores the exact original row after a manual Jira acceptance round trip", async function () {
  var fixture = createFixture();
  var original = fixture.row.slice();
  var prepared = await manualJira.prepareManualJiraLink(options(fixture));
  var result = await manualJira.executeManualJiraLink(Object.assign(options(fixture), {
    issueKey: prepared.issueKey,
    idempotencyKey: "roundtrip42",
    expectedVersion: prepared.rowVersion,
    restoreAfterVerify: true
  }));

  assert.equal(result.restored, true);
  assert.equal(result.restoredVersion, prepared.rowVersion);
  assert.deepEqual(fixture.row, original);
  assert.equal(fixture.updates.length, 2);
});

test("rejects stale rows and missing Jira issues without mutating", async function () {
  var fixture = createFixture();
  var prepared = await manualJira.prepareManualJiraLink(options(fixture));
  fixture.row[2] = "Changed";
  await assert.rejects(
    manualJira.executeManualJiraLink(Object.assign(options(fixture), {
      issueKey: "SF-42",
      idempotencyKey: "stalelink42",
      expectedVersion: prepared.rowVersion
    })),
    function (error) { return error.code === "aborted"; }
  );
  assert.equal(fixture.updates.length, 0);

  var missing = createFixture();
  var missingPrepared = await manualJira.prepareManualJiraLink(options(missing));
  await assert.rejects(
    manualJira.executeManualJiraLink(Object.assign(options(missing), {
      jiraIssueByKey: async function () { return null; },
      issueKey: "SF-404",
      idempotencyKey: "missingjira42",
      expectedVersion: missingPrepared.rowVersion
    })),
    function (error) { return error.code === "invalid-argument"; }
  );
  assert.equal(missing.updates.length, 0);
});

test("formats Ljubljana timestamps and accepts only the Atlassian base URL", function () {
  assert.equal(manualJira.formatSheetTimestamp(new Date("2026-08-17T10:02:00Z"), "Europe/Ljubljana"), "2026-08-17 12:02");
  assert.equal(manualJira.buildJiraUrl("https://gaming-universe.atlassian.net", "SF-7"), "https://gaming-universe.atlassian.net/browse/SF-7");
  assert.throws(function () { manualJira.buildJiraUrl("https://example.com", "SF-7"); });
});
