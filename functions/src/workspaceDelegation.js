"use strict";

var GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
var OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
var OPERATIONAL_PAGE_SIZE = 100;
var OPERATIONAL_MAX_RESULTS_PER_QUERY = 500;
var MESSAGE_FETCH_CONCURRENCY = 8;
var DEFAULT_REQUEST_TIMEOUT_MS = 30 * 1000;
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
  var response = await fetchWithTimeout(fetchImpl, OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt
    }).toString()
  }, options.requestTimeoutMs);
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
  var response = await fetchWithTimeout(
    fetchImpl,
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/profile`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    options.requestTimeoutMs
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
  var baseQueries = [
    "in:anywhere subject:\"New Contact\"",
    "in:anywhere subject:\"Contact Form\""
  ];
  var deepQueries = [
    "in:anywhere subject:\"Form submission from:\"",
    "in:anywhere \"New Contact\" \"Company Name\" \"Interested in\"",
    "in:anywhere \"First Name\" \"Last Name\" \"Preferred Language\"",
    "in:anywhere \"Your inquiry\" \"Business Type\" \"Interested in\"",
    "in:anywhere \"Name & Surname\" \"E-mail\" \"Interested in\""
  ];
  var deepScan = options.deepScan === true;
  var operational = options.operational === true;
  var afterDate = formatAfterDate(options.nowMs == null ? Date.now() : options.nowMs, options.lookbackDays);
  var queries = deepScan ? baseQueries.concat(deepQueries) : baseQueries.map(function (query) {
    return `${query} after:${afterDate}`;
  });
  var listing = await listGmailMessagesForQueries({
    delegatedUser: delegatedUser,
    accessToken: accessToken,
    fetchImpl: fetchImpl,
    queries: queries,
    pageSize: operational ? OPERATIONAL_PAGE_SIZE : (deepScan ? 3 : 15),
    maxResultsPerQuery: operational ? OPERATIONAL_MAX_RESULTS_PER_QUERY : (deepScan ? 3 : 15),
    candidateLimit: operational ? Infinity : (deepScan ? 21 : 12),
    requestTimeoutMs: options.requestTimeoutMs
  });
  var messageIds = listing.messageIds;

  var parsedMessages = await mapWithConcurrency(messageIds, MESSAGE_FETCH_CONCURRENCY, async function (messageId) {
    var messageUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/messages/${encodeURIComponent(messageId)}`
    );
    messageUrl.searchParams.set("format", "full");
    var message = await gmailFetch(fetchImpl, messageUrl.toString(), accessToken, undefined, options.requestTimeoutMs);
    return gmailLeadParser.parseGmailLeadMessage(message, { nowMs: options.nowMs, timeZone: options.timeZone });
  });
  var accepted = parsedMessages.filter(Boolean);
  return {
    queries: listing.stats,
    candidateMessages: messageIds.length,
    acceptedMessages: accepted,
    complete: listing.complete,
    operational: operational,
    appendPayloadReady: accepted.every(hasCompleteAppendPayload)
  };
}

