"use strict";

var COLUMNS = Object.freeze({
  timestamp: "Timestamp",
  targetRegion: "Operating Markets",
  responsiblePerson: "Responsible Person",
  emailAddress: "Email Address",
  jiraIssueKey: "JIRA task ID"
});
var TARGET_REGIONS = Object.freeze(["ROW", "Asia", "LATAM"]);

function buildOnboardingLookup(values) {
  values = Array.isArray(values) ? values : [];
  var lookup = { byEmail: {}, byResponsiblePerson: {}, eligibleRows: 0 };
  if (values.length < 2) return lookup;
  var headers = values[0].map(normalize);
  var indexes = Object.fromEntries(headers.map(function (header, index) { return [header, index]; }));
  values.slice(1).forEach(function (row, index) {
    var match = {
      rowNumber: index + 2,
      submittedAt: cell(row, indexes, COLUMNS.timestamp),
      targetRegion: normalizeTargetRegion(cell(row, indexes, COLUMNS.targetRegion)),
      responsiblePerson: cell(row, indexes, COLUMNS.responsiblePerson),
      email: cell(row, indexes, COLUMNS.emailAddress),
      jiraIssueKey: normalizeIssueKey(cell(row, indexes, COLUMNS.jiraIssueKey))
    };
    if (!match.jiraIssueKey) return;
    lookup.eligibleRows += 1;
    keepNewest(lookup.byEmail, normalize(match.email).toLowerCase(), match);
    keepNewest(lookup.byResponsiblePerson, normalizePerson(match.responsiblePerson), match);
  });
  return lookup;
}

function findOnboardingRequest(lookup, lead) {
  lookup = lookup || {};
  var emailKey = normalize(lead && lead.contactEmail).toLowerCase();
  var nameKey = normalizePerson([lead && lead.name, lead && lead.lastName].map(normalize).filter(Boolean).join(" "));
  if (emailKey && lookup.byEmail && lookup.byEmail[emailKey]) {
    return { match: lookup.byEmail[emailKey], source: "email" };
  }
  if (nameKey && lookup.byResponsiblePerson && lookup.byResponsiblePerson[nameKey]) {
    return { match: lookup.byResponsiblePerson[nameKey], source: "responsiblePerson" };
  }
  return { match: null, source: "" };
}

function keepNewest(target, key, match) {
  if (!key) return;
  var current = target[key];
  if (!current || compareMatches(match, current) > 0) target[key] = match;
}

function compareMatches(left, right) {
  var leftTime = Date.parse(normalize(left && left.submittedAt)) || 0;
  var rightTime = Date.parse(normalize(right && right.submittedAt)) || 0;
  return leftTime !== rightTime ? leftTime - rightTime : Number(left && left.rowNumber) - Number(right && right.rowNumber);
}

function cell(row, indexes, header) {
  var index = indexes[header];
  return index == null ? "" : normalize(row && row[index]);
}

function normalizeTargetRegion(value) {
  var seen = new Set();
  return normalize(value).split(",").map(normalize).map(function (part) {
    var match = TARGET_REGIONS.find(function (option) { return option.toLowerCase() === part.toLowerCase(); });
    if (!match || seen.has(match)) return "";
    seen.add(match);
    return match;
  }).filter(Boolean).join(", ");
}

function normalizePerson(value) {
  return normalize(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeIssueKey(value) {
  var match = normalize(value).toUpperCase().match(/^[A-Z][A-Z0-9]+-\d+$/);
  return match ? match[0] : "";
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  COLUMNS,
  TARGET_REGIONS,
  buildOnboardingLookup,
  findOnboardingRequest,
  normalizePerson,
  normalizeTargetRegion
};
