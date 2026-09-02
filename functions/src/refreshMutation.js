"use strict";

var crypto = require("node:crypto");
var auditLog = require("./auditLog");
var gmailLeadParser = require("./gmailLeadParser");
var onboardingSheet = require("./onboardingSheet");

var LEAD_SHEET = "Email Matches";
var DEBUG_LOG_SHEET = "Debug Log";
var MAX_COLUMNS = "AI";
var JIRA_BROWSER_BASE_URL = "https://jira.at.semper7.net";
var STATUS_MAP = Object.freeze({
  "01 new lead": "Lead",
  "02 qualified lead": "Qualified Leads",
  "06 active": "Active",
  "07 inactive": "Not Active",
  "08 customer archive": "Not Active"
});

async function readSnapshot(options) {
  assertDependencies(options);
  var response = await options.sheetsClient.spreadsheets.values.get({
    spreadsheetId: options.spreadsheetId,
    range: `'${LEAD_SHEET}'!A1:${MAX_COLUMNS}600`,
    valueRenderOption: "UNFORMATTED_VALUE"
  });
  var values = response && response.data && response.data.values || [];
  if (!values.length) throw codedError("failed-precondition", "The Lead Studio Sheet is empty.");
  var headers = values[0].map(normalize);
  assertHeaders(headers);
  var rows = values.slice(1).map(function (row) { return padRow(row, headers.length); });
  return { headers: headers, rows: rows, version: snapshotVersion(headers, rows) };
}

function collectIssueKeys(snapshot, lookup) {
  var indexes = headerIndexes(snapshot.headers);
  var seen = new Set();
  var keys = [];
  snapshot.rows.forEach(function (row) {
    var lead = rowLead(row, indexes);
    var form = onboardingSheet.findOnboardingRequest(lookup, lead);
    var key = normalizeIssueKey(value(row, indexes, "Jira Issue Key")) || normalizeIssueKey(form.match && form.match.jiraIssueKey);
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  });
  return keys.slice(0, 100);
}

function collectNewLeadContacts(snapshot, gmailLeadScan) {
  var indexes = headerIndexes(snapshot.headers);
  var existing = new Set(snapshot.rows.map(function (row) { return normalize(value(row, indexes, "Gmail Message ID")); }).filter(Boolean));
  var seenEmails = new Set();
  return (gmailLeadScan && Array.isArray(gmailLeadScan.acceptedMessages) ? gmailLeadScan.acceptedMessages : []).reduce(function (output, message) {
    var messageId = normalize(message && message.messageId);
    var email = normalize(message && message.contactEmail).toLowerCase();
    if (!messageId || existing.has(messageId) || !email || seenEmails.has(email)) return output;
    seenEmails.add(email);
    output.push(email);
    return output;
  }, []);
}

