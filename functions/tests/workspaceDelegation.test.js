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
