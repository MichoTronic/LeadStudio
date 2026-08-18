"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var leadStudio = require("../src/leadStudio");

var HEADERS = [
  "Email Date", "Name", "Last Name", "Contact Email", "Phone", "Address",
  "Business Type", "Company Name", "Interested in", "Inquiry", "Full Body", "Gmail Message ID",
  "Jira Issue Key", "Jira Status", "Onboarding Complete", "Last Jira Check", "Last Checked",
  "Jira Issue URL", "Lead Status", "Target Region"
];

test("maps only the approved browser fields", function () {
  var row = [
    "2026-08-17", "Ada", "Lovelace", "ada@example.com", "+386 1", "Private address",
    "Operator", "Analytical Engines", "Platform", "Please contact me", "private body", "gmail-secret",
    "MKT-42", "In Progress", "Y", "2026-08-17", "2026-08-17",
    "https://jira.example/MKT-42", "Qualified", "EMEA"
  ];
  var mapped = leadStudio.mapLead(HEADERS, row, 12);

  assert.equal(mapped.rowNumber, 12);
  assert.equal(mapped.companyName, "Analytical Engines");
  assert.equal(mapped.contactEmail, "ada@example.com");
  assert.equal(mapped.inquiry, "Please contact me");
  assert.equal(mapped.phone, undefined);
  assert.equal(mapped.address, undefined);
  assert.equal(mapped.fullBody, undefined);
  assert.equal(mapped.gmailMessageId, undefined);
  assert.equal(mapped.gmailThreadId, undefined);
});

test("loads non-empty leads and reports bounded metadata", async function () {
  var sheetsClient = {
    spreadsheets: { values: { get: async function (request) {
      assert.equal(request.range, leadStudio.LEAD_RANGE);
      return { data: { values: [
        HEADERS,
        ["2026-08-17", "Ada", "Lovelace", "ada@example.com", "", "", "", "Analytical Engines", "", "", "", "", "", "", "", "", "", "New", "EMEA"],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
      ] } };
    } } }
  };
  var result = await leadStudio.loadLeads(sheetsClient, "sheet-id");
  assert.equal(result.leads.length, 1);
  assert.equal(result.metadata.totalRows, 2);
  assert.equal(result.metadata.returnedRows, 1);
});

test("rejects a changed sheet contract", function () {
  assert.throws(
    function () { leadStudio.assertRequiredHeaders(["Email Date", "Contact Email"]); },
    function (error) { return error.code === "failed-precondition"; }
  );
});

test("verifies central read access without exposing the token", async function () {
  var captured;
  var authorization = await leadStudio.verifyAccess("signed-token", "read", {
    fetchImpl: async function (_url, request) {
      captured = JSON.parse(request.body);
      return { ok: true, json: async function () {
        return { allowed: true, email: "ada@example.com", role: "viewer", scopes: ["read"] };
      } };
    }
  });
  assert.equal(captured.studioId, "lead-studio");
  assert.equal(captured.requiredScope, "read");
  assert.equal(authorization.email, "ada@example.com");
});

test("Gmail diagnostics require settings scope", async function () {
  var captured;
  var response = await leadStudio.runAction({
    data: { action: "gmailProbe", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      captured = JSON.parse(request.body);
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["read", "settings"] };
      } };
    },
    gmailProbe: async function () {
      return { emailAddress: "marketing@example.com", messagesTotal: 12, threadsTotal: 8 };
    }
  });
  assert.equal(captured.requiredScope, "settings");
  assert.equal(response.mailbox.emailAddress, "marketing@example.com");
});

test("Jira diagnostics require settings scope", async function () {
  var captured;
  var response = await leadStudio.runAction({
    data: { action: "jiraProbe", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      captured = JSON.parse(request.body);
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["read", "settings"] };
      } };
    },
    jiraProbe: async function () {
      return { accountId: "account-1", displayName: "Admin", active: true };
    }
  });
  assert.equal(captured.requiredScope, "settings");
  assert.deepEqual(response.jira, { accountId: "account-1", displayName: "Admin", active: true });
});