async function scanGmailOnboardingMessages(options) {
  options = options || {};
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  var accessToken = await createDelegatedAccessToken(options);
  var fetchImpl = options.fetchImpl || fetch;
  var operational = options.operational === true;
  var afterDate = formatAfterDate(options.nowMs == null ? Date.now() : options.nowMs, options.lookbackDays);
  var queries = [
    `in:anywhere "ONBOARDING SENT" after:${afterDate}`,
    `in:anywhere subject:"Onboarding form sent" after:${afterDate}`
  ];
  var listing = await listGmailMessagesForQueries({
    delegatedUser: delegatedUser,
    accessToken: accessToken,
    fetchImpl: fetchImpl,
    queries: queries,
    pageSize: operational ? OPERATIONAL_PAGE_SIZE : 15,
    maxResultsPerQuery: operational ? OPERATIONAL_MAX_RESULTS_PER_QUERY : 15,
    candidateLimit: operational ? Infinity : 12,
    requestTimeoutMs: options.requestTimeoutMs
  });
  var messageIds = listing.messageIds;

  var parsedMessages = await mapWithConcurrency(messageIds, MESSAGE_FETCH_CONCURRENCY, async function (messageId) {
    var messageUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/messages/${encodeURIComponent(messageId)}`
    );
    messageUrl.searchParams.set("format", "full");
    var message = await gmailFetch(fetchImpl, messageUrl.toString(), accessToken, undefined, options.requestTimeoutMs);
    return gmailLeadParser.parseGmailOnboardingMessage(message, { timeZone: options.timeZone });
  });
  return {
    queries: listing.stats,
    candidateMessages: messageIds.length,
    acceptedMessages: parsedMessages.filter(Boolean),
    complete: listing.complete,
    operational: operational
  };
}

async function listGmailMessagesForQueries(options) {
  var seen = new Set();
  var messageIds = [];
  var stats = [];
  var candidateLimit = Number.isFinite(options.candidateLimit) ? Math.max(0, options.candidateLimit) : Infinity;
  for (var queryIndex = 0; queryIndex < options.queries.length; queryIndex += 1) {
    var query = options.queries[queryIndex];
    var queryMessages = [];
    var nextPageToken = "";
    var pages = 0;
    do {
      var remaining = options.maxResultsPerQuery - queryMessages.length;
      if (remaining <= 0) break;
      var listUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(options.delegatedUser)}/messages`);
      listUrl.searchParams.set("q", query);
      listUrl.searchParams.set("maxResults", String(Math.min(options.pageSize, remaining)));
      if (nextPageToken) listUrl.searchParams.set("pageToken", nextPageToken);
      var listResponse = await gmailFetch(
        options.fetchImpl,
        listUrl.toString(),
        options.accessToken,
        undefined,
        options.requestTimeoutMs
      );
      var listed = Array.isArray(listResponse.messages) ? listResponse.messages : [];
      queryMessages.push.apply(queryMessages, listed);
      nextPageToken = normalize(listResponse.nextPageToken);
      pages += 1;
    } while (nextPageToken && queryMessages.length < options.maxResultsPerQuery);

    stats.push({
      query: query,
      returned: queryMessages.length,
      pages: pages,
      hitLimit: queryMessages.length >= options.maxResultsPerQuery,
      hasMore: Boolean(nextPageToken)
    });
    queryMessages.forEach(function (message) {
      var id = normalize(message && message.id);
      if (!id || seen.has(id) || messageIds.length >= candidateLimit) return;
      seen.add(id);
      messageIds.push(id);
    });
  }
  return {
    messageIds: messageIds,
    stats: stats,
    complete: stats.every(function (stat) { return stat.hasMore === false; })
  };
}

