"use strict";

var crypto = require("node:crypto");
var auditLog = require("./auditLog");

var LEAD_SHEET = "Email Matches";
var DEBUG_LOG_SHEET = "Debug Log";
var MAX_COLUMNS = "AI";
var WRITE_FIELDS = Object.freeze([
  "Jira Issue Key",
  "Jira Issue URL",
  "Jira Match Source",
  "Onboarding Complete",
  "Last Checked",
  "Jira Status",
  "Lead Status",
  "Last Jira Check"
]);
var STATUS_MAP = Object.freeze({
  "01 new lead": "Lead",
  "02 qualified lead": "Qualified Leads",
  "06 active": "Active",
  "07 inactive": "Not Active",
  "08 customer archive": "Not Active"
});

async function prepareManualJiraLink(options) {
  var snapshot = await readLeadRow(options);
  return {
    rowNumber: snapshot.rowNumber,
    rowVersion: rowVersion(snapshot.row),
    issueKey: normalize(snapshot.row[snapshot.indexes["Jira Issue Key"]]),
    issueUrl: normalize(snapshot.row[snapshot.indexes["Jira Issue URL"]])
  };
}

async function executeManualJiraLink(options) {
  var idempotencyKey = normalize(options && options.idempotencyKey);
  var expectedVersion = normalize(options && options.expectedVersion);
  var actor = normalize(options && options.actor).toLowerCase();
  var issueKey = normalizeManualIssueKey(
    options && options.issueKey,
    options && options.jiraBaseUrl,
    options && options.jiraBrowserBaseUrl
  );
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) throw codedError("invalid-argument", "A valid idempotency key is required.");
  if (!/^[a-f0-9]{64}$/.test(expectedVersion)) throw codedError("invalid-argument", "A valid expected row version is required.");
  if (!actor) throw codedError("invalid-argument", "An authenticated actor is required.");
  if (!issueKey) throw codedError("invalid-argument", "A valid Jira issue key is required.");
  if (typeof options.jiraIssueByKey !== "function") throw codedError("failed-precondition", "Jira validation is not configured.");

  var replay = await findCompletedAudit(options, idempotencyKey);
  if (replay) return replay;

  var snapshot = await readLeadRow(options);
  var observedVersion = rowVersion(snapshot.row);
  var auditBase = {
    actor: actor,
    command: options.restoreAfterVerify === true ? "manual_jira_link_round_trip" : "manual_jira_link",
    rowNumber: snapshot.rowNumber,
    idempotencyKey: idempotencyKey,
    expectedVersion: expectedVersion,
    observedVersion: observedVersion,
    changedFields: WRITE_FIELDS.slice()
  };
  await appendAudit(options, "FIREBASE_MANUAL_JIRA_STARTED", "Started optimistic manual Jira link command.", Object.assign({}, auditBase, { outcome: "started" }));

  if (observedVersion !== expectedVersion) {
    await appendAudit(options, "FIREBASE_MANUAL_JIRA_REJECTED", "Rejected stale row version before mutation.", Object.assign({}, auditBase, { outcome: "conflict" }));
    throw codedError("aborted", "The lead row changed before the write and was not modified.");
  }

  var issue;
  try {
    issue = await options.jiraIssueByKey(issueKey);
  } catch (_) {
    await appendAudit(options, "FIREBASE_MANUAL_JIRA_REJECTED", "Rejected Jira issue after provider validation failed.", Object.assign({}, auditBase, { outcome: "invalid-jira" }));
    throw codedError("failed-precondition", "The Jira issue could not be validated.");
  }
  if (!issue || normalizeIssueKey(issue.issueKey) !== issueKey) {
    await appendAudit(options, "FIREBASE_MANUAL_JIRA_REJECTED", "Rejected Jira issue because it was not found.", Object.assign({}, auditBase, { outcome: "missing-jira" }));
    throw codedError("invalid-argument", "The Jira issue does not exist.");
  }

  var timestamp = formatSheetTimestamp(options.now || new Date(), options.timeZone || "Europe/Ljubljana");
  var target = {
    "Jira Issue Key": issueKey,
    "Jira Issue URL": buildJiraBrowserUrl(options.jiraBrowserBaseUrl || options.jiraBaseUrl, issueKey),
    "Jira Match Source": "manual",
    "Onboarding Complete": "Yes",
    "Last Checked": timestamp,
    "Jira Status": normalize(issue.status),
    "Lead Status": STATUS_MAP[normalize(issue.status).toLowerCase()] || "",
    "Last Jira Check": timestamp
  };
  var original = Object.fromEntries(WRITE_FIELDS.map(function (field) {
    return [field, snapshot.row[snapshot.indexes[field]] == null ? "" : snapshot.row[snapshot.indexes[field]]];
  }));
  var mutationWritten = false;

  try {
    var prewrite = await readLeadRow(options);
    if (rowVersion(prewrite.row) !== expectedVersion) {
      throw codedError("aborted", "The lead row changed immediately before the write and was not modified.");
    }
    await writeFields(options, snapshot, target);
    mutationWritten = true;
    var written = await readLeadRow(options);
    assertFields(written, target);
    var writtenVersion = rowVersion(written.row);
    var restoredVersion = "";

    if (options.restoreAfterVerify === true) {
      var prerestore = await readLeadRow(options);
      if (rowVersion(prerestore.row) !== writtenVersion) throw codedError("aborted", "The lead row changed before restoration.");
      await writeFields(options, snapshot, original);
      mutationWritten = false;
      var restored = await readLeadRow(options);
      restoredVersion = rowVersion(restored.row);
      if (restoredVersion !== expectedVersion) throw codedError("data-loss", "The original lead row could not be restored exactly.");
    }

    var result = {
      rowNumber: snapshot.rowNumber,
      restored: options.restoreAfterVerify === true,
      replayed: false,
      originalVersion: expectedVersion,
      writtenVersion: writtenVersion,
      restoredVersion: restoredVersion,
      idempotencyKey: idempotencyKey
    };
    await appendAudit(options, "FIREBASE_MANUAL_JIRA_COMPLETE", "Completed optimistic manual Jira link command.", Object.assign({}, auditBase, {
      outcome: "complete",
      restored: result.restored,
      writtenVersion: writtenVersion,
      restoredVersion: restoredVersion
    }));
    return result;
  } catch (error) {
    var restoredAfterFailure = false;
    if (mutationWritten) {
      try {
        var current = await readLeadRow(options);
        if (fieldsEqual(current, target)) {
          await writeFields(options, snapshot, original);
          restoredAfterFailure = rowVersion((await readLeadRow(options)).row) === expectedVersion;
        }
      } catch (_) {
        restoredAfterFailure = false;
      }
    }
    await appendAudit(options, "FIREBASE_MANUAL_JIRA_FAILED", "Firebase manual Jira link command failed.", Object.assign({}, auditBase, {
      outcome: "failed",
      restored: restoredAfterFailure,
      errorCode: normalize(error && error.code) || "internal"
    })).catch(function () {});
    throw error;
  }
}

