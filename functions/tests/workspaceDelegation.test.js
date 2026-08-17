"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var delegation = require("../src/workspaceDelegation");

test("creates a short-lived delegated Gmail token without a private key", async function () {
  var claims;
  var requests = [];
  var token = await delegation.createDelegatedAccessToken({
    serviceAccountEmail: "runtime@example.iam.gserviceaccount.com",
    delegatedUser: "marketing@example.com",
    nowMs: 1700000000000,
    signJwt: async function (payload) { claims = payload; return "signed-jwt"; },
    fetchImpl: async function (url, request) {
      requests.push({ url: url, request: request });
      return { ok: true, json: async function () { return { access_token: "short-lived-token" }; } };
    }
  });

  assert.equal(token, "short-lived-token");
  assert.equal(claims.sub, "marketing@example.com");
  assert.equal(claims.scope, delegation.GMAIL_READONLY_SCOPE);
  assert.equal(claims.exp - claims.iat, 3605);
  assert.equal(requests[0].url, delegation.OAUTH_TOKEN_URL);
  assert.match(requests[0].request.body, /signed-jwt/);
});

test("returns mailbox metadata but never the delegated access token", async function () {
  var call = 0;
  var result = await delegation.probeGmailMailbox({
    serviceAccountEmail: "runtime@example.iam.gserviceaccount.com",
    delegatedUser: "Marketing@Example.com",
    signJwt: async function () { return "signed-jwt"; },
    fetchImpl: async function (url, request) {
      call += 1;
      if (call === 1) {
        return { ok: true, json: async function () { return { access_token: "private-token" }; } };
      }
      assert.match(url, /users\/marketing%40example.com\/profile$/);
      assert.equal(request.headers.Authorization, "Bearer private-token");
      return { ok: true, json: async function () {
        return { emailAddress: "marketing@example.com", messagesTotal: 120, threadsTotal: 80, historyId: "secret-history" };
      } };
    }
  });

  assert.deepEqual(result, {
    emailAddress: "marketing@example.com",
    messagesTotal: 120,
    threadsTotal: 80
  });
  assert.equal(result.accessToken, undefined);
  assert.equal(result.historyId, undefined);
});

test("rejects a failed delegated token exchange without returning provider payloads", async function () {
  await assert.rejects(
    delegation.createDelegatedAccessToken({
      serviceAccountEmail: "runtime@example.iam.gserviceaccount.com",
      delegatedUser: "marketing@example.com",
      signJwt: async function () { return "signed-jwt"; },
      fetchImpl: async function () {
        return { ok: false, json: async function () { return { error: "unauthorized_client" }; } };
      }
    }),
    /Workspace delegation failed/
  );
});

test("runs a bounded delegated Gmail lead scan with private append payloads and no tokens", async function () {
  var listCalls = 0;
  var result = await delegation.scanGmailLeadMessages({
    serviceAccountEmail: "runtime@example.iam.gserviceaccount.com",
    delegatedUser: "marketing@timelesstech.io",
    nowMs: Date.UTC(2026, 7, 17),
    signJwt: async function () { return "signed-jwt"; },
    fetchImpl: async function (url) {
      if (url === delegation.OAUTH_TOKEN_URL) {
        return { ok: true, json: async function () { return { access_token: "private-token" }; } };
      }
      var parsedUrl = new URL(url);
      if (parsedUrl.pathname.endsWith("/messages")) {
        listCalls += 1;
        return { ok: true, json: async function () {
          return { messages: listCalls === 1 ? [{ id: "gmail-1" }] : [{ id: "gmail-1" }, { id: "gmail-2" }] };
        } };
      }
      var id = parsedUrl.pathname.split("/").pop();
      return { ok: true, json: async function () {
        return {
          id: id,
          payload: {
            headers: [
              { name: "From", value: "noreply@timelesstech.io" },
              { name: "To", value: "marketing@timelesstech.io" },
              { name: "Subject", value: "New Contact" }
            ],
            body: { data: Buffer.from(`New Contact Email: ${id}@example.com Phone: 1 Address: EU Business Type: Other Company Name: ${id} Interested in: Other Inquiry: Hi Language: en`).toString("base64url") }
          }
        };
      } };
    }
  });
  assert.equal(result.candidateMessages, 2);
  assert.equal(result.acceptedMessages.length, 2);
  assert.equal(result.appendPayloadReady, true);
  assert.equal(result.complete, true);
  assert.equal(result.operational, false);
  assert.equal(result.queries[0].query.endsWith("after:2026/05/17"), true);
  assert.equal(JSON.stringify(result).includes("private-token"), false);
  assert.match(result.acceptedMessages[0].values["Full Body"], /^New Contact Email:/);
});