function buildRefreshPlan(options) {
  var snapshot = options.snapshot;
  var indexes = headerIndexes(snapshot.headers);
  var onboardingLookup = options.onboardingLookup || {};
  var mailLookup = buildOnboardingMailLookup(options.gmailOnboardingScan);
  var liveStatuses = options.liveStatuses || {};
  var jiraByEmail = options.jiraByEmail || {};
  var timestamp = formatTimestamp(options.now || new Date(), options.timeZone || "Europe/Ljubljana");
  var existingMessageIds = new Set();
  snapshot.rows.forEach(function (row) {
    var messageId = normalize(value(row, indexes, "Gmail Message ID"));
    if (messageId) existingMessageIds.add(messageId);
  });

  var conflicts = 0;
  var targetRows = snapshot.rows.map(function (original) {
    var row = original.slice();
    applyOnboardingMail(row, indexes, mailLookup);
    conflicts += applyLifecycle(row, indexes, onboardingLookup, liveStatuses, null, timestamp);
    return row;
  });

  var acceptedLeads = options.gmailLeadScan && Array.isArray(options.gmailLeadScan.acceptedMessages)
    ? options.gmailLeadScan.acceptedMessages : [];
  acceptedLeads.forEach(function (message) {
    var messageId = normalize(message && message.messageId);
    if (!messageId || existingMessageIds.has(messageId) || !message.values) return;
    existingMessageIds.add(messageId);
    var row = snapshot.headers.map(function (header) {
      return message.values[header] == null ? "" : message.values[header];
    });
    var email = normalize(message.contactEmail).toLowerCase();
    var discovered = jiraByEmail[email] || null;
    if (discovered && normalizeIssueKey(discovered.issueKey)) {
      setValue(row, indexes, "Jira Issue Key", normalizeIssueKey(discovered.issueKey));
      setValue(row, indexes, "Jira Issue URL", jiraUrl(discovered.issueKey));
      setValue(row, indexes, "Jira Match Source", "jira_search_fallback");
      setValue(row, indexes, "Jira Status", normalize(discovered.status));
      setValue(row, indexes, "Lead Status", mapLeadStatus(discovered.status));
      setValue(row, indexes, "Onboarding Complete", "Yes");
    }
    applyOnboardingMail(row, indexes, mailLookup);
    conflicts += applyLifecycle(row, indexes, onboardingLookup, liveStatuses, discovered, timestamp);
    targetRows.push(row);
  });

  var changedRows = [];
  var changedFieldCounts = {};
  snapshot.rows.forEach(function (original, index) {
    var target = targetRows[index];
    var fields = snapshot.headers.filter(function (header, column) {
      return comparable(original[column]) !== comparable(target[column]);
    });
    if (!fields.length) return;
    fields.forEach(function (field) { changedFieldCounts[field] = (changedFieldCounts[field] || 0) + 1; });
    changedRows.push({ rowNumber: index + 2, original: original, target: target, fields: fields });
  });
  var appendedRows = targetRows.slice(snapshot.rows.length).map(function (row, index) {
    return { rowNumber: snapshot.rows.length + index + 2, target: row };
  });

  return {
    headers: snapshot.headers.slice(),
    originalRows: snapshot.rows.map(function (row) { return row.slice(); }),
    targetRows: targetRows,
    originalVersion: snapshot.version,
    targetVersion: snapshotVersion(snapshot.headers, targetRows),
    changedRows: changedRows,
    appendedRows: appendedRows,
    summary: {
      sourceRows: snapshot.rows.length,
      targetRows: targetRows.length,
      changedRows: changedRows.length,
      appendedRows: appendedRows.length,
      changedFields: changedFieldCounts,
      jiraConflicts: conflicts
    }
  };
}