test("compares bounded live Jira statuses with the Sheet baseline", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS);
  var row = headers.map(function (header) {
    return ({
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Lead",
      "Jira Issue Key": "SF-42",
      "Jira Status": "01 New Lead"
    })[header] || "";
  });
  var response = await leadStudio.runAction({
    data: { action: "jiraStatusParity", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      var body = JSON.parse(request.body);
      assert.equal(body.requiredScope, "settings");
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: {
      spreadsheets: { values: { get: async function () {
        return { data: { values: [headers, row] } };
      } } }
    },
    jiraIssueStatuses: async function (keys) {
      assert.deepEqual(keys, ["SF-42"]);
      return { "SF-42": { issueKey: "SF-42", status: "01 New Lead" } };
    }
  });
  assert.equal(response.jiraParity.checkedKeys, 1);
  assert.equal(response.jiraParity.matchedStatuses, 1);
  assert.deepEqual(response.jiraParity.mismatches, []);
});

test("reports Jira parity gaps without exposing contact data", function () {
  var result = leadStudio.compareJiraStatuses(
    { "SF-1": "01 New Lead", "SF-2": "", "SF-3": "06 Active" },
    {
      "SF-1": { status: "02 Qualified Lead" },
      "SF-2": { status: "01 New Lead" }
    }
  );
  assert.deepEqual(result.mismatches, [
    { issueKey: "SF-1", sheetStatus: "01 New Lead", jiraStatus: "02 Qualified Lead" }
  ]);
  assert.deepEqual(result.blankInSheet, [{ issueKey: "SF-2", jiraStatus: "01 New Lead" }]);
  assert.deepEqual(result.missingInJira, ["SF-3"]);
  assert.equal(JSON.stringify(result).includes("lead@example.com"), false);
});

test("runs bounded Jira discovery parity without returning contact emails", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS);
  var row = headers.map(function (header) {
    return ({
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Lead",
      "Jira Issue Key": "SF-42"
    })[header] || "";
  });
  var response = await leadStudio.runAction({
    data: { action: "jiraDiscoveryParity", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      assert.equal(JSON.parse(request.body).requiredScope, "settings");
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: {
      spreadsheets: { values: { get: async function () {
        return { data: { values: [headers, row] } };
      } } }
    },
    jiraIssueForEmail: async function (email) {
      assert.equal(email, "lead@example.com");
      return { issueKey: "SF-42", status: "01 New Lead" };
    }
  });
  assert.equal(response.jiraDiscoveryParity.checkedContacts, 1);
  assert.equal(response.jiraDiscoveryParity.matchedIssueKeys, 1);
  assert.equal(JSON.stringify(response.jiraDiscoveryParity).includes("lead@example.com"), false);
});

test("caps and deduplicates Jira discovery candidates", function () {
  var leads = Array.from({ length: 20 }, function (_, index) {
    return { rowNumber: index + 2, contactEmail: `lead${index}@example.com`, jiraIssueKey: `SF-${index + 1}` };
  });
  leads.splice(1, 0, { rowNumber: 99, contactEmail: "lead0@example.com", jiraIssueKey: "SF-999" });
  var candidates = leadStudio.jiraDiscoveryCandidates(leads, 12);
  assert.equal(candidates.length, 12);
  assert.equal(candidates[0].sheetIssueKey, "SF-1");
  assert.equal(candidates.some(function (candidate) { return candidate.sheetIssueKey === "SF-999"; }), false);
});

test("runs bounded direct Jira lookup parity", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS);
  var rows = Array.from({ length: 15 }, function (_, index) {
    return headers.map(function (header) {
      return ({
        "Contact Email": `lead${index}@example.com`,
        "Company Name": `Example ${index}`,
        "Lead Status": "Lead",
        "Jira Issue Key": `SF-${index + 1}`,
        "Jira Status": "01 New Lead"
      })[header] || "";
    });
  });
  var lookups = [];
  var response = await leadStudio.runAction({
    data: { action: "jiraDirectLookupParity", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function () {
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: {
      spreadsheets: { values: { get: async function () {
        return { data: { values: [headers].concat(rows) } };
      } } }
    },
    jiraIssueByKey: async function (key) {
      lookups.push(key);
      return { issueKey: key, status: "01 New Lead" };
    }
  });
  assert.equal(lookups.length, 12);
  assert.equal(response.jiraDirectLookupParity.checkedKeys, 12);
  assert.equal(response.jiraDirectLookupParity.matchedStatuses, 12);
});

