"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var parser = require("../src/gmailLeadParser");
var onboardingSheet = require("../src/onboardingSheet");
var refresh = require("../src/refreshMutation");

function leadValues(overrides) {
  return Object.assign(parser.emptyAppendValues(), {
    "Found At": "2026-08-01 10:00",
    "Email Date": "2026/08/01",
    "Name": "Ada",
    "Last Name": "Lovelace",
    "Contact Email": "ada@example.com",
    "Company Name": "Analytical Engines",
    "Gmail Message ID": "gmail-1",
    "Onboarding Complete": "No"
  }, overrides || {});
}

function fixturePlan() {
  var headers = parser.APPEND_HEADERS.slice();
  var original = headers.map(function (header) { return leadValues()[header]; });
  var snapshot = { headers: headers, rows: [original], version: refresh.snapshotVersion(headers, [original]) };
  var appendedValues = leadValues({
    "Name": "Grace",
    "Last Name": "Hopper",
    "Contact Email": "grace@example.com",
    "Company Name": "Navy",
    "Gmail Message ID": "gmail-2"
  });
  var onboardingLookup = onboardingSheet.buildOnboardingLookup([
    ["Timestamp", "Operating Markets", "Responsible Person", "Email Address", "JIRA task ID", "JIRA task URL", "Info Sheet", "Onboarding Doc"],
    ["2026-08-02 09:00", "ROW", "Ada Lovelace", "ada@example.com", "SF-1", "https://jira.at.semper7.net/browse/SF-1", "https://docs.example/info", "https://docs.example/onboarding"]
  ]);
  return refresh.buildRefreshPlan({
    snapshot: snapshot,
    gmailLeadScan: {
      acceptedMessages: [
        { messageId: "gmail-1", contactEmail: "ada@example.com", values: leadValues() },
        { messageId: "gmail-2", contactEmail: "grace@example.com", values: appendedValues }
      ]
    },
    gmailOnboardingScan: {
      acceptedMessages: [
        { messageId: "onboarding-1", contactEmail: "ada@example.com", countHint: 2, emailDate: "2026/08/03" }
      ]
    },
    onboardingLookup: onboardingLookup,
    liveStatuses: { "SF-1": { issueKey: "SF-1", status: "02 Qualified Lead" } },
    jiraByEmail: { "grace@example.com": { issueKey: "SF-2", status: "01 New Lead" } },
    now: new Date("2026-08-17T10:15:00Z"),
    timeZone: "Europe/Ljubljana"
  });
}

test("builds full existing-row and append mutations without exposing lead content", function () {
  var plan = fixturePlan();
  var indexes = Object.fromEntries(plan.headers.map(function (header, index) { return [header, index]; }));
  assert.equal(plan.summary.changedRows, 1);
  assert.equal(plan.summary.appendedRows, 1);
  assert.equal(plan.targetRows[0][indexes["Onboarding Sent"]], "2");
  assert.equal(plan.targetRows[0][indexes["Onboarding Message ID"]], "onboarding-1");
  assert.equal(plan.targetRows[0][indexes["Jira Issue Key"]], "SF-1");
  assert.equal(plan.targetRows[0][indexes["Jira Status"]], "02 Qualified Lead");
  assert.equal(plan.targetRows[0][indexes["Lead Status"]], "Qualified Leads");
  assert.equal(plan.targetRows[0][indexes["Info Sheet"]], "https://docs.example/info");
  assert.equal(plan.targetRows[1][indexes["Jira Issue Key"]], "SF-2");
  assert.equal(plan.targetRows[1][indexes["Jira Match Source"]], "jira_search_fallback");
  var publicResult = refresh.publicPlan(plan);
  assert.equal(JSON.stringify(publicResult).includes("ada@example.com"), false);
  assert.equal(JSON.stringify(publicResult).includes("gmail-1"), false);
  assert.deepEqual(publicResult.rowNumbers, [2]);
  assert.deepEqual(publicResult.appendRowNumbers, [3]);
});

