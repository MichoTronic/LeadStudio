"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var jiraClient = require("../src/jiraClient");

test("reads a safe Jira profile through Basic API-token authentication", async function () {
  var captured;
  var result = await jiraClient.probeJiraConnection({
    baseUrl: "https://gaming-universe.atlassian.net/",
    email: "admin@example.com",
    apiToken: "replacement-secret",
    fetchImpl: async function (url, request) {
      captured = { url: url, request: request };
      return {
        ok: true,
        status: 200,
        json: async function () {
          return {
            accountId: "account-1",
            displayName: "Lead Studio Admin",
            emailAddress: "admin@example.com",
            active: true
          };
        }
      };
    }
  });

  assert.equal(captured.url, "https://gaming-universe.atlassian.net/rest/api/3/myself");
  assert.equal(
    Buffer.from(captured.request.headers.Authorization.replace("Basic ", ""), "base64").toString("utf8"),
    "admin@example.com:replacement-secret"
  );
  assert.deepEqual(result, {
    accountId: "account-1",
    displayName: "Lead Studio Admin",
    active: true
  });
  assert.equal(JSON.stringify(result).includes("replacement-secret"), false);
  assert.equal(Object.hasOwn(result, "emailAddress"), false);
});

test("rejects non-Atlassian and non-HTTPS Jira URLs before fetching", async function () {
  var fetches = 0;
  await assert.rejects(
    jiraClient.probeJiraConnection({
      baseUrl: "http://example.com",
      email: "admin@example.com",
      apiToken: "secret",
      fetchImpl: async function () { fetches += 1; }
    }),
    /HTTPS \*\.atlassian\.net/
  );
  assert.equal(fetches, 0);
});

test("does not expose Jira provider payloads or credentials on failure", async function () {
  await assert.rejects(
    jiraClient.probeJiraConnection({
      baseUrl: "https://gaming-universe.atlassian.net",
      email: "admin@example.com",
      apiToken: "replacement-secret",
      fetchImpl: async function () {
        return {
          ok: false,
          status: 401,
          json: async function () {
            return { errorMessages: ["provider-private-detail replacement-secret"] };
          }
        };
      }
    }),
    function (error) {
      assert.equal(error.message, "Jira connection failed (HTTP 401).");
      return true;
    }
  );
});

test("loads validated Jira issue statuses in bounded batches", async function () {
  var requests = [];
  var issueKeys = Array.from({ length: 55 }, function (_, index) { return `SF-${index + 1}`; });
  issueKeys.push("invalid key", "SF-1");
  var statuses = await jiraClient.loadJiraIssueStatuses({
    baseUrl: "https://gaming-universe.atlassian.net",
    email: "admin@example.com",
    apiToken: "replacement-secret",
    issueKeys: issueKeys,
    fetchImpl: async function (url) {
      requests.push(url);
      var parsed = new URL(url);
      var keys = parsed.searchParams.get("jql").replace("key in (", "").replace(")", "").split(",");
      return {
        ok: true,
        status: 200,
        json: async function () {
          return { issues: keys.map(function (key) {
            return { key: key, fields: { status: { name: "01 New Lead" } } };
          }) };
        }
      };
    }
  });
  assert.equal(requests.length, 2);
  assert.equal(Object.keys(statuses).length, 55);
  assert.equal(statuses["SF-55"].status, "01 New Lead");
  assert.equal(Object.hasOwn(statuses, "INVALID KEY"), false);
});