async function executeRefreshPlan(options) {
  var startedMs = Date.now();
  var plan = options.plan;
  var actor = normalize(options.actor).toLowerCase();
  var idempotencyKey = normalize(options.idempotencyKey);
  var expectedVersion = normalize(options.expectedVersion);
  if (!actor) throw codedError("invalid-argument", "An authenticated actor is required.");
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) throw codedError("invalid-argument", "A valid idempotency key is required.");
  if (!/^[a-f0-9]{64}$/.test(expectedVersion)) throw codedError("invalid-argument", "A valid expected snapshot version is required.");
  if (!plan || expectedVersion !== plan.originalVersion) throw codedError("aborted", "The prepared refresh snapshot is stale.");

  var auditEventPrefix = normalize(options.auditEventPrefix) || "FIREBASE_REFRESH";
  var auditSource = normalize(options.auditSource) || "leadStudioRefreshV5";
  var command = normalize(options.command) || (options.restoreAfterVerify === true ? "refresh_round_trip" : "refresh");
  var replay = await findCompletedAudit(options, idempotencyKey, `${auditEventPrefix}_COMPLETE`);
  if (replay) return replay;
  var auditBase = {
    actor: actor,
    command: command,
    idempotencyKey: idempotencyKey,
    expectedVersion: expectedVersion,
    observedVersion: plan.originalVersion,
    changedRows: plan.summary.changedRows,
    appendedRows: plan.summary.appendedRows,
    changedFields: plan.summary.changedFields
  };
  await appendAudit(options, `${auditEventPrefix}_STARTED`, "Started optimistic Firebase refresh command.", Object.assign({}, auditBase, { outcome: "started" }), auditSource);

  var prewrite = await readSnapshot(options);
  if (prewrite.version !== expectedVersion) {
    await appendAudit(options, `${auditEventPrefix}_REJECTED`, "Rejected stale Sheet snapshot before mutation.", Object.assign({}, auditBase, {
      outcome: "conflict",
      observedVersion: prewrite.version
    }), auditSource);
    throw codedError("aborted", "The Lead Studio Sheet changed before the refresh and was not modified.");
  }

  var mutationMayExist = false;
  try {
    mutationMayExist = plan.changedRows.length > 0 || plan.appendedRows.length > 0;
    await writePlan(options, plan);
    var written = await readSnapshot(options);
    if (written.version !== plan.targetVersion) throw codedError("data-loss", "The Firebase refresh could not be verified exactly.");
    var restoredVersion = "";
    if (options.restoreAfterVerify === true) {
      await restorePlan(options, plan);
      var restored = await readSnapshot(options);
      restoredVersion = restored.version;
      if (restoredVersion !== plan.originalVersion) throw codedError("data-loss", "The original Lead Studio snapshot could not be restored exactly.");
      mutationMayExist = false;
    }
    var result = {
      restored: options.restoreAfterVerify === true,
      replayed: false,
      originalVersion: plan.originalVersion,
      writtenVersion: plan.targetVersion,
      restoredVersion: restoredVersion,
      changedRows: plan.summary.changedRows,
      appendedRows: plan.summary.appendedRows,
      idempotencyKey: idempotencyKey
    };
    await appendAudit(options, `${auditEventPrefix}_COMPLETE`, "Completed optimistic Firebase refresh command.", Object.assign({}, auditBase, {
      outcome: "complete",
      restored: result.restored,
      writtenVersion: result.writtenVersion,
      restoredVersion: result.restoredVersion,
      durationMs: Date.now() - startedMs
    }), auditSource);
    return result;
  } catch (error) {
    var restoredAfterFailure = false;
    if (mutationMayExist) {
      try {
        var current = await readSnapshot(options);
        if (current.version === plan.originalVersion) {
          restoredAfterFailure = true;
        } else if (current.version === plan.targetVersion) {
          await restorePlan(options, plan);
          restoredAfterFailure = (await readSnapshot(options)).version === plan.originalVersion;
        }
      } catch (_) {
        restoredAfterFailure = false;
      }
    }
    await appendAudit(options, `${auditEventPrefix}_FAILED`, "Firebase refresh command failed.", Object.assign({}, auditBase, {
      outcome: "failed",
      restored: restoredAfterFailure,
      errorCode: normalize(error && error.code) || "internal",
      durationMs: Date.now() - startedMs
    }), auditSource).catch(function () {});
    throw error;
  }
}

function publicPlan(plan) {
  return {
    snapshotVersion: plan.originalVersion,
    targetVersion: plan.targetVersion,
    summary: plan.summary,
    rowNumbers: plan.changedRows.map(function (item) { return item.rowNumber; }),
    appendRowNumbers: plan.appendedRows.map(function (item) { return item.rowNumber; })
  };
}

function applyOnboardingMail(row, indexes, lookup) {
  var match = lookup[normalize(value(row, indexes, "Contact Email")).toLowerCase()];
  setValue(row, indexes, "Onboarding Sent", match && match.count ? String(match.count) : "");
  setValue(row, indexes, "Onboarding Sent At", match && match.latestAt ? match.latestAt : "");
  setValue(row, indexes, "Onboarding Message ID", match && match.messageIds.length ? match.messageIds.join(", ") : "");
}

