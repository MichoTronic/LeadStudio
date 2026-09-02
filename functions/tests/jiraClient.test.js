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

test("discovers the newest Jira issue for a validated contact email", async function () {
  var requestedUrl;
  var result = await jiraClient.findJiraIssueForContact({
    baseUrl: "https://gaming-universe.atlassian.net",
    email: "admin@example.com",
    apiToken: "replacement-secret",
    contactEmail: "Lead+EU@example.com",
    fetchImpl: async function (url) {
      requestedUrl = new URL(url);
      return {
        ok: true,
        status: 200,
        json: async function () {
          return { issues: [{ key: "SF-42", fields: { status: { name: "02 Qualified Lead" } } }] };
        }
      };
    }
  });
  assert.equal(requestedUrl.searchParams.get("jql"), 'text ~ "lead+eu@example.com" ORDER BY updated DESC');
  assert.equal(requestedUrl.searchParams.get("maxResults"), "5");
  assert.deepEqual(result, { issueKey: "SF-42", status: "02 Qualified Lead" });
  assert.equal(JSON.stringify(result).includes("example.com"), false);
});

test("rejects invalid contact emails before Jira discovery", async function () {
  var fetches = 0;
  await assert.rejects(
    jiraClient.findJiraIssueForContact({
      baseUrl: "https://gaming-universe.atlassian.net",
      email: "admin@example.com",
      apiToken: "replacement-secret",
      contactEmail: 'bad" OR key is not EMPTY',
      fetchImpl: async function () { fetches += 1; }
    }),
    /contact email is invalid/
  );
  assert.equal(fetches, 0);
});

test("loads a single Jira issue by validated key", async function () {
  var requestedUrl;
  var result = await jiraClient.loadJiraIssueByKey({
    baseUrl: "https://gaming-universe.atlassian.net",
    email: "admin@example.com",
    apiToken: "replacement-secret",
    issueKey: "sf-42",
    fetchImpl: async function (url) {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async function () {
          return { key: "SF-42", fields: { status: { name: "06 Active" } } };
        }
      };
    }
  });
  assert.equal(requestedUrl, "https://gaming-universe.atlassian.net/rest/api/3/issue/SF-42?fields=status");
  assert.deepEqual(result, { issueKey: "SF-42", status: "06 Active" });
});

test("returns null for a missing Jira issue and rejects malformed keys", async function () {
  var missing = await jiraClient.loadJiraIssueByKey({
    baseUrl: "https://gaming-universe.atlassian.net",
    email: "admin@example.com",
    apiToken: "replacement-secret",
    issueKey: "SF-404",
    fetchImpl: async function () {
      return { ok: false, status: 404, json: async function () { return { private: "detail" }; } };
    }
  });
  assert.equal(missing, null);
  await assert.rejects(
    jiraClient.loadJiraIssueByKey({
      baseUrl: "https://gaming-universe.atlassian.net",
      email: "admin@example.com",
      apiToken: "replacement-secret",
      issueKey: "../../secret"
    }),
    /issue key is invalid/
  );
});

test("bounds concurrent Jira discovery and deduplicates contact emails", async function () {
  var active = 0;
  var maximumActive = 0;
  var calls = 0;
  var results = await jiraClient.findJiraIssuesForContacts({
    baseUrl: "https://gaming-universe.atlassian.net",
    email: "admin@example.com",
    apiToken: "replacement-secret",
    contactEmails: ["one@example.com", "TWO@example.com", "one@example.com", "invalid", "three@example.com"],
    concurrency: 2,
    fetchImpl: async function (url) {
      calls += 1;
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise(function (resolve) { setTimeout(resolve, 5); });
      active -= 1;
      var jql = new URL(url).searchParams.get("jql");
      var key = jql.includes("one@example.com") ? "SF-1" : jql.includes("two@example.com") ? "SF-2" : "SF-3";
      return {
        ok: true,
        status: 200,
        json: async function () { return { issues: [{ key: key, fields: { status: { name: "01 New Lead" } } }] }; }
      };
    }
  });
  assert.equal(calls, 3);
  assert.equal(maximumActive, 2);
  assert.deepEqual(Object.keys(results), ["one@example.com", "two@example.com", "three@example.com"]);
  assert.equal(results["two@example.com"].issueKey, "SF-2");
});
