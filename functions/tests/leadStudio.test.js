"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var leadStudio = require("../src/leadStudio");

var HEADERS = [
  "Email Date", "Name", "Last Name", "Contact Email", "Phone", "Address",
  "Business Type", "Company Name", "Interested in", "Full Body", "Gmail Message ID",
  "Jira Issue Key", "Jira Status", "Onboarding Complete", "Last Jira Check", "Last Checked",
  "Jira Issue URL", "Lead Status", "Target Region"
];

test("maps only the approved browser fields", function () {
  var row = [
    "2026-08-17", "Ada", "Lovelace", "ada@example.com", "+386 1", "Private address",
    "Operator", "Analytical Engines", "Platform", "private body", "gmail-secret",
    "MKT-42", "In Progress", "Y", "2026-08-17", "2026-08-17",
    "https://jira.example/MKT-42", "Qualified", "EMEA"
  ];
  var mapped = leadStudio.mapLead(HEADERS, row, 12);

  assert.equal(mapped.rowNumber, 12);
  assert.equal(mapped.companyName, "Analytical Engines");
  assert.equal(mapped.contactEmail, "ada@example.com");
  assert.equal(mapped.phone, undefined);
  assert.equal(mapped.address, undefined);
  assert.equal(mapped.fullBody, undefined);
  assert.equal(mapped.gmailMessageId, undefined);
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