function applyLifecycle(row, indexes, lookup, liveStatuses, discovered, timestamp) {
  var lead = rowLead(row, indexes);
  var form = onboardingSheet.findOnboardingRequest(lookup, lead);
  var match = form.match;
  var issueKey = normalizeIssueKey(value(row, indexes, "Jira Issue Key"));
  var source = normalize(value(row, indexes, "Jira Match Source"));
  var conflict = 0;
  if (match && match.jiraIssueKey) {
    if (!issueKey) {
      issueKey = normalizeIssueKey(match.jiraIssueKey);
      source = form.source === "email" ? "auto_onboarding_sheet" : "auto_onboarding_responsible_person";
    } else if (issueKey === normalizeIssueKey(match.jiraIssueKey)) {
      source = source || (form.source === "email" ? "auto_onboarding_sheet" : "auto_onboarding_responsible_person");
    } else {
      conflict = 1;
    }
    setValue(row, indexes, "Onboarding Submitted At", match.submittedAt);
    setValue(row, indexes, "Onboarding Sheet Row", match.rowNumber ? String(match.rowNumber) : "");
    setValue(row, indexes, "Target Region", match.targetRegion);
    setValue(row, indexes, "Info Sheet", match.infoSheetUrl);
    setValue(row, indexes, "Onboarding Doc", match.onboardingDocUrl);
  }
  if (!issueKey) {
    setValue(row, indexes, "Onboarding Complete", "No");
    return conflict;
  }
  var jira = liveStatuses[issueKey] || (discovered && normalizeIssueKey(discovered.issueKey) === issueKey ? discovered : null) || {};
  setValue(row, indexes, "Jira Issue Key", issueKey);
  setValue(row, indexes, "Jira Issue URL", jiraUrl(issueKey));
  setValue(row, indexes, "Jira Match Source", source || "existing_key");
  setValue(row, indexes, "Onboarding Complete", "Yes");
  setValue(row, indexes, "Last Checked", timestamp);
  setValue(row, indexes, "Jira Status", normalize(jira.status));
  setValue(row, indexes, "Lead Status", mapLeadStatus(jira.status));
  setValue(row, indexes, "Last Jira Check", timestamp);
  return conflict;
}

function buildOnboardingMailLookup(scan) {
  var lookup = {};
  var accepted = scan && Array.isArray(scan.acceptedMessages) ? scan.acceptedMessages : [];
  accepted.forEach(function (message) {
    var key = normalize(message && message.contactEmail).toLowerCase();
    if (!key) return;
    if (!lookup[key]) lookup[key] = { count: 0, latestAt: "", messageIds: [], seen: new Set() };
    var entry = lookup[key];
    entry.count += 1;
    entry.count = Math.max(entry.count, Number(message.countHint) || 0);
    var date = normalize(message.emailDate);
    if (date && date > entry.latestAt) entry.latestAt = date;
    var id = normalize(message.messageId);
    if (id && !entry.seen.has(id)) {
      entry.seen.add(id);
      entry.messageIds.push(id);
    }
  });
  Object.keys(lookup).forEach(function (key) { delete lookup[key].seen; });
  return lookup;
}

async function writePlan(options, plan) {
  var data = plan.changedRows.map(function (item) {
    return { range: `'${LEAD_SHEET}'!A${item.rowNumber}:${MAX_COLUMNS}${item.rowNumber}`, values: [item.target] };
  }).concat(plan.appendedRows.map(function (item) {
    return { range: `'${LEAD_SHEET}'!A${item.rowNumber}:${MAX_COLUMNS}${item.rowNumber}`, values: [item.target] };
  }));
  if (!data.length) return;
  await options.sheetsClient.spreadsheets.values.batchUpdate({
    spreadsheetId: options.spreadsheetId,
    requestBody: { valueInputOption: "RAW", data: data }
  });
}

async function restorePlan(options, plan) {
  var data = plan.changedRows.map(function (item) {
    return { range: `'${LEAD_SHEET}'!A${item.rowNumber}:${MAX_COLUMNS}${item.rowNumber}`, values: [item.original] };
  });
  if (data.length) {
    await options.sheetsClient.spreadsheets.values.batchUpdate({
      spreadsheetId: options.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: data }
    });
  }
  if (plan.appendedRows.length) {
    var first = plan.appendedRows[0].rowNumber;
    var last = plan.appendedRows[plan.appendedRows.length - 1].rowNumber;
    await options.sheetsClient.spreadsheets.values.batchClear({
      spreadsheetId: options.spreadsheetId,
      requestBody: { ranges: [`'${LEAD_SHEET}'!A${first}:${MAX_COLUMNS}${last}`] }
    });
  }
}