async function readLeadRow(options) {
  assertDependencies(options);
  var rowNumber = Number(options.rowNumber);
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > 600) throw codedError("invalid-argument", "The lead row is invalid.");
  var response = await options.sheetsClient.spreadsheets.values.batchGet({
    spreadsheetId: options.spreadsheetId,
    ranges: [`'${LEAD_SHEET}'!A1:${MAX_COLUMNS}1`, `'${LEAD_SHEET}'!A${rowNumber}:${MAX_COLUMNS}${rowNumber}`],
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  var ranges = response && response.data && response.data.valueRanges || [];
  var headers = ranges[0] && ranges[0].values && ranges[0].values[0] || [];
  var row = ranges[1] && ranges[1].values && ranges[1].values[0] || [];
  if (!row.length) throw codedError("failed-precondition", "The selected lead row is empty.");
  var indexes = Object.fromEntries(headers.map(function (header, index) { return [normalize(header), index]; }));
  WRITE_FIELDS.forEach(function (field) {
    if (!Number.isInteger(indexes[field])) throw codedError("failed-precondition", `The Lead Studio Sheet is missing the ${field} column.`);
  });
  while (row.length < headers.length) row.push("");
  return { rowNumber: rowNumber, row: row, headers: headers, indexes: indexes };
}

async function writeFields(options, snapshot, values) {
  await options.sheetsClient.spreadsheets.values.batchUpdate({
    spreadsheetId: options.spreadsheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: WRITE_FIELDS.map(function (field) {
        return {
          range: `'${LEAD_SHEET}'!${columnName(snapshot.indexes[field] + 1)}${snapshot.rowNumber}`,
          values: [[values[field] == null ? "" : values[field]]]
        };
      })
    }
  });
}

function assertFields(snapshot, expected) {
  if (!fieldsEqual(snapshot, expected)) throw codedError("data-loss", "The manual Jira link update could not be verified.");
}