test("runs a bounded delegated Gmail onboarding scan without returning bodies or tokens", async function () {
  var listCalls = 0;
  var result = await delegation.scanGmailOnboardingMessages({
    serviceAccountEmail: "runtime@example.iam.gserviceaccount.com",
    delegatedUser: "marketing@timelesstech.io",
    nowMs: Date.UTC(2026, 7, 17),
    signJwt: async function () { return "signed-jwt"; },
    fetchImpl: async function (url) {
      if (url === delegation.OAUTH_TOKEN_URL) {
        return { ok: true, json: async function () { return { access_token: "private-token" }; } };
      }
      var parsedUrl = new URL(url);
      if (parsedUrl.pathname.endsWith("/messages")) {
        listCalls += 1;
        return { ok: true, json: async function () {
          return { messages: listCalls === 1 ? [{ id: "onboarding-1" }] : [{ id: "onboarding-1" }, { id: "onboarding-2" }] };
        } };
      }
      var id = parsedUrl.pathname.split("/").pop();
      return { ok: true, json: async function () {
        return {
          id: id,
          payload: {
            headers: [{ name: "Subject", value: "Onboarding form sent" }],
            body: { data: Buffer.from(`ONBOARDING SENT 1 TIME Email: ${id}@example.com Phone: 1`).toString("base64url") }
          }
        };
      } };
    }
  });
  assert.equal(result.candidateMessages, 2);
  assert.equal(result.acceptedMessages.length, 2);
  assert.equal(result.complete, true);
  assert.equal(result.operational, false);
  assert.equal(result.queries[0].query.endsWith("after:2026/05/17"), true);
  assert.equal(JSON.stringify(result).includes("private-token"), false);
  assert.equal(JSON.stringify(result).includes("ONBOARDING SENT"), true);
  assert.equal(JSON.stringify(result).includes("Email:"), false);
});

test("samples every undated legacy query in a bounded deep lead scan", async function () {
  var listUrls = [];
  var result = await delegation.scanGmailLeadMessages({
    serviceAccountEmail: "runtime@example.iam.gserviceaccount.com",
    delegatedUser: "marketing@timelesstech.io",
    deepScan: true,
    signJwt: async function () { return "signed-jwt"; },
    fetchImpl: async function (url) {
      if (url === delegation.OAUTH_TOKEN_URL) {
        return { ok: true, json: async function () { return { access_token: "private-token" }; } };
      }
      var parsedUrl = new URL(url);
      if (parsedUrl.pathname.endsWith("/messages")) {
        listUrls.push(parsedUrl);
        return { ok: true, json: async function () { return { messages: [] }; } };
      }
      throw new Error("Unexpected message fetch");
    }
  });
  assert.equal(result.queries.length, 7);
  assert.equal(result.candidateMessages, 0);
  assert.equal(listUrls.every(function (url) { return url.searchParams.get("maxResults") === "3"; }), true);
  assert.equal(listUrls.every(function (url) { return !url.searchParams.get("q").includes("after:"); }), true);
});

test("follows Gmail page tokens and reports a complete operational listing", async function () {
  var listUrls = [];
  var listing = await delegation.listGmailMessagesForQueries({
    delegatedUser: "marketing@timelesstech.io",
    accessToken: "private-token",
    queries: ["query-one", "query-two"],
    pageSize: 2,
    maxResultsPerQuery: 5,
    candidateLimit: Infinity,
    fetchImpl: async function (url) {
      var parsedUrl = new URL(url);
      listUrls.push(parsedUrl);
      var query = parsedUrl.searchParams.get("q");
      var page = parsedUrl.searchParams.get("pageToken");
      if (query === "query-one" && !page) {
        return { ok: true, json: async function () { return { messages: [{ id: "one" }, { id: "shared" }], nextPageToken: "next" }; } };
      }
      if (query === "query-one") {
        return { ok: true, json: async function () { return { messages: [{ id: "two" }] }; } };
      }
      return { ok: true, json: async function () { return { messages: [{ id: "shared" }, { id: "three" }] }; } };
    }
  });
  assert.deepEqual(listing.messageIds, ["one", "shared", "two", "three"]);
  assert.equal(listing.complete, true);
  assert.equal(listing.stats[0].pages, 2);
  assert.equal(listing.stats[0].hasMore, false);
  assert.equal(listUrls[1].searchParams.get("pageToken"), "next");
});