async function renewGmailWatch(options) {
  options = options || {};
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  var topicName = normalize(options.topicName);
  if (!/^projects\/[a-z][a-z0-9-]{4,28}[a-z0-9]\/topics\/[A-Za-z][A-Za-z0-9._~-]{2,254}$/.test(topicName)) {
    throw new Error("A fully qualified Gmail Pub/Sub topic is required.");
  }
  var accessToken = await createDelegatedAccessToken(options);
  var fetchImpl = options.fetchImpl || fetch;
  var response = await gmailFetch(
    fetchImpl,
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/watch`,
    accessToken,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicName: topicName })
    },
    options.requestTimeoutMs
  );
  if (!normalize(response.historyId) || !normalize(response.expiration)) {
    throw new Error("Gmail watch did not return a history cursor and expiration.");
  }
  return {
    emailAddress: delegatedUser,
    historyId: normalize(response.historyId),
    expiration: normalize(response.expiration)
  };
}

async function loadGmailHistory(options) {
  options = options || {};
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  var startHistoryId = normalize(options.startHistoryId);
  if (!startHistoryId) throw new Error("A Gmail history cursor is required.");
  var accessToken = await createDelegatedAccessToken(options);
  var fetchImpl = options.fetchImpl || fetch;
  var messageIds = [];
  var seen = new Set();
  var nextPageToken = "";
  var pages = 0;
  var latestHistoryId = startHistoryId;
  do {
    var historyUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/history`
    );
    historyUrl.searchParams.set("startHistoryId", startHistoryId);
    historyUrl.searchParams.set("historyTypes", "messageAdded");
    historyUrl.searchParams.set("maxResults", "500");
    if (nextPageToken) historyUrl.searchParams.set("pageToken", nextPageToken);
    var historyResponse = await gmailFetch(
      fetchImpl,
      historyUrl.toString(),
      accessToken,
      undefined,
      options.requestTimeoutMs
    );
    (Array.isArray(historyResponse.history) ? historyResponse.history : []).forEach(function (record) {
      (Array.isArray(record.messagesAdded) ? record.messagesAdded : []).forEach(function (added) {
        var id = normalize(added && added.message && added.message.id);
        if (!id || seen.has(id)) return;
        seen.add(id);
        messageIds.push(id);
      });
    });
    latestHistoryId = normalize(historyResponse.historyId) || latestHistoryId;
    nextPageToken = normalize(historyResponse.nextPageToken);
    pages += 1;
  } while (nextPageToken);

  var parsed = await mapWithConcurrency(messageIds, MESSAGE_FETCH_CONCURRENCY, async function (messageId) {
    var messageUrl = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/messages/${encodeURIComponent(messageId)}`
    );
    messageUrl.searchParams.set("format", "full");
    var message = await gmailFetch(fetchImpl, messageUrl.toString(), accessToken, undefined, options.requestTimeoutMs);
    return {
      lead: gmailLeadParser.parseGmailLeadMessage(message, { nowMs: options.nowMs, timeZone: options.timeZone }),
      onboarding: gmailLeadParser.parseGmailOnboardingMessage(message, { timeZone: options.timeZone })
    };
  });
  return {
    startHistoryId: startHistoryId,
    historyId: latestHistoryId,
    pages: pages,
    candidateMessages: messageIds.length,
    acceptedLeadMessages: parsed.map(function (item) { return item.lead; }).filter(Boolean),
    acceptedOnboardingMessages: parsed.map(function (item) { return item.onboarding; }).filter(Boolean)
  };
}

async function mapWithConcurrency(values, concurrency, worker) {
  var results = new Array(values.length);
  var cursor = 0;
  async function runWorker() {
    while (cursor < values.length) {
      var index = cursor;
      cursor += 1;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), values.length || 1) }, runWorker));
  return results;
}

function hasCompleteAppendPayload(message) {
  var values = message && message.values;
  return Boolean(values) && gmailLeadParser.APPEND_HEADERS.every(function (header) {
    return Object.hasOwn(values, header);
  }) && normalize(values["Gmail Message ID"]) === normalize(message.messageId);
}

async function gmailFetch(fetchImpl, url, accessToken, request, requestTimeoutMs) {
  request = request || {};
  var headers = Object.assign({}, request.headers || {}, { Authorization: `Bearer ${accessToken}` });
  var response = await fetchWithTimeout(
    fetchImpl,
    url,
    Object.assign({}, request, { headers: headers }),
    requestTimeoutMs
  );
  var body = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    var error = new Error(`Gmail API request failed (HTTP ${Number(response.status) || 0}).`);
    error.statusCode = Number(response.status) || 0;
    throw error;
  }
  return body;
}

async function fetchWithTimeout(fetchImpl, url, request, requestTimeoutMs) {
  var timeoutMs = positiveNumber(requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS);
  var requestOptions = Object.assign({}, request || {});
  if (!requestOptions.signal) requestOptions.signal = AbortSignal.timeout(timeoutMs);
  try {
    return await fetchImpl(url, requestOptions);
  } catch (error) {
    if (error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      var timeoutError = new Error("Google API request timed out.");
      timeoutError.code = "deadline-exceeded";
      throw timeoutError;
    }
    throw error;
  }
}

function formatAfterDate(nowMs, lookbackDays) {
  var date = new Date(Number(nowMs));
  var days = Number(lookbackDays);
  if (Number.isFinite(days) && days > 0) date.setUTCDate(date.getUTCDate() - Math.floor(days));
  else date.setUTCMonth(date.getUTCMonth() - 3);
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("/");
}

function nonNegativeNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function positiveNumber(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  GMAIL_READONLY_SCOPE,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MESSAGE_FETCH_CONCURRENCY,
  OAUTH_TOKEN_URL,
  OPERATIONAL_MAX_RESULTS_PER_QUERY,
  OPERATIONAL_PAGE_SIZE,
  createDelegatedAccessToken,
  loadGmailHistory,
  listGmailMessagesForQueries,
  probeGmailMailbox,
  renewGmailWatch,
  scanGmailLeadMessages,
  scanGmailOnboardingMessages
};
