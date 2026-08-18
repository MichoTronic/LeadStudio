"use strict";

var crypto = require("node:crypto");
var gmailLeadParser = require("./gmailLeadParser");
var refreshMutation = require("./refreshMutation");

function buildIncrementalPlan(options) {
  options = options || {};
  var snapshot = options.snapshot;
  if (!snapshot || !Array.isArray(snapshot.headers) || !Array.isArray(snapshot.rows)) {
    throw new Error("A Lead Studio Sheet snapshot is required.");
  }
  gmailLeadParser.APPEND_HEADERS.forEach(function (header) {
    if (!snapshot.headers.includes(header)) throw new Error(`The Lead Studio Sheet is missing the ${header} column.`);
  });
  var indexes = Object.fromEntries(snapshot.headers.map(function (header, index) { return [normalize(header), index]; }));
  var targetRows = snapshot.rows.map(function (row) { return row.slice(); });
  var existingLeadIds = new Set(targetRows.map(function (row) {
    return normalize(value(row, indexes, "Gmail Message ID"));
  }).filter(Boolean));

  (Array.isArray(options.leadMessages) ? options.leadMessages : []).forEach(function (message) {
    var messageId = normalize(message && message.messageId);
    if (!messageId || existingLeadIds.has(messageId) || !message.values) return;
    existingLeadIds.add(messageId);
    targetRows.push(snapshot.headers.map(function (header) {
      return message.values[header] == null ? "" : message.values[header];
    }));
  });

  var onboardingByEmail = buildOnboardingLookup(options.onboardingMessages);
  targetRows.forEach(function (row) {
    var email = normalize(value(row, indexes, "Contact Email")).toLowerCase();
    var incoming = onboardingByEmail[email];
    if (!incoming) return;
    mergeOnboarding(row, indexes, incoming);
  });

  var changedRows = [];
  var changedFieldCounts = {};
  snapshot.rows.forEach(function (original, index) {
    var target = targetRows[index];
    var fields = snapshot.headers.filter(function (_, column) {
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
    targetVersion: refreshMutation.snapshotVersion(snapshot.headers, targetRows),
    changedRows: changedRows,
    appendedRows: appendedRows,
    summary: {
      sourceRows: snapshot.rows.length,
      targetRows: targetRows.length,
      changedRows: changedRows.length,
      appendedRows: appendedRows.length,
      changedFields: changedFieldCounts,
      jiraConflicts: 0
    }
  };
}

function buildOnboardingLookup(messages) {
  var lookup = {};
  (Array.isArray(messages) ? messages : []).forEach(function (message) {
    var email = normalize(message && message.contactEmail).toLowerCase();
    var messageId = normalize(message && message.messageId);
    if (!email || !messageId) return;
    if (!lookup[email]) lookup[email] = { messageIds: [], latestAt: "", countHint: 0 };
    if (!lookup[email].messageIds.includes(messageId)) lookup[email].messageIds.push(messageId);
    var emailDate = normalize(message.emailDate);
    if (emailDate && emailDate > lookup[email].latestAt) lookup[email].latestAt = emailDate;
    lookup[email].countHint = Math.max(lookup[email].countHint, Number(message.countHint) || 0);
  });
  return lookup;
}

function mergeOnboarding(row, indexes, incoming) {
  var existingIds = normalize(value(row, indexes, "Onboarding Message ID")).split(",")
    .map(normalize).filter(Boolean);
  var seen = new Set(existingIds);
  var newCount = 0;
  incoming.messageIds.forEach(function (messageId) {
    if (seen.has(messageId)) return;
    seen.add(messageId);
    existingIds.push(messageId);
    newCount += 1;
  });
  if (!newCount) return;
  var existingCount = Number(value(row, indexes, "Onboarding Sent")) || 0;
  setValue(row, indexes, "Onboarding Sent", String(Math.max(existingCount + newCount, incoming.countHint || 0)));
  setValue(row, indexes, "Onboarding Message ID", existingIds.join(", "));
  var existingAt = normalize(value(row, indexes, "Onboarding Sent At"));
  if (incoming.latestAt && incoming.latestAt > existingAt) setValue(row, indexes, "Onboarding Sent At", incoming.latestAt);
}

function pushIdempotencyKey(startHistoryId, endHistoryId) {
  var start = normalize(startHistoryId);
  var end = normalize(endHistoryId);
  if (!start || !end) throw new Error("Gmail push cursors are required.");
  return `gmailpush_${crypto.createHash("sha256").update(`${start}:${end}`).digest("hex").slice(0, 32)}`;
}

function value(row, indexes, field) {
  var index = indexes[field];
  return Number.isInteger(index) ? row[index] : "";
}

function setValue(row, indexes, field, next) {
  var index = indexes[field];
  if (Number.isInteger(index)) row[index] = next == null ? "" : next;
}

function comparable(valueToCompare) {
  return valueToCompare == null ? "" : String(valueToCompare);
}

function normalize(valueToNormalize) {
  return String(valueToNormalize == null ? "" : valueToNormalize).trim();
}

module.exports = {
  buildIncrementalPlan,
  buildOnboardingLookup,
  mergeOnboarding,
  pushIdempotencyKey
};
