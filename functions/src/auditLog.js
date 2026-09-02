"use strict";

var DEBUG_LOG_SHEET = "Debug Log";
var DEFAULT_PAGE_SIZE = 1000;
var DEFAULT_MAX_PAGES = 5;

async function findEventDetails(options) {
  options = options || {};
  var eventName = normalize(options.eventName);
  var idempotencyKey = normalize(options.idempotencyKey);
  if (!options.sheetsClient || !normalize(options.spreadsheetId) || !eventName || !idempotencyKey) return null;

  var pageSize = boundedInteger(options.pageSize, DEFAULT_PAGE_SIZE, 100, 1000);
  var maxPages = boundedInteger(options.maxPages, DEFAULT_MAX_PAGES, 1, 10);
  var endRow = await debugLogRowCount(options);
  var inspectedPages = 0;
  while (endRow >= 2 && inspectedPages < maxPages) {
    var startRow = Math.max(2, endRow - pageSize + 1);
    var response = await options.sheetsClient.spreadsheets.values.get({
      spreadsheetId: options.spreadsheetId,
      range: `'${DEBUG_LOG_SHEET}'!A${startRow}:E${endRow}`,
      valueRenderOption: "FORMATTED_VALUE",
      fields: "values"
    });
    var values = response && response.data && response.data.values || [];
    for (var index = values.length - 1; index >= 0; index -= 1) {
      if (normalize(values[index] && values[index][1]) !== eventName) continue;
      var details = safeDetails(values[index] && values[index][4]);
      if (normalize(details.idempotencyKey) === idempotencyKey) return details;
    }
    endRow = startRow - 1;
    inspectedPages += 1;
  }
  return null;
}

async function debugLogRowCount(options) {
  if (typeof options.sheetsClient.spreadsheets.get !== "function") return DEFAULT_PAGE_SIZE + 1;
  var metadata = await options.sheetsClient.spreadsheets.get({
    spreadsheetId: options.spreadsheetId,
    fields: "sheets.properties(title,gridProperties.rowCount)"
  });
  var sheets = metadata && metadata.data && metadata.data.sheets || [];
  var debugSheet = sheets.find(function (sheet) {
    return normalize(sheet && sheet.properties && sheet.properties.title) === DEBUG_LOG_SHEET;
  });
  return Math.max(Number(debugSheet && debugSheet.properties && debugSheet.properties.gridProperties && debugSheet.properties.gridProperties.rowCount) || 1, 1);
}

function safeDetails(value) {
  try {
    var details = JSON.parse(value || "{}");
    return details && typeof details === "object" && !Array.isArray(details) ? details : {};
  } catch (_) {
    return {};
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  var number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.min(Math.max(number, minimum), maximum) : fallback;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  DEBUG_LOG_SHEET,
  DEFAULT_MAX_PAGES,
  DEFAULT_PAGE_SIZE,
  findEventDetails,
  safeDetails
};
