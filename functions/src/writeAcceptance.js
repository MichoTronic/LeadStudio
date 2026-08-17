"use strict";

var crypto = require("node:crypto");

var LEAD_SHEET = "Email Matches";
var DEBUG_LOG_SHEET = "Debug Log";
var MAX_COLUMNS = "AI";

async function prepareNotesRoundTrip(options) {
  var snapshot = await readLeadRow(options);
  return {
    rowNumber: snapshot.rowNumber,
    field: "Notes",
    rowVersion: rowVersion(snapshot.row)
  };
}

async function executeNotesRoundTrip(options) {
  var idempotencyKey = normalize(options && options.idempotencyKey);
  var expectedVersion = normalize(options && options.expectedVersion);
  var actor = normalize(options && options.actor).toLowerCase();
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) throw codedError("invalid-argument", "A valid idempotency key is required.");
  if (!/^[a-f0-9]{64}$/.test(expectedVersion)) throw codedError("invalid-argument", "A valid expected row version is required.");
  if (!actor) throw codedError("invalid-argument", "An authenticated actor is required.");

  var replay = await findCompletedAudit(options, idempotencyKey);
  if (replay) return replay;

  var snapshot = await readLeadRow(options);
  var observedVersion = rowVersion(snapshot.row);
  var auditBase = {
    actor: actor,
    command: "notes_round_trip",
    rowNumber: snapshot.rowNumber,
    idempotencyKey: idempotencyKey,
    expectedVersion: expectedVersion,
    observedVersion: observedVersion,
    changedFields: ["Notes"]
  };
  await appendAudit(options, "FIREBASE_WRITE_ACCEPTANCE_STARTED", "Started optimistic Notes round-trip.", Object.assign({}, auditBase, { outcome: "started" }));

  if (observedVersion !== expectedVersion) {
    await appendAudit(options, "FIREBASE_WRITE_ACCEPTANCE_REJECTED", "Rejected stale row version before mutation.", Object.assign({}, auditBase, { outcome: "conflict" }));
    throw codedError("aborted", "The lead row changed before the write and was not modified.");
  }

  var originalNotes = snapshot.row[snapshot.notesIndex] == null ? "" : snapshot.row[snapshot.notesIndex];
  var marker = `[Firebase V4 acceptance ${idempotencyKey}]`;
  var markerWritten = false;
  try {
    var prewrite = await readLeadRow(options);
    if (rowVersion(prewrite.row) !== expectedVersion) {
      throw codedError("aborted", "The lead row changed immediately before the write and was not modified.");
    }
    await writeNotes(options, snapshot, marker);
    markerWritten = true;
    var marked = await readLeadRow(options);
    if (normalize(marked.row[marked.notesIndex]) !== marker) throw codedError("data-loss", "The acceptance marker could not be verified.");
    var markerVersion = rowVersion(marked.row);

    var prerestore = await readLeadRow(options);
    if (rowVersion(prerestore.row) !== markerVersion) throw codedError("aborted", "The lead row changed before restoration.");
    await writeNotes(options, snapshot, originalNotes);
    markerWritten = false;
    var restored = await readLeadRow(options);
    var restoredVersion = rowVersion(restored.row);
    if (restoredVersion !== expectedVersion) throw codedError("data-loss", "The original lead row could not be restored exactly.");

    var success = {
      rowNumber: snapshot.rowNumber,
      field: "Notes",
      restored: true,
      replayed: false,
      originalVersion: expectedVersion,
      markerVersion: markerVersion,
      restoredVersion: restoredVersion,
      idempotencyKey: idempotencyKey
    };
    await appendAudit(options, "FIREBASE_WRITE_ACCEPTANCE_COMPLETE", "Completed and restored optimistic Notes round-trip.", Object.assign({}, auditBase, {
      outcome: "complete",
      restored: true,
      markerVersion: markerVersion,
      restoredVersion: restoredVersion
    }));
    return success;
  } catch (error) {
    var restoredAfterFailure = false;
    if (markerWritten) {
      try {
        var current = await readLeadRow(options);
        if (normalize(current.row[current.notesIndex]) === marker) {
          await writeNotes(options, snapshot, originalNotes);
          var recovery = await readLeadRow(options);
          restoredAfterFailure = recovery.row[recovery.notesIndex] === originalNotes;
        }
      } catch (_) {
        restoredAfterFailure = false;
      }
    }
    await appendAudit(options, "FIREBASE_WRITE_ACCEPTANCE_FAILED", "Firebase Notes round-trip failed.", Object.assign({}, auditBase, {
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
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || rowNumber > 600) throw codedError("invalid-argument", "The acceptance row is invalid.");
  var response = await options.sheetsClient.spreadsheets.values.batchGet({
    spreadsheetId: options.spreadsheetId,
    ranges: [`'${LEAD_SHEET}'!A1:${MAX_COLUMNS}1`, `'${LEAD_SHEET}'!A${rowNumber}:${MAX_COLUMNS}${rowNumber}`],
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  var ranges = response && response.data && response.data.valueRanges || [];
  var headers = ranges[0] && ranges[0].values && ranges[0].values[0] || [];
  var row = ranges[1] && ranges[1].values && ranges[1].values[0] || [];
  var notesIndex = headers.map(normalize).indexOf("Notes");
  if (notesIndex < 0) throw codedError("failed-precondition", "The Lead Studio Sheet is missing the Notes column.");
  if (!row.length) throw codedError("failed-precondition", "The selected acceptance row is empty.");
  while (row.length < headers.length) row.push("");
  return { rowNumber: rowNumber, row: row, headers: headers, notesIndex: notesIndex };
}

async function writeNotes(options, snapshot, value) {
  await options.sheetsClient.spreadsheets.values.update({
    spreadsheetId: options.spreadsheetId,
    range: `'${LEAD_SHEET}'!${columnName(snapshot.notesIndex + 1)}${snapshot.rowNumber}`,
    valueInputOption: "RAW",
    requestBody: { values: [[value]] }
  });
}

async function findCompletedAudit(options, idempotencyKey) {
  var response = await options.sheetsClient.spreadsheets.values.get({
    spreadsheetId: options.spreadsheetId,
    range: `'${DEBUG_LOG_SHEET}'!A1:E5000`,
    valueRenderOption: "FORMATTED_VALUE"
  });
  var values = response && response.data && response.data.values || [];
  for (var index = values.length - 1; index >= 0; index -= 1) {
    if (normalize(values[index][1]) !== "FIREBASE_WRITE_ACCEPTANCE_COMPLETE") continue;
    var details;
    try { details = JSON.parse(values[index][4] || "{}"); } catch (_) { details = {}; }
    if (normalize(details.idempotencyKey) !== idempotencyKey) continue;
    return {
      rowNumber: Number(details.rowNumber) || Number(options.rowNumber),
      field: "Notes",
      restored: details.restored === true,
      replayed: true,
      originalVersion: normalize(details.expectedVersion),
      markerVersion: normalize(details.markerVersion),
      restoredVersion: normalize(details.restoredVersion),
      idempotencyKey: idempotencyKey
    };
  }
  return null;
}

async function appendAudit(options, eventName, message, details) {
  await options.sheetsClient.spreadsheets.values.append({
    spreadsheetId: options.spreadsheetId,
    range: `'${DEBUG_LOG_SHEET}'!A:E`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[new Date().toISOString(), eventName, "leadStudioWriteAcceptanceV4", message, JSON.stringify(details)]] }
  });
}

function rowVersion(row) {
  return crypto.createHash("sha256").update(JSON.stringify(Array.isArray(row) ? row : [])).digest("hex");
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
    throw codedError("failed-precondition", "Lead Studio write acceptance is not configured.");
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
  DEBUG_LOG_SHEET,
  LEAD_SHEET,
  columnName,
  executeNotesRoundTrip,
  prepareNotesRoundTrip,
  rowVersion
};
