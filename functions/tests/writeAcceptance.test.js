"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var acceptance = require("../src/writeAcceptance");

function createFixture() {
  var headers = ["Email Date", "Contact Email", "Company Name", "Lead Status", "Notes"];
  var row = ["2026-08-17", "lead@example.com", "Example", "Lead", "Original note"];
  var logs = [];
  var updates = [];
  return {
    headers: headers,
    row: row,
    logs: logs,
    updates: updates,
    client: {
      spreadsheets: { values: {
        batchGet: async function () {
          return { data: { valueRanges: [{ values: [headers.slice()] }, { values: [row.slice()] }] } };
        },
        get: async function () { return { data: { values: logs.map(function (entry) { return entry.slice(); }) } }; },
        update: async function (request) {
          updates.push(request);
          row[headers.indexOf("Notes")] = request.requestBody.values[0][0];
          return { data: { updatedCells: 1 } };
        },
        append: async function (request) {
          logs.push(request.requestBody.values[0].slice());
          return { data: { updates: { updatedRows: 1 } } };
        }
      } }
    }
  };
}

function options(fixture) {
  return {
    sheetsClient: fixture.client,
    spreadsheetId: "sheet-1",
    rowNumber: 2,
    actor: "admin@example.com"
  };
}

test("writes, verifies, restores, audits, and replays a Notes acceptance command", async function () {
  var fixture = createFixture();
  var prepared = await acceptance.prepareNotesRoundTrip(options(fixture));
  var result = await acceptance.executeNotesRoundTrip(Object.assign(options(fixture), {
    idempotencyKey: "acceptance123",
    expectedVersion: prepared.rowVersion
  }));
  assert.equal(result.restored, true);
  assert.equal(result.replayed, false);
  assert.equal(fixture.row[4], "Original note");
  assert.equal(fixture.updates.length, 2);
  assert.match(fixture.updates[0].range, /E2$/);
  assert.deepEqual(fixture.logs.map(function (entry) { return entry[1]; }), [
    "FIREBASE_WRITE_ACCEPTANCE_STARTED",
    "FIREBASE_WRITE_ACCEPTANCE_COMPLETE"
  ]);

  var replay = await acceptance.executeNotesRoundTrip(Object.assign(options(fixture), {
    idempotencyKey: "acceptance123",
    expectedVersion: prepared.rowVersion
  }));
  assert.equal(replay.replayed, true);
  assert.equal(replay.restored, true);
  assert.equal(fixture.updates.length, 2);
});

test("rejects a stale row version before changing Notes", async function () {
  var fixture = createFixture();
  var prepared = await acceptance.prepareNotesRoundTrip(options(fixture));
  fixture.row[2] = "Changed elsewhere";
  await assert.rejects(
    acceptance.executeNotesRoundTrip(Object.assign(options(fixture), {
      idempotencyKey: "conflict123",
      expectedVersion: prepared.rowVersion
    })),
    function (error) { return error.code === "aborted"; }
  );
  assert.equal(fixture.updates.length, 0);
  assert.equal(fixture.row[4], "Original note");
  assert.deepEqual(fixture.logs.map(function (entry) { return entry[1]; }), [
    "FIREBASE_WRITE_ACCEPTANCE_STARTED",
    "FIREBASE_WRITE_ACCEPTANCE_REJECTED"
  ]);
});

test("converts Sheet column numbers to A1 names", function () {
  assert.equal(acceptance.columnName(1), "A");
  assert.equal(acceptance.columnName(26), "Z");
  assert.equal(acceptance.columnName(27), "AA");
});
