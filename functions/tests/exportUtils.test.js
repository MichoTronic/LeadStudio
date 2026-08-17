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
    jiraIssueKey: "SF-42",
    jiraIssueUrl: "https://jira.example/browse/SF-42",
    onboardingComplete: "Y"
  }]);

  assert.equal(result.headers.length, 14);
  assert.deepEqual(result.headers.slice(8, 12), ["Language", "Jira Issue Key", "Jira Issue URL", "Jira Status"]);
  assert.equal(result.rows[0][1], "Example, Inc.");
  assert.equal(result.rows[0][9], "SF-42");
  assert.equal(result.rows[0][10], "https://jira.example/browse/SF-42");
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

test("creates an XLSX zip and a stable filtered filename", async function () {
  var result = exporter.buildExportRows([{ companyName: "A & B <Gaming>" }]);
  var bytes = new Uint8Array(await exporter.createXlsxBlob(result.headers, result.rows).arrayBuffer());

  assert.deepEqual(Array.from(bytes.slice(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
  assert.ok(bytes.length > 2000);
  assert.equal(
    exporter.buildExportFilename("xlsx", "Qualified Leads", new Date("2026-08-17T10:00:00Z")),
    "lead-studio-qualified-leads-visible-2026-08-17.xlsx"
  );
});