test("writes, verifies, restores, audits, and replays a whole refresh plan", async function () {
  var plan = fixturePlan();
  var state = [plan.headers.slice()].concat(plan.originalRows.map(function (row) { return row.slice(); }));
  var audits = [];
  var sheetsClient = {
    spreadsheets: { values: {
      get: async function (request) {
        if (request.range.includes("Debug Log")) return { data: { values: audits.map(function (row) { return row.slice(); }) } };
        return { data: { values: state.map(function (row) { return row.slice(); }) } };
      },
      batchUpdate: async function (request) {
        request.requestBody.data.forEach(function (update) {
          var rowNumber = Number(update.range.match(/A(\d+):AI\d+/)[1]);
          state[rowNumber - 1] = update.values[0].slice();
        });
        return { data: {} };
      },
      batchClear: async function (request) {
        var match = request.requestBody.ranges[0].match(/A(\d+):AI(\d+)/);
        state.splice(Number(match[1]) - 1, Number(match[2]) - Number(match[1]) + 1);
        return { data: {} };
      },
      append: async function (request) {
        audits.push(request.requestBody.values[0].slice());
        return { data: {} };
      }
    } }
  };
  var options = {
    plan: plan,
    sheetsClient: sheetsClient,
    spreadsheetId: "sheet-1",
    actor: "admin@example.com",
    idempotencyKey: "refreshacceptance1",
    expectedVersion: plan.originalVersion,
    restoreAfterVerify: true
  };
  var result = await refresh.executeRefreshPlan(options);
  assert.equal(result.restored, true);
  assert.equal(result.replayed, false);
  assert.equal(result.restoredVersion, plan.originalVersion);
  assert.equal(refresh.snapshotVersion(state[0], state.slice(1)), plan.originalVersion);
  assert.deepEqual(audits.map(function (row) { return row[1]; }), ["FIREBASE_REFRESH_STARTED", "FIREBASE_REFRESH_COMPLETE"]);

  var replay = await refresh.executeRefreshPlan(options);
  assert.equal(replay.replayed, true);
  assert.equal(audits.length, 2);
});

test("rejects a stale whole-Sheet snapshot before mutation", async function () {
  var plan = fixturePlan();
  var state = [plan.headers.slice()].concat(plan.originalRows.map(function (row) { return row.slice(); }));
  state[1][0] = "changed elsewhere";
  var writes = 0;
  var sheetsClient = { spreadsheets: { values: {
    get: async function (request) {
      return request.range.includes("Debug Log") ? { data: { values: [] } } : { data: { values: state } };
    },
    append: async function () { return { data: {} }; },
    batchUpdate: async function () { writes += 1; return { data: {} }; }
  } } };
  await assert.rejects(refresh.executeRefreshPlan({
    plan: plan,
    sheetsClient: sheetsClient,
    spreadsheetId: "sheet-1",
    actor: "admin@example.com",
    idempotencyKey: "refreshconflict1",
    expectedVersion: plan.originalVersion,
    restoreAfterVerify: true
  }), /changed before the refresh/);
  assert.equal(writes, 0);
});

test("restores when a write commits but its request reports failure", async function () {
  var plan = fixturePlan();
  var state = [plan.headers.slice()].concat(plan.originalRows.map(function (row) { return row.slice(); }));
  var audits = [];
  var writeAttempts = 0;
  var sheetsClient = { spreadsheets: { values: {
    get: async function (request) {
      return request.range.includes("Debug Log")
        ? { data: { values: audits.map(function (row) { return row.slice(); }) } }
        : { data: { values: state.map(function (row) { return row.slice(); }) } };
    },
    batchUpdate: async function (request) {
      request.requestBody.data.forEach(function (update) {
        var rowNumber = Number(update.range.match(/A(\d+):AI\d+/)[1]);
        state[rowNumber - 1] = update.values[0].slice();
      });
      writeAttempts += 1;
      if (writeAttempts === 1) throw new Error("connection closed after commit");
      return { data: {} };
    },
    batchClear: async function (request) {
      var match = request.requestBody.ranges[0].match(/A(\d+):AI(\d+)/);
      state.splice(Number(match[1]) - 1, Number(match[2]) - Number(match[1]) + 1);
      return { data: {} };
    },
    append: async function (request) {
      audits.push(request.requestBody.values[0].slice());
      return { data: {} };
    }
  } } };

  await assert.rejects(refresh.executeRefreshPlan({
    plan: plan,
    sheetsClient: sheetsClient,
    spreadsheetId: "sheet-1",
    actor: "admin@example.com",
    idempotencyKey: "refreshambiguous1",
    expectedVersion: plan.originalVersion,
    restoreAfterVerify: true
  }), /connection closed after commit/);

  assert.equal(refresh.snapshotVersion(state[0], state.slice(1)), plan.originalVersion);
  assert.equal(JSON.parse(audits[audits.length - 1][4]).restored, true);
});