function fieldsEqual(snapshot, expected) {
  return WRITE_FIELDS.every(function (field) {
    return normalize(snapshot.row[snapshot.indexes[field]]) === normalize(expected[field]);
  });
}

async function findCompletedAudit(options, idempotencyKey) {
  var details = await auditLog.findEventDetails({
    sheetsClient: options.sheetsClient,
    spreadsheetId: options.spreadsheetId,
    eventName: "FIREBASE_MANUAL_JIRA_COMPLETE",
    idempotencyKey: idempotencyKey
  });
  return details ? {
    rowNumber: Number(details.rowNumber) || Number(options.rowNumber),
    restored: details.restored === true,
    replayed: true,
    originalVersion: normalize(details.expectedVersion),
    writtenVersion: normalize(details.writtenVersion),
    restoredVersion: normalize(details.restoredVersion),
    idempotencyKey: idempotencyKey
  } : null;
}

async function appendAudit(options, eventName, message, details) {
  await options.sheetsClient.spreadsheets.values.append({
    spreadsheetId: options.spreadsheetId,
    range: `'${DEBUG_LOG_SHEET}'!A:E`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[new Date().toISOString(), eventName, "leadStudioManualJiraV4", message, JSON.stringify(details)]] }
  });
}

function buildJiraUrl(baseUrl, issueKey) {
  var parsed;
  try { parsed = new URL(normalize(baseUrl)); } catch (_) { throw codedError("failed-precondition", "The Jira base URL is invalid."); }
  if (parsed.protocol !== "https:" || !parsed.hostname.toLowerCase().endsWith(".atlassian.net")) {
    throw codedError("failed-precondition", "The Jira base URL is invalid.");
  }
  return `${parsed.origin}/browse/${issueKey}`;
}

function buildJiraBrowserUrl(baseUrl, issueKey) {
  var parsed;
  try { parsed = new URL(normalize(baseUrl)); } catch (_) { throw codedError("failed-precondition", "The Jira browser URL is invalid."); }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.pathname !== "/") {
    throw codedError("failed-precondition", "The Jira browser URL is invalid.");
  }
  var hostname = parsed.hostname.toLowerCase();
  if (hostname !== "jira.at.semper7.net" && !hostname.endsWith(".atlassian.net")) {
    throw codedError("failed-precondition", "The Jira browser URL is invalid.");
  }
  return `${parsed.origin}/browse/${issueKey}`;
}

function formatSheetTimestamp(date, timeZone) {
  var parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).reduce(function (output, part) {
    output[part.type] = part.value;
    return output;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function rowVersion(row) {
  return crypto.createHash("sha256").update(JSON.stringify(Array.isArray(row) ? row : [])).digest("hex");
}

function normalizeIssueKey(value) {
  var match = normalize(value).toUpperCase().match(/^[A-Z][A-Z0-9]+-\d+$/);
  return match ? match[0] : "";
}

function normalizeManualIssueKey(value, baseUrl, browserBaseUrl) {
  var raw = normalize(value);
  var direct = normalizeIssueKey(raw);
  if (direct) return direct;

  var candidate;
  var allowedOrigins;
  try {
    candidate = new URL(raw);
    allowedOrigins = [baseUrl, browserBaseUrl].filter(Boolean).map(function (value) {
      return new URL(normalize(value)).origin;
    });
  } catch (_) {
    return "";
  }
  if (
    candidate.protocol !== "https:" ||
    !allowedOrigins.includes(candidate.origin) ||
    candidate.username ||
    candidate.password
  ) {
    return "";
  }
  var match = candidate.pathname.match(/^\/browse\/([A-Za-z][A-Za-z0-9]+-\d+)\/?$/);
  return match ? normalizeIssueKey(match[1]) : "";
}

function columnName(number) {
  var value = Number(number);
  var output = "";
  while (value > 0) {
    value -= 1;
    output = String.fromCharCode(65 + value % 26) + output;
    value = Math.floor(value / 26);
  }
  return output;
}

function assertDependencies(options) {
  if (!options || !options.sheetsClient || !normalize(options.spreadsheetId)) {
    throw codedError("failed-precondition", "Lead Studio manual Jira writes are not configured.");
  }
}

function codedError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  WRITE_FIELDS,
  buildJiraBrowserUrl,
  buildJiraUrl,
  executeManualJiraLink,
  formatSheetTimestamp,
  normalizeManualIssueKey,
  prepareManualJiraLink,
  rowVersion
};