async function findCompletedAudit(options, idempotencyKey, completeEventName) {
  var details = await auditLog.findEventDetails({
    sheetsClient: options.sheetsClient,
    spreadsheetId: options.spreadsheetId,
    eventName: normalize(completeEventName) || "FIREBASE_REFRESH_COMPLETE",
    idempotencyKey: idempotencyKey
  });
  return details ? {
    restored: details.restored === true,
    replayed: true,
    originalVersion: normalize(details.expectedVersion),
    writtenVersion: normalize(details.writtenVersion),
    restoredVersion: normalize(details.restoredVersion),
    changedRows: Number(details.changedRows) || 0,
    appendedRows: Number(details.appendedRows) || 0,
    idempotencyKey: idempotencyKey
  } : null;
}

async function appendAudit(options, eventName, message, details, source) {
  await options.sheetsClient.spreadsheets.values.append({
    spreadsheetId: options.spreadsheetId,
    range: `'${DEBUG_LOG_SHEET}'!A:E`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [[new Date().toISOString(), eventName, normalize(source) || "leadStudioRefreshV5", message, JSON.stringify(details)]] }
  });
}

function rowLead(row, indexes) {
  return {
    name: normalize(value(row, indexes, "Name")),
    lastName: normalize(value(row, indexes, "Last Name")),
    contactEmail: normalize(value(row, indexes, "Contact Email"))
  };
}

function headerIndexes(headers) {
  return Object.fromEntries(headers.map(function (header, index) { return [normalize(header), index]; }));
}

function value(row, indexes, field) {
  var index = indexes[field];
  return Number.isInteger(index) ? row[index] : "";
}

function setValue(row, indexes, field, next) {
  var index = indexes[field];
  if (Number.isInteger(index)) row[index] = next == null ? "" : next;
}

function snapshotVersion(headers, rows) {
  return crypto.createHash("sha256").update(JSON.stringify([headers, rows])).digest("hex");
}

function scheduledIdempotencyKey(scheduleTime) {
  var valueToHash = normalize(scheduleTime);
  if (!valueToHash) throw codedError("invalid-argument", "A scheduled refresh time is required.");
  return `scheduled_${crypto.createHash("sha256").update(valueToHash).digest("hex").slice(0, 32)}`;
}

function formatTimestamp(date, timeZone) {
  var parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date).reduce(function (output, part) { output[part.type] = part.value; return output; }, {});
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function mapLeadStatus(status) {
  return STATUS_MAP[normalize(status).toLowerCase()] || "";
}

function jiraUrl(issueKey) {
  var key = normalizeIssueKey(issueKey);
  return key ? `${JIRA_BROWSER_BASE_URL}/browse/${key}` : "";
}

function normalizeIssueKey(valueToNormalize) {
  var match = normalize(valueToNormalize).toUpperCase().match(/^[A-Z][A-Z0-9]+-\d+$/);
  return match ? match[0] : "";
}

function comparable(valueToCompare) {
  return valueToCompare == null ? "" : String(valueToCompare);
}

function padRow(row, length) {
  var output = Array.isArray(row) ? row.slice(0, length) : [];
  while (output.length < length) output.push("");
  return output;
}

function assertHeaders(headers) {
  gmailLeadParser.APPEND_HEADERS.forEach(function (header) {
    if (!headers.includes(header)) throw codedError("failed-precondition", `The Lead Studio Sheet is missing the ${header} column.`);
  });
}

function assertDependencies(options) {
  if (!options || !options.sheetsClient || !normalize(options.spreadsheetId)) {
    throw codedError("failed-precondition", "Lead Studio refresh writes are not configured.");
  }
}

function codedError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function normalize(valueToNormalize) {
  return String(valueToNormalize == null ? "" : valueToNormalize).trim();
}

module.exports = {
  DEBUG_LOG_SHEET,
  LEAD_SHEET,
  buildOnboardingMailLookup,
  buildRefreshPlan,
  collectIssueKeys,
  collectNewLeadContacts,
  executeRefreshPlan,
  publicPlan,
  readSnapshot,
  scheduledIdempotencyKey,
  snapshotVersion
};
