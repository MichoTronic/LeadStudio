"use strict";

var GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
var OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function createDelegatedAccessToken(options) {
  options = options || {};
  var serviceAccountEmail = normalize(options.serviceAccountEmail);
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  if (!serviceAccountEmail || !delegatedUser || typeof options.signJwt !== "function") {
    throw new Error("Workspace delegation is not configured.");
  }

  var nowSeconds = Math.floor(Number(options.nowMs == null ? Date.now() : options.nowMs) / 1000);
  var signedJwt = await options.signJwt({
    iss: serviceAccountEmail,
    sub: delegatedUser,
    scope: GMAIL_READONLY_SCOPE,
    aud: OAUTH_TOKEN_URL,
    iat: nowSeconds - 5,
    exp: nowSeconds + 3600
  });
  if (!normalize(signedJwt)) throw new Error("Workspace JWT signing failed.");

  var fetchImpl = options.fetchImpl || fetch;
  var response = await fetchImpl(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt
    }).toString()
  });
  var body = await response.json().catch(function () { return {}; });
  if (!response.ok || !normalize(body.access_token)) {
    var reason = normalize(body.error_description || body.error);
    throw new Error(reason ? `Workspace delegation failed: ${reason}` : "Workspace delegation failed.");
  }
  return body.access_token;
}

async function probeGmailMailbox(options) {
  options = options || {};
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  var accessToken = await createDelegatedAccessToken(options);
  var fetchImpl = options.fetchImpl || fetch;
  var response = await fetchImpl(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/profile`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  var body = await response.json().catch(function () { return {}; });
  if (!response.ok || !normalize(body.emailAddress)) {
    throw new Error("Gmail mailbox profile could not be read.");
  }
  return {
    emailAddress: normalize(body.emailAddress).toLowerCase(),
    messagesTotal: nonNegativeNumber(body.messagesTotal),
    threadsTotal: nonNegativeNumber(body.threadsTotal)
  };
}

function nonNegativeNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  GMAIL_READONLY_SCOPE,
  OAUTH_TOKEN_URL,
  createDelegatedAccessToken,
  probeGmailMailbox
};
