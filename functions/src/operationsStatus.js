"use strict";

var DEFAULT_LIMIT = 100;

async function loadOperationsStatus(options) {
  options = options || {};
  if (!options.sheetsClient || !normalize(options.spreadsheetId)) {
    throw new Error("Lead Studio operations reads are not configured.");
  }
  var limit = Math.min(Math.max(Number(options.limit) || DEFAULT_LIMIT, 10), 250);
  var metadata = await options.sheetsClient.spreadsheets.get({
    spreadsheetId: options.spreadsheetId,
    fields: "sheets.properties(title,gridProperties.rowCount)"
  });
  var sheets = metadata && metadata.data && metadata.data.sheets || [];
  var debugSheet = sheets.find(function (sheet) {
    return normalize(sheet && sheet.properties && sheet.properties.title) === "Debug Log";
  });
  var rowCount = Number(debugSheet && debugSheet.properties && debugSheet.properties.gridProperties && debugSheet.properties.gridProperties.rowCount) || 1;
  var events = [];
  var endRow = rowCount;
  var inspectedPages = 0;
  while (endRow >= 2 && events.length < limit && inspectedPages < 5) {
    var startRow = Math.max(2, endRow - limit + 1);
    var response = await options.sheetsClient.spreadsheets.values.get({
      spreadsheetId: options.spreadsheetId,
      range: `'Debug Log'!A${startRow}:E${endRow}`,
      valueRenderOption: "FORMATTED_VALUE",
      fields: "values"
    });
    var pageEvents = (response && response.data && response.data.values || []).map(toSafeEvent).filter(Boolean);
    events = pageEvents.concat(events).slice(-limit);
    endRow = startRow - 1;
    inspectedPages += 1;
  }
  return {
    checkedAt: new Date().toISOString(),
    debugLog: {
      rowCount: Math.max(rowCount - 1, 0),
      inspectedRows: events.length,
      inspectedPages: inspectedPages,
      latestScheduled: latestMatching(events, /^FIREBASE_REFRESH_(COMPLETE|FAILED)$/),
      latestGmailPush: latestMatching(events, /^FIREBASE_GMAIL_PUSH_(COMPLETE|FAILED)$/),
      recentFailures: events.filter(function (event) { return /_FAILED$/.test(event.name); }).slice(-5).reverse()
    },
    gmailWatch: publicWatchState(options.watchState),
    runtime: options.runtime || {}
  };
}

function healthFailures(status, options) {
  options = options || {};
  var failures = [];
  var nowMs = Number(options.nowMs == null ? Date.now() : options.nowMs);
  var scheduled = status && status.debugLog && status.debugLog.latestScheduled;
  var scheduledMs = scheduled && Date.parse(scheduled.timestamp);
  if (!scheduled || scheduled.name !== "FIREBASE_REFRESH_COMPLETE") failures.push("scheduled-refresh-not-complete");
  else if (!Number.isFinite(scheduledMs) || nowMs - scheduledMs > 30 * 60 * 60 * 1000) failures.push("scheduled-refresh-stale");

  var runtime = status && status.runtime || {};
  var watch = status && status.gmailWatch || {};
  if (runtime.gmailPushEnabled === true || runtime.gmailWatchEnabled === true) {
    if (watch.configured !== true) failures.push("gmail-watch-not-configured");
    if (watch.expiringSoon === true) failures.push("gmail-watch-expiring");
    var successMs = Date.parse(watch.lastSuccessAt || "");
    var failureMs = Date.parse(watch.lastFailureAt || "");
    if (Number.isFinite(failureMs) && (!Number.isFinite(successMs) || failureMs > successMs)) failures.push("gmail-push-latest-failed");
  }
  return failures;
}

function toSafeEvent(row) {
  var name = normalize(row && row[1]);
  if (!name) return null;
  var details = {};
  try { details = JSON.parse(row[4] || "{}"); } catch (_) { details = {}; }
  return {
    timestamp: normalize(row[0]),
    name: name,
    source: normalize(row[2]),
    outcome: normalize(details.outcome),
    durationMs: nonNegativeNumber(details.durationMs),
    changedRows: nonNegativeNumber(details.changedRows),
    appendedRows: nonNegativeNumber(details.appendedRows),
    errorCode: normalize(details.errorCode)
  };
}

function latestMatching(events, pattern) {
  for (var index = events.length - 1; index >= 0; index -= 1) {
    if (pattern.test(events[index].name)) return events[index];
  }
  return null;
}

function publicWatchState(state) {
  if (!state) return { configured: false };
  var expirationMs = Number(state.watchExpiration) || 0;
  return {
    configured: Boolean(normalize(state.processedHistoryId)),
    emailAddress: normalize(state.emailAddress).toLowerCase(),
    watchExpiration: expirationMs ? new Date(expirationMs).toISOString() : "",
    expiringSoon: !expirationMs || expirationMs - Date.now() < 48 * 60 * 60 * 1000,
    renewedAt: normalize(state.renewedAt),
    lastPushAt: normalize(state.lastPushAt),
    lastSuccessAt: normalize(state.lastSuccessAt),
    lastFailureAt: normalize(state.lastFailureAt),
    lastFailureCode: normalize(state.lastFailureCode),
    lastCandidateMessages: nonNegativeNumber(state.lastCandidateMessages),
    lastAcceptedLeads: nonNegativeNumber(state.lastAcceptedLeads),
    lastAcceptedOnboarding: nonNegativeNumber(state.lastAcceptedOnboarding)
  };
}

function nonNegativeNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  DEFAULT_LIMIT,
  healthFailures,
  loadOperationsStatus,
  publicWatchState,
  toSafeEvent
};
