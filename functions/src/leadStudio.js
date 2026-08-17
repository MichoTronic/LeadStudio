"use strict";

var HttpsError = require("firebase-functions/v2/https").HttpsError;

var CENTRAL_VERIFIER_URL = "https://europe-west1-timeless-studio-auth.cloudfunctions.net/verifyStudioAccess";
var STUDIO_ID = "lead-studio";
var LEAD_SHEET = "Email Matches";
var LEAD_RANGE = `'${LEAD_SHEET}'!A1:AI600`;
var MAX_LEADS = 500;
var SETTINGS_ACTIONS = new Set(["gmailProbe"]);
var PUBLIC_FIELDS = Object.freeze({
  "Email Date": "emailDate",
  "Name": "name",
  "Last Name": "lastName",
  "Contact Email": "contactEmail",
  "Business Type": "businessType",
  "Company Name": "companyName",
  "Interested in": "interestedIn",
  "Language": "language",
  "Onboarding Sent": "onboardingSent",
  "Onboarding Sent At": "onboardingSentAt",
  "Jira Issue Key": "jiraIssueKey",
  "Jira Status": "jiraStatus",
  "Onboarding Complete": "onboardingComplete",
  "Last Jira Check": "lastJiraCheck",
  "Last Checked": "lastChecked",
  "Jira Issue URL": "jiraIssueUrl",
  "Lead Status": "leadStatus",
  "Onboarding Submitted At": "onboardingSubmittedAt",
  "Target Region": "targetRegion"
});

async function verifyAccess(idToken, requiredScope, options) {
  options = options || {};
  var fetchImpl = options.fetchImpl || fetch;
  var verifierUrl = options.verifierUrl || CENTRAL_VERIFIER_URL;
  var token = normalize(idToken);
  if (!token) throw new HttpsError("unauthenticated", "Timeless Studio authorization is required.");

  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timeout = controller ? setTimeout(function () { controller.abort(); }, 5000) : null;
  var response;
  try {
    response = await fetchImpl(verifierUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: token,
        studioId: STUDIO_ID,
        requiredScope: requiredScope || "read"
      }),
      signal: controller ? controller.signal : undefined
    });
  } catch (_) {
    throw new HttpsError("unavailable", "Timeless Studio authorization could not be reached.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  var body = await response.json().catch(function () { return {}; });
  if (!response.ok || body.allowed !== true || !body.email) {
    throw new HttpsError("permission-denied", body.message || "This account cannot use Lead Studio.");
  }
  return body;
}

async function runAction(request, dependencies) {
  dependencies = dependencies || {};
  var data = request && request.data || {};
  var action = normalize(data.action);
  var authorization = await verifyAccess(
    data.studioAuthToken,
    SETTINGS_ACTIONS.has(action) ? "settings" : "read",
    dependencies
  );

  if (action === "probe") {
    return {
      status: "ok",
      mode: "read-only-pilot",
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "bootstrap") {
    var result = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId);
    return {
      mode: "read-only-pilot",
      leads: result.leads,
      metadata: result.metadata,
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "gmailProbe") {
    if (typeof dependencies.gmailProbe !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio Gmail access is not configured.");
    }
    return {
      mode: "read-only-pilot",
      mailbox: await dependencies.gmailProbe(),
      authorization: publicAuthorization(authorization)
    };
  }
  throw new HttpsError("invalid-argument", "Unsupported Lead Studio action.");
}

async function loadLeads(sheetsClient, spreadsheetId) {
  assertSheetDependencies(sheetsClient, spreadsheetId);
  var response = await sheetsClient.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    range: LEAD_RANGE,
    valueRenderOption: "FORMATTED_VALUE"
  });
  var values = response && response.data && response.data.values || [];
  if (!values.length) return { leads: [], metadata: { totalRows: 0, returnedRows: 0 } };

  var headers = values[0].map(normalize);
  assertRequiredHeaders(headers);
  var leads = values.slice(1).map(function (row, index) {
    return mapLead(headers, row, index + 2);
  }).filter(function (lead) {
    return lead.name || lead.lastName || lead.contactEmail || lead.companyName;
  }).slice(0, MAX_LEADS);

  return {
    leads: leads,
    metadata: {
      source: LEAD_SHEET,
      totalRows: Math.max(values.length - 1, 0),
      returnedRows: leads.length,
      truncated: values.length - 1 > MAX_LEADS,
      loadedAt: new Date().toISOString()
    }
  };
}

function mapLead(headers, row, rowNumber) {
  var lead = { rowNumber: rowNumber };
  Object.keys(PUBLIC_FIELDS).forEach(function (header) {
    var index = headers.indexOf(header);
    lead[PUBLIC_FIELDS[header]] = index >= 0 ? normalize(row[index]) : "";
  });
  return lead;
}

function assertRequiredHeaders(headers) {
  ["Email Date", "Contact Email", "Company Name", "Lead Status"].forEach(function (header) {
    if (!headers.includes(header)) {
      throw new HttpsError("failed-precondition", `Lead Studio sheet is missing the ${header} column.`);
    }
  });
}

function publicAuthorization(authorization) {
  return {
    email: normalize(authorization.email).toLowerCase(),
    role: normalize(authorization.role),
    scopes: Array.isArray(authorization.scopes) ? authorization.scopes.map(normalize).filter(Boolean) : []
  };
}

function assertSheetDependencies(sheetsClient, spreadsheetId) {
  if (!sheetsClient || !normalize(spreadsheetId)) {
    throw new HttpsError("failed-precondition", "Lead Studio sheet access is not configured.");
  }
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  CENTRAL_VERIFIER_URL,
  LEAD_RANGE,
  LEAD_SHEET,
  MAX_LEADS,
  PUBLIC_FIELDS,
  SETTINGS_ACTIONS,
  STUDIO_ID,
  assertRequiredHeaders,
  loadLeads,
  mapLead,
  publicAuthorization,
  runAction,
  verifyAccess
};
