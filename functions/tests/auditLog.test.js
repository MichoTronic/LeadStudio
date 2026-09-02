"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var auditLog = require("../src/auditLog");

test("finds a recent idempotency event beyond the first 5000 audit rows", async function () {
  var requestedRanges = [];
  var client = { spreadsheets: {
    get: async function () {
      return { data: { sheets: [{ properties: { title: "Debug Log", gridProperties: { rowCount: 6200 } } }] } };
    },
    values: { get: async function (request) {
      requestedRanges.push(request.range);
      return { data: { values: [["time", "FIREBASE_REFRESH_COMPLETE", "source", "message", JSON.stringify({ idempotencyKey: "recent-key", changedRows: 2 })]] } };
    } }
  } };
  var details = await auditLog.findEventDetails({
    sheetsClient: client,
    spreadsheetId: "sheet-1",
    eventName: "FIREBASE_REFRESH_COMPLETE",
    idempotencyKey: "recent-key"
  });
  assert.equal(details.changedRows, 2);
  assert.equal(requestedRanges[0], "'Debug Log'!A5201:E6200");
});

test("bounds audit lookup pagination and ignores malformed details", async function () {
  var reads = 0;
  var client = { spreadsheets: {
    get: async function () {
      return { data: { sheets: [{ properties: { title: "Debug Log", gridProperties: { rowCount: 9000 } } }] } };
    },
    values: { get: async function () {
      reads += 1;
      return { data: { values: [["time", "OTHER_EVENT", "source", "message", "not-json"]] } };
    } }
  } };
  var details = await auditLog.findEventDetails({
    sheetsClient: client,
    spreadsheetId: "sheet-1",
    eventName: "FIREBASE_REFRESH_COMPLETE",
    idempotencyKey: "missing-key",
    pageSize: 100,
    maxPages: 2
  });
  assert.equal(details, null);
  assert.equal(reads, 2);
  assert.deepEqual(auditLog.safeDetails("[]"), {});
});