test("compares Gmail parser results by message ID without returning contact values", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS).concat(["Gmail Message ID"]);
  var row = headers.map(function (header) {
    return ({
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Lead",
      "Gmail Message ID": "gmail-1"
    })[header] || "";
  });
  var response = await leadStudio.runAction({
    data: { action: "gmailLeadParity", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      assert.equal(JSON.parse(request.body).requiredScope, "settings");
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: {
      spreadsheets: { values: { get: async function () {
        return { data: { values: [headers, row] } };
      } } }
    },
    gmailLeadScan: async function () {
      return {
        queries: [{ query: "bounded", returned: 1 }],
        candidateMessages: 1,
        acceptedMessages: [{ messageId: "gmail-1", contactEmail: "lead@example.com", companyName: "Example" }]
      };
    }
  });
  assert.equal(response.gmailLeadParity.matchedMessages, 1);
  assert.equal(JSON.stringify(response.gmailLeadParity).includes("lead@example.com"), false);
  assert.equal(JSON.stringify(response.gmailLeadParity).includes("Example"), false);
});

test("keeps internal Gmail message and thread IDs out of normal bootstrap responses", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS).concat(["Gmail Message ID", "Gmail Thread ID"]);
  var row = headers.map(function (header) {
    return ({
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Lead",
      "Gmail Message ID": "private-gmail-id",
      "Gmail Thread ID": "private-thread-id"
    })[header] || "";
  });
  var result = await leadStudio.loadLeads({
    spreadsheets: { values: { get: async function () { return { data: { values: [headers, row] } }; } } }
  }, "sheet-1");
  assert.equal(result.leads[0].gmailMessageId, undefined);
  assert.equal(result.leads[0].gmailThreadId, undefined);
});

