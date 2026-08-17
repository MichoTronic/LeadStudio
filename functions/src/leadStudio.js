"use strict";

var HttpsError = require("firebase-functions/v2/https").HttpsError;
var onboardingSheet = require("./onboardingSheet");

var CENTRAL_VERIFIER_URL = "https://europe-west1-timeless-studio-auth.cloudfunctions.net/verifyStudioAccess";
var STUDIO_ID = "lead-studio";
var LEAD_SHEET = "Email Matches";
var LEAD_RANGE = `'${LEAD_SHEET}'!A1:AI600`;
var MAX_LEADS = 500;
var SETTINGS_ACTIONS = new Set([
  "gmailProbe", "gmailLeadParity", "gmailDeepLeadParity", "gmailOnboardingParity", "onboardingSheetProbe", "onboardingSheetParity", "jiraProbe", "jiraStatusParity",
  "jiraDiscoveryParity", "jiraDirectLookupParity", "refreshDryRun"
]);
var INTERNAL_FIELDS = Object.freeze({
  "Gmail Message ID": "gmailMessageId",
  "Onboarding Message ID": "onboardingMessageId",
  "Onboarding Sheet Row": "onboardingSheetRow"
});
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
  if (action === "gmailLeadParity") {
    if (typeof dependencies.gmailLeadScan !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio Gmail scanning is not configured.");
    }
    var gmailSheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId, { includeInternal: true });
    var gmailScan = await dependencies.gmailLeadScan();
    return {
      mode: "read-only-pilot",
      gmailLeadParity: compareGmailLeads(gmailSheetResult.leads, gmailScan),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "gmailDeepLeadParity") {
    if (typeof dependencies.gmailDeepLeadScan !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio deep Gmail scanning is not configured.");
    }
    var deepGmailSheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId, { includeInternal: true });
    var deepGmailScan = await dependencies.gmailDeepLeadScan();
    return {
      mode: "read-only-pilot",
      gmailDeepLeadParity: compareGmailLeads(deepGmailSheetResult.leads, deepGmailScan),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "gmailOnboardingParity") {
    if (typeof dependencies.gmailOnboardingScan !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio Gmail onboarding scanning is not configured.");
    }
    var onboardingSheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId, { includeInternal: true });
    var onboardingScan = await dependencies.gmailOnboardingScan();
    return {
      mode: "read-only-pilot",
      gmailOnboardingParity: compareGmailOnboarding(onboardingSheetResult.leads, onboardingScan),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "onboardingSheetProbe") {
    if (typeof dependencies.onboardingSheetProbe !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio onboarding Sheet access is not configured.");
    }
    return {
      mode: "read-only-pilot",
      onboardingSheet: await dependencies.onboardingSheetProbe(),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "onboardingSheetParity") {
    if (typeof dependencies.onboardingSheetRows !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio onboarding Sheet reads are not configured.");
    }
    var onboardingLeadResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId, { includeInternal: true });
    var onboardingLookup = onboardingSheet.buildOnboardingLookup(await dependencies.onboardingSheetRows());
    return {
      mode: "read-only-pilot",
      onboardingSheetParity: compareOnboardingSheet(onboardingLeadResult.leads, onboardingLookup),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "jiraProbe") {
    if (typeof dependencies.jiraProbe !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio Jira access is not configured.");
    }
    return {
      mode: "read-only-pilot",
      jira: await dependencies.jiraProbe(),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "jiraStatusParity") {
    if (typeof dependencies.jiraIssueStatuses !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio Jira status access is not configured.");
    }
    var sheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId);
    var baseline = jiraStatusBaseline(sheetResult.leads);
    var liveStatuses = await dependencies.jiraIssueStatuses(baseline.issueKeys);
    return {
      mode: "read-only-pilot",
      jiraParity: compareJiraStatuses(baseline.statuses, liveStatuses),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "jiraDiscoveryParity") {
    if (typeof dependencies.jiraIssueForEmail !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio Jira discovery is not configured.");
    }
    var discoverySheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId);
    var candidates = jiraDiscoveryCandidates(discoverySheetResult.leads, 12);
    var discoveryResults = [];
    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = candidates[index];
      discoveryResults.push({
        rowNumber: candidate.rowNumber,
        sheetIssueKey: candidate.sheetIssueKey,
        jira: await dependencies.jiraIssueForEmail(candidate.contactEmail)
      });
    }
    return {
      mode: "read-only-pilot",
      jiraDiscoveryParity: compareJiraDiscovery(discoveryResults),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "jiraDirectLookupParity") {
    if (typeof dependencies.jiraIssueByKey !== "function") {
      throw new HttpsError("failed-precondition", "Lead Studio direct Jira lookup is not configured.");
    }
    var directSheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId);
    var directBaseline = jiraStatusBaseline(directSheetResult.leads);
    var directKeys = directBaseline.issueKeys.slice(0, 12);
    var directStatuses = {};
    for (var directIndex = 0; directIndex < directKeys.length; directIndex += 1) {
      var issue = await dependencies.jiraIssueByKey(directKeys[directIndex]);
      if (issue) directStatuses[issue.issueKey] = issue;
    }
    var selectedBaseline = Object.fromEntries(directKeys.map(function (key) {
      return [key, directBaseline.statuses[key]];
    }));
    return {
      mode: "read-only-pilot",
      jiraDirectLookupParity: compareJiraStatuses(selectedBaseline, directStatuses),
      authorization: publicAuthorization(authorization)
    };
  }
  if (action === "refreshDryRun") {
    ["gmailLeadScan", "gmailOnboardingScan", "onboardingSheetRows", "jiraIssueStatuses"].forEach(function (dependency) {
      if (typeof dependencies[dependency] !== "function") {
        throw new HttpsError("failed-precondition", `Lead Studio refresh dry-run dependency ${dependency} is not configured.`);
      }
    });
    var refreshSheetResult = await loadLeads(dependencies.sheetsClient, dependencies.spreadsheetId, { includeInternal: true });
    var refreshInputs = await Promise.all([
      dependencies.gmailLeadScan(),
      dependencies.gmailOnboardingScan(),
      dependencies.onboardingSheetRows()
    ]);
    var refreshLookup = onboardingSheet.buildOnboardingLookup(refreshInputs[2]);
    var refreshKeys = plannedJiraKeys(refreshSheetResult.leads, refreshLookup);
    var refreshStatuses = await dependencies.jiraIssueStatuses(refreshKeys.issueKeys);
    return {
      mode: "read-only-refresh-dry-run",
      refreshDryRun: buildRefreshDryRun(
        refreshSheetResult,
        refreshInputs[0],
        refreshInputs[1],
        refreshLookup,
        refreshKeys,
        refreshStatuses
      ),
      authorization: publicAuthorization(authorization)
    };
  }
  throw new HttpsError("invalid-argument", "Unsupported Lead Studio action.");
}

