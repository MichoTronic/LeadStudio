"use strict";

var test = require("node:test");
var assert = require("node:assert/strict");
var exporter = require("../../public/export-utils.js");

test("shapes visible Firebase leads with the legacy export column order", function () {
  var result = exporter.buildExportRows([{
    emailDate: "2026-08-17",
    companyName: "Example, Inc.",
    name: "Ada",
    lastName: "Lovelace",
    contactEmail: "ada@example.com",
    leadStatus: "Qualified Leads",
    inquiry: "Interested in an aggregation partnership.",
    jiraIssueKey: "SF-42",
    jiraIssueUrl: "https://jira.example/browse/SF-42",
    onboardingComplete: "Y",
    onboardingSentAt: "2026-08-18T09:00:00Z",
    onboardingSubmittedAt: "2026-08-18T10:00:00Z"
  }]);

  assert.equal(result.headers.length, 19);
  assert.deepEqual(result.headers.slice(8, 12), ["Language", "Jira Issue Key", "Jira Issue URL", "Jira Status"]);
  assert.deepEqual(result.headers.slice(14), [
    "Lead Status", "Inquiry", "Onboarding Sent At", "Onboarding Submitted At", "Last Contacted / Last Activity At"
  ]);
  assert.equal(result.rows[0][1], "Example, Inc.");
  assert.equal(result.rows[0][9], "SF-42");
  assert.equal(result.rows[0][10], "https://jira.example/browse/SF-42");
  assert.equal(result.rows[0][14], "Qualified Leads");
  assert.equal(result.rows[0][15], "Interested in an aggregation partnership.");
  assert.equal(result.rows[0][18], "2026-08-18T10:00:00Z");
});

test("prefers an exact Gmail activity timestamp and otherwise uses the latest known business event", function () {
  assert.equal(exporter.latestKnownActivityAt({
    emailDate: "17.08.2026 08:00",
    onboardingSentAt: "17.08.2026 09:00",
    onboardingSubmittedAt: "17.08.2026 10:00"
  }), "17.08.2026 10:00");
  assert.equal(exporter.latestKnownActivityAt({
    emailDate: "2026-08-17",
    lastActivityAt: "2026-08-18T12:30:00Z"
  }), "2026-08-18T12:30:00Z");
});

test("creates an Excel-friendly quoted UTF-8 CSV", async function () {
  var result = exporter.buildExportRows([{ companyName: 'Example, "International"' }]);
  var blob = exporter.createCsvBlob(result.headers, result.rows);
  var bytes = new Uint8Array(await blob.arrayBuffer());
  var csv = await blob.text();

  assert.deepEqual(Array.from(bytes.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  assert.match(csv, /"Example, ""International"""/);
  assert.match(csv, /\r\n/);
});

test("neutralizes spreadsheet formulas in CSV exports", async function () {
  var blob = exporter.createCsvBlob(["Company"], [["=HYPERLINK(\"https://example.invalid\")"], ["  @SUM(1,1)"], ["Safe"]]);
  var csv = await blob.text();

  assert.match(csv, /"'=HYPERLINK\(""https:\/\/example\.invalid""\)"/);
  assert.match(csv, /"'  @SUM\(1,1\)"/);
  assert.match(csv, /"Safe"/);
});

test("creates a valid-character XLSX zip and a stable filtered filename", async function () {
  var result = exporter.buildExportRows([{ companyName: "A & B <Gaming>\u0001" }]);
  var bytes = new Uint8Array(await exporter.createXlsxBlob(result.headers, result.rows).arrayBuffer());
  var archiveText = new TextDecoder().decode(bytes);

  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.ok(bytes.length > 2000);
  assert.doesNotMatch(archiveText, /A &amp; B &lt;Gaming&gt;\u0001/);
  assert.match(archiveText, /A &amp; B &lt;Gaming&gt;/);
  assert.equal(
    exporter.buildExportFilename("xlsx", "Qualified Leads", new Date("2026-08-17T10:00:00Z")),
    "lead-studio-qualified-leads-visible-2026-08-17.xlsx"
  );
});
