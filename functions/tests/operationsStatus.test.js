"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var operations = require("../src/operationsStatus");

test("reads only a bounded Debug Log tail and returns metadata-only health", async function () {
  var requestedRanges = [];
  var valueCalls = 0;
  var result = await operations.loadOperationsStatus({
    spreadsheetId: "sheet-1",
    limit: 100,
    watchState: {
      emailAddress: "marketing@timelesstech.io",
      processedHistoryId: "private-cursor",
      watchExpiration: String(Date.now() + 72 * 60 * 60 * 1000),
      renewedAt: "2026-08-18T08:00:00.000Z",
      lastCandidateMessages: 4,
      lastAcceptedLeads: 1
    },
    runtime: { gmailPushEnabled: true },
    sheetsClient: { spreadsheets: {
      get: async function () { return { data: { sheets: [{ properties: { title: "Debug Log", gridProperties: { rowCount: 1600 } } }] } }; },
      values: { get: async function (request) {
        requestedRanges.push(request.range);
        valueCalls += 1;
        if (valueCalls > 1) return { data: { values: [] } };
        return { data: { values: [
          ["2026-08-18T04:00:00.000Z", "FIREBASE_REFRESH_COMPLETE", "leadStudioScheduledRefreshV4", "complete", JSON.stringify({ outcome: "complete", durationMs: 15000, changedRows: 55, appendedRows: 1, contactEmail: "must-not-leak@example.com" })],
          ["2026-08-18T08:01:00.000Z", "FIREBASE_GMAIL_PUSH_FAILED", "leadStudioGmailPushV4", "failed", JSON.stringify({ outcome: "failed", errorCode: "aborted", messageId: "private-message" })]
        ] } };
      } }
    } }
  });
  assert.equal(requestedRanges[0], "'Debug Log'!A1501:E1600");
  assert.equal(result.debugLog.latestScheduled.durationMs, 15000);
  assert.equal(result.debugLog.latestGmailPush.errorCode, "aborted");
  assert.equal(result.gmailWatch.configured, true);
  assert.equal(JSON.stringify(result).includes("private-cursor"), false);
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(result).includes("private-message"), false);
});

test("reports stale scheduled refreshes and Gmail watch failures without contact data", function () {
  var failures = operations.healthFailures({
    debugLog: { latestScheduled: { name: "FIREBASE_REFRESH_COMPLETE", timestamp: "2026-08-16T04:00:00.000Z" } },
    runtime: { gmailPushEnabled: true, gmailWatchEnabled: true },
    gmailWatch: {
      configured: true,
      expiringSoon: false,
      lastSuccessAt: "2026-08-18T07:00:00.000Z",
      lastFailureAt: "2026-08-18T08:00:00.000Z"
    }
  }, { nowMs: Date.parse("2026-08-18T10:00:00.000Z") });
  assert.deepEqual(failures, ["scheduled-refresh-stale", "gmail-push-latest-failed"]);
});