async function loadLeads(sheetsClient, spreadsheetId, options) {
  options = options || {};
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
    return mapLead(headers, row, index + 2, options.includeInternal === true);
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

function mapLead(headers, row, rowNumber, includeInternal) {
  var lead = { rowNumber: rowNumber };
  Object.keys(PUBLIC_FIELDS).forEach(function (header) {
    var index = headers.indexOf(header);
    lead[PUBLIC_FIELDS[header]] = index >= 0 ? normalize(row[index]) : "";
  });
  if (includeInternal) {
    Object.keys(INTERNAL_FIELDS).forEach(function (header) {
      var index = headers.indexOf(header);
      lead[INTERNAL_FIELDS[header]] = index >= 0 ? normalize(row[index]) : "";
    });
  }
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

function jiraStatusBaseline(leads) {
  var statuses = {};
  (Array.isArray(leads) ? leads : []).forEach(function (lead) {
    var key = normalizeIssueKey(lead && lead.jiraIssueKey);
    if (!key || Object.hasOwn(statuses, key)) return;
    statuses[key] = normalize(lead && lead.jiraStatus);
  });
  var issueKeys = Object.keys(statuses).slice(0, 100);
  return {
    issueKeys: issueKeys,
    statuses: Object.fromEntries(issueKeys.map(function (key) { return [key, statuses[key]]; }))
  };
}

function compareJiraStatuses(sheetStatuses, liveStatuses) {
  sheetStatuses = sheetStatuses || {};
  liveStatuses = liveStatuses || {};
  var matched = 0;
  var blankInSheet = [];
  var missingInJira = [];
  var mismatches = [];
  Object.keys(sheetStatuses).slice(0, 100).forEach(function (key) {
    var sheetStatus = normalize(sheetStatuses[key]);
    var live = liveStatuses[key];
    if (!live) {
      missingInJira.push(key);
    } else if (!sheetStatus) {
      blankInSheet.push({ issueKey: key, jiraStatus: normalize(live.status) });
    } else if (sheetStatus.toLowerCase() === normalize(live.status).toLowerCase()) {
      matched += 1;
    } else {
      mismatches.push({ issueKey: key, sheetStatus: sheetStatus, jiraStatus: normalize(live.status) });
    }
  });
  return {
    checkedKeys: Object.keys(sheetStatuses).slice(0, 100).length,
    matchedStatuses: matched,
    blankInSheet: blankInSheet,
    missingInJira: missingInJira,
    mismatches: mismatches,
    checkedAt: new Date().toISOString()
  };
}

function jiraDiscoveryCandidates(leads, limit) {
  var seenEmails = new Set();
  var candidates = [];
  (Array.isArray(leads) ? leads : []).some(function (lead) {
    var contactEmail = normalize(lead && lead.contactEmail).toLowerCase();
    var sheetIssueKey = normalizeIssueKey(lead && lead.jiraIssueKey);
    if (!contactEmail || !sheetIssueKey || seenEmails.has(contactEmail)) return false;
    seenEmails.add(contactEmail);
    candidates.push({
      rowNumber: Number(lead.rowNumber) || 0,
      contactEmail: contactEmail,
      sheetIssueKey: sheetIssueKey
    });
    return candidates.length >= Math.max(0, Number(limit) || 0);
  });
  return candidates;
}

function compareJiraDiscovery(results) {
  var matched = 0;
  var notFound = [];
  var mismatches = [];
  (Array.isArray(results) ? results : []).forEach(function (result) {
    var foundKey = normalizeIssueKey(result && result.jira && result.jira.issueKey);
    if (!foundKey) {
      notFound.push({ rowNumber: Number(result && result.rowNumber) || 0, sheetIssueKey: normalizeIssueKey(result && result.sheetIssueKey) });
    } else if (foundKey === normalizeIssueKey(result && result.sheetIssueKey)) {
      matched += 1;
    } else {
      mismatches.push({
        rowNumber: Number(result && result.rowNumber) || 0,
        sheetIssueKey: normalizeIssueKey(result && result.sheetIssueKey),
        jiraIssueKey: foundKey
      });
    }
  });
  return {
    checkedContacts: Array.isArray(results) ? results.length : 0,
    matchedIssueKeys: matched,
    notFound: notFound,
    mismatches: mismatches,
    checkedAt: new Date().toISOString()
  };
}

function normalizeIssueKey(value) {
  var match = normalize(value).toUpperCase().match(/^[A-Z][A-Z0-9]+-\d+$/);
  return match ? match[0] : "";
}

function compareGmailLeads(sheetLeads, scan) {
  var sheetByMessageId = {};
  (Array.isArray(sheetLeads) ? sheetLeads : []).forEach(function (lead) {
    var messageId = normalize(lead && lead.gmailMessageId);
    if (messageId && !Object.hasOwn(sheetByMessageId, messageId)) sheetByMessageId[messageId] = lead;
  });
  var matched = 0;
  var notInSheet = [];
  var fieldMismatches = [];
  var accepted = scan && Array.isArray(scan.acceptedMessages) ? scan.acceptedMessages : [];
  accepted.forEach(function (parsed) {
    var messageId = normalize(parsed && parsed.messageId);
    var sheetLead = sheetByMessageId[messageId];
    if (!sheetLead) {
      notInSheet.push(messageId);
      return;
    }
    var fields = [];
    if (normalize(parsed.contactEmail).toLowerCase() !== normalize(sheetLead.contactEmail).toLowerCase()) fields.push("contactEmail");
    if (normalize(parsed.companyName).toLowerCase() !== normalize(sheetLead.companyName).toLowerCase()) fields.push("companyName");
    if (fields.length) {
      fieldMismatches.push({ messageId: messageId, rowNumber: sheetLead.rowNumber, fields: fields });
    } else {
      matched += 1;
    }
  });
  return {
    queries: scan && Array.isArray(scan.queries) ? scan.queries : [],
    candidateMessages: Number(scan && scan.candidateMessages) || 0,
    acceptedMessages: accepted.length,
    matchedMessages: matched,
    notInSheet: notInSheet,
    fieldMismatches: fieldMismatches,
    checkedAt: new Date().toISOString()
  };
}

function compareGmailOnboarding(sheetLeads, scan) {
  var sheetByMessageId = {};
  (Array.isArray(sheetLeads) ? sheetLeads : []).forEach(function (lead) {
    normalize(lead && lead.onboardingMessageId).split(",").map(normalize).filter(Boolean).forEach(function (messageId) {
      if (!Object.hasOwn(sheetByMessageId, messageId)) sheetByMessageId[messageId] = lead;
    });
  });
  var matched = 0;
  var notInSheet = [];
  var fieldMismatches = [];
  var accepted = scan && Array.isArray(scan.acceptedMessages) ? scan.acceptedMessages : [];
  accepted.forEach(function (parsed) {
    var messageId = normalize(parsed && parsed.messageId);
    var sheetLead = sheetByMessageId[messageId];
    if (!sheetLead) {
      notInSheet.push(messageId);
      return;
    }
    if (normalize(parsed.contactEmail).toLowerCase() !== normalize(sheetLead.contactEmail).toLowerCase()) {
      fieldMismatches.push({ messageId: messageId, rowNumber: sheetLead.rowNumber, fields: ["contactEmail"] });
    } else {
      matched += 1;
    }
  });
  return {
    queries: scan && Array.isArray(scan.queries) ? scan.queries : [],
    candidateMessages: Number(scan && scan.candidateMessages) || 0,
    acceptedMessages: accepted.length,
    matchedMessages: matched,
    notInSheet: notInSheet,
    fieldMismatches: fieldMismatches,
    checkedAt: new Date().toISOString()
  };
}

function compareOnboardingSheet(sheetLeads, lookup) {
  var matched = 0;
  var matchSources = { email: 0, responsiblePerson: 0 };
  var notCached = [];
  var fieldMismatches = [];
  (Array.isArray(sheetLeads) ? sheetLeads : []).forEach(function (lead) {
    var result = onboardingSheet.findOnboardingRequest(lookup, lead);
    if (!result.match) return;
    matchSources[result.source] += 1;
    var fields = [];
    if (normalize(lead.onboardingSheetRow) !== String(result.match.rowNumber)) fields.push("onboardingSheetRow");
    if (normalizeIssueKey(lead.jiraIssueKey) !== result.match.jiraIssueKey) fields.push("jiraIssueKey");
    if (normalize(lead.targetRegion).toLowerCase() !== normalize(result.match.targetRegion).toLowerCase()) fields.push("targetRegion");
    if (!normalize(lead.onboardingSheetRow)) {
      notCached.push({ rowNumber: lead.rowNumber, onboardingSheetRow: result.match.rowNumber, source: result.source });
    } else if (fields.length) {
      fieldMismatches.push({ rowNumber: lead.rowNumber, onboardingSheetRow: result.match.rowNumber, fields: fields });
    } else {
      matched += 1;
    }
  });
  return {
    eligibleOnboardingRows: Number(lookup && lookup.eligibleRows) || 0,
    discoveredMatches: matchSources.email + matchSources.responsiblePerson,
    matchSources: matchSources,
    matchedCachedRows: matched,
    notCached: notCached,
    fieldMismatches: fieldMismatches,
    checkedAt: new Date().toISOString()
  };
}

function plannedJiraKeys(leads, lookup) {
  var issueKeys = [];
  var seen = new Set();
  var rowNumbers = [];
  var statusByKey = {};
  (Array.isArray(leads) ? leads : []).forEach(function (lead) {
    var onboardingResult = onboardingSheet.findOnboardingRequest(lookup, lead);
    var existingKey = normalizeIssueKey(lead && lead.jiraIssueKey);
    var issueKey = existingKey || normalizeIssueKey(onboardingResult.match && onboardingResult.match.jiraIssueKey);
    if (!issueKey) return;
    rowNumbers.push(Number(lead && lead.rowNumber) || 0);
    if (seen.has(issueKey)) return;
    seen.add(issueKey);
    issueKeys.push(issueKey);
    statusByKey[issueKey] = normalize(lead && lead.jiraStatus);
  });
  return { issueKeys: issueKeys.slice(0, 100), rowNumbers: rowNumbers, statusByKey: statusByKey };
}

function buildRefreshDryRun(sheetResult, gmailLeadScan, gmailOnboardingScan, onboardingLookup, jiraPlan, liveStatuses) {
  var leads = sheetResult && Array.isArray(sheetResult.leads) ? sheetResult.leads : [];
  var gmailLeads = compareGmailLeads(leads, gmailLeadScan);
  var gmailOnboarding = compareGmailOnboarding(leads, gmailOnboardingScan);
  var onboarding = compareOnboardingSheet(leads, onboardingLookup);
  var jira = compareJiraStatuses(jiraPlan.statusByKey, liveStatuses);
  var onboardingRows = Array.from(new Set(
    onboarding.notCached.concat(onboarding.fieldMismatches).map(function (item) { return Number(item.rowNumber) || 0; }).filter(Boolean)
  ));
  var jiraMismatchKeys = jira.blankInSheet.map(function (item) { return item.issueKey; })
    .concat(jira.mismatches.map(function (item) { return item.issueKey; }));

  return {
    generatedAt: new Date().toISOString(),
    snapshot: {
      sourceRows: Number(sheetResult && sheetResult.metadata && sheetResult.metadata.totalRows) || 0,
      loadedRows: leads.length
    },
    gmailLeads: {
      candidateMessages: gmailLeads.candidateMessages,
      acceptedMessages: gmailLeads.acceptedMessages,
      matchedMessages: gmailLeads.matchedMessages,
      plannedAppends: gmailLeads.notInSheet.length,
      mismatchRows: gmailLeads.fieldMismatches.map(function (item) { return { rowNumber: item.rowNumber, fields: item.fields }; })
    },
    gmailOnboarding: {
      candidateMessages: gmailOnboarding.candidateMessages,
      acceptedMessages: gmailOnboarding.acceptedMessages,
      matchedMessages: gmailOnboarding.matchedMessages,
      uncachedMessages: gmailOnboarding.notInSheet.length,
      mismatchRows: gmailOnboarding.fieldMismatches.map(function (item) { return { rowNumber: item.rowNumber, fields: item.fields }; })
    },
    onboardingSheet: {
      eligibleRows: onboarding.eligibleOnboardingRows,
      discoveredMatches: onboarding.discoveredMatches,
      cachedMatches: onboarding.matchedCachedRows,
      plannedRows: onboardingRows,
      mismatchRows: onboarding.fieldMismatches
    },
    jira: {
      candidateRows: jiraPlan.rowNumbers.length,
      uniqueKeys: jiraPlan.issueKeys.length,
      liveStatuses: Object.keys(liveStatuses || {}).length,
      exactStatuses: jira.matchedStatuses,
      plannedStatusKeys: jiraMismatchKeys,
      missingKeys: jira.missingInJira
    },
    plannedMutations: {
      appendRows: gmailLeads.notInSheet.length,
      onboardingMailRows: gmailOnboarding.notInSheet.length + gmailOnboarding.fieldMismatches.length,
      onboardingSheetRows: onboardingRows.length,
      jiraTimestampRows: jiraPlan.rowNumbers.length,
      jiraStatusKeys: jiraMismatchKeys.length
    },
    cutoverReadiness: {
      dryRunOnly: true,
      appendPayloadReady: false,
      gmailScanBounded: true,
      mutationsEnabled: false,
      schedulerEnabled: false,
      ready: false,
      blockers: [
        "Firebase Gmail lead parsing does not yet produce the full GAS append-row payload.",
        "The dry run uses bounded Gmail samples rather than operational pagination.",
        "GAS v60 remains the active writer and daily scheduler."
      ]
    }
  };
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  CENTRAL_VERIFIER_URL,
  LEAD_RANGE,
  LEAD_SHEET,
  INTERNAL_FIELDS,
  MAX_LEADS,
  PUBLIC_FIELDS,
  SETTINGS_ACTIONS,
  STUDIO_ID,
  assertRequiredHeaders,
  compareGmailLeads,
  compareGmailOnboarding,
  compareOnboardingSheet,
  compareJiraDiscovery,
  compareJiraStatuses,
  buildRefreshDryRun,
  jiraDiscoveryCandidates,
  jiraStatusBaseline,
  plannedJiraKeys,
  loadLeads,
  mapLead,
  publicAuthorization,
  runAction,
  verifyAccess
};