test("loads protected contact activity by Sheet row with read scope", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS).concat([
    "Gmail Message ID", "Gmail Thread ID", "Onboarding Message ID"
  ]);
  var row = headers.map(function (header) {
    return ({
      "Email Date": "2026-08-17",
      "Name": "Ada",
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Lead",
      "Gmail Message ID": "private-gmail-id",
      "Gmail Thread ID": "private-thread-id",
      "Onboarding Message ID": "private-onboarding-id"
    })[header] || "";
  });
  var capturedLead;
  var response = await leadStudio.runAction({
    data: { action: "contactActivity", studioAuthToken: "signed-token", rowNumber: 2 }
  }, {
    fetchImpl: async function (_url, request) {
      assert.equal(JSON.parse(request.body).requiredScope, "read");
      return { ok: true, json: async function () {
        return { allowed: true, email: "viewer@example.com", role: "viewer", scopes: ["read"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: {
      spreadsheets: { values: { get: async function () {
        return { data: { values: [headers, row] } };
      } } }
    },
    gmailContactActivity: async function (lead) {
      capturedLead = lead;
      return { conversationCount: 1, messageCount: 2, conversations: [{ key: "conversation-1", messages: [] }] };
    }
  });

  assert.equal(capturedLead.rowNumber, 2);
  assert.equal(capturedLead.gmailMessageId, "private-gmail-id");
  assert.equal(capturedLead.gmailThreadId, "private-thread-id");
  assert.equal(capturedLead.onboardingMessageId, "private-onboarding-id");
  assert.equal(response.mode, "read-only-contact-activity");
  assert.equal(response.contactActivity.messageCount, 2);
  assert.equal(response.authorization.email, "viewer@example.com");
  assert.equal(JSON.stringify(response).includes("private-thread-id"), false);
});

test("requires settings scope for the safe onboarding Sheet probe", async function () {
  var requiredScope;
  var response = await leadStudio.runAction({
    data: { action: "onboardingSheetProbe", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      requiredScope = JSON.parse(request.body).requiredScope;
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    onboardingSheetProbe: async function () {
      return { sheetName: "OnboardingRequests", sampledRows: 1, columns: 12 };
    }
  });
  assert.equal(requiredScope, "settings");
  assert.deepEqual(response.onboardingSheet, { sheetName: "OnboardingRequests", sampledRows: 1, columns: 12 });
});

test("compares onboarding Gmail IDs without exposing contact data", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS).concat(["Gmail Message ID", "Onboarding Message ID"]);
  var row = headers.map(function (header) {
    return ({
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Lead",
      "Onboarding Message ID": "onboarding-old, onboarding-1"
    })[header] || "";
  });
  var response = await leadStudio.runAction({
    data: { action: "gmailOnboardingParity", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      assert.equal(JSON.parse(request.body).requiredScope, "settings");
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: {
      spreadsheets: { values: { get: async function () {
        return { data: { values: [headers, row] } };
      } } }
    },
    gmailOnboardingScan: async function () {
      return {
        queries: [{ query: "bounded", returned: 1 }],
        candidateMessages: 1,
        acceptedMessages: [{ messageId: "onboarding-1", contactEmail: "lead@example.com", countHint: 1 }]
      };
    }
  });
  assert.equal(response.gmailOnboardingParity.matchedMessages, 1);
  assert.equal(JSON.stringify(response.gmailOnboardingParity).includes("lead@example.com"), false);
  assert.equal(JSON.stringify(response.gmailOnboardingParity).includes("Example"), false);
});

test("compares onboarding Form rows without exposing contact data", async function () {
  var headers = Object.keys(leadStudio.PUBLIC_FIELDS).concat(["Onboarding Sheet Row"]);
  var row = headers.map(function (header) {
    return ({
      "Name": "Ada",
      "Last Name": "Lovelace",
      "Contact Email": "lead@example.com",
      "Company Name": "Example",
      "Lead Status": "Active",
      "Jira Issue Key": "SF-10",
      "Target Region": "ROW",
      "Onboarding Sheet Row": "2"
    })[header] || "";
  });
  var response = await leadStudio.runAction({
    data: { action: "onboardingSheetParity", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      assert.equal(JSON.parse(request.body).requiredScope, "settings");
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    spreadsheetId: "sheet-1",
    sheetsClient: { spreadsheets: { values: { get: async function () {
      return { data: { values: [headers, row] } };
    } } } },
    onboardingSheetRows: async function () {
      return [
        ["Timestamp", "Operating Markets", "Responsible Person", "Email Address", "JIRA task ID"],
        ["2026-08-01", "ROW", "Ada Lovelace", "lead@example.com", "SF-10"]
      ];
    }
  });
  assert.equal(response.onboardingSheetParity.matchedCachedRows, 1);
  assert.equal(response.onboardingSheetParity.matchSources.email, 1);
  assert.equal(JSON.stringify(response.onboardingSheetParity).includes("lead@example.com"), false);
  assert.equal(JSON.stringify(response.onboardingSheetParity).includes("Ada"), false);
});

test("bootstrap requires authorization before reading Sheets", async function () {
  var reads = 0;
  await assert.rejects(
    leadStudio.runAction({ data: { action: "bootstrap", studioAuthToken: "denied" } }, {
      fetchImpl: async function () { return { ok: false, json: async function () { return {}; } }; },
      sheetsClient: { spreadsheets: { values: { get: async function () { reads += 1; } } } },
      spreadsheetId: "sheet-id"
    }),
    function (error) { return error.code === "permission-denied"; }
  );
  assert.equal(reads, 0);
});

test("builds a PII-minimized read-only refresh plan without Sheet writes", async function () {
  var reads = 0;
  var response = await leadStudio.runAction({
    data: { action: "refreshDryRun", studioAuthToken: "signed-token" }
  }, {
    fetchImpl: async function (_url, request) {
      assert.equal(JSON.parse(request.body).requiredScope, "settings");
      return { ok: true, json: async function () {
        return { allowed: true, email: "admin@example.com", role: "admin", scopes: ["settings"] };
      } };
    },
    refreshPlan: async function () {
      reads += 1;
      return {
        snapshotVersion: "a".repeat(64),
        targetVersion: "b".repeat(64),
        summary: { sourceRows: 2, targetRows: 3, changedRows: 1, appendedRows: 1 },
        rowNumbers: [2],
        appendRowNumbers: [4]
      };
    }
  });

  assert.equal(reads, 1);
  assert.equal(response.refreshDryRun.summary.sourceRows, 2);
  assert.equal(response.refreshDryRun.summary.appendedRows, 1);
  assert.equal(JSON.stringify(response.refreshDryRun).includes("ada@example.com"), false);
  assert.equal(JSON.stringify(response.refreshDryRun).includes("gmail-1"), false);
  assert.equal(JSON.stringify(response.refreshDryRun).includes("New Contact Email"), false);
});
