"use strict";

var GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
var OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
var gmailLeadParser = require("./gmailLeadParser");

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

async function scanGmailLeadMessages(options) {
  options = options || {};
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  var accessToken = await createDelegatedAccessToken(options);
  var fetchImpl = options.fetchImpl || fetch;
  var afterDate = formatAfterDate(options.nowMs == null ? Date.now() : options.nowMs);
  var queries = [
    `in:anywhere subject:"New Contact" after:${afterDate}`,
    `in:anywhere subject:"Contact Form" after:${afterDate}`
  ];
  var seen = new Set();
  var messageIds = [];
  var stats = [];
  for (var queryIndex = 0; queryIndex < queries.length; queryIndex += 1) {
    var query = queries[queryIndex];
    var listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/messages`);
    listUrl.searchParams.set("q", query);
    listUrl.searchParams.set("maxResults", "15");
    var listResponse = await gmailFetch(fetchImpl, listUrl.toString(), accessToken);
    var listed = Array.isArray(listResponse.messages) ? listResponse.messages : [];
    stats.push({ query: query, returned: listed.length });
    listed.forEach(function (message) {
      var id = normalize(message && message.id);
      if (!id || seen.has(id) || messageIds.length >= 12) return;
      seen.add(id);
      messageIds.push(id);
    });
  }

  var accepted = [];
  for (var messageIndex = 0; messageIndex < messageIds.length; messageIndex += 1) {
    var messageUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/messages/${encodeURIComponent(messageIds[messageIndex])}`
    );
    messageUrl.searchParams.set("format", "full");
    var message = await gmailFetch(fetchImpl, messageUrl.toString(), accessToken);
    var parsed = gmailLeadParser.parseGmailLeadMessage(message);
    if (parsed) accepted.push(parsed);
  }
  return { queries: stats, candidateMessages: messageIds.length, acceptedMessages: accepted };
}

async function gmailFetch(fetchImpl, url, accessToken) {
  var response = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  var body = await response.json().catch(function () { return {}; });
  if (!response.ok) throw new Error(`Gmail API request failed (HTTP ${Number(response.status) || 0}).`);
  return body;
}

function formatAfterDate(nowMs) {
  var date = new Date(Number(nowMs));
  date.setUTCMonth(date.getUTCMonth() - 3);
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("/");
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
  probeGmailMailbox,
  scanGmailLeadMessages
};
