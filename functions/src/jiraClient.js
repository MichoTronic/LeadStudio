"use strict";

async function probeJiraConnection(options) {
  options = options || {};
  var config = createConfig(options);
  var response = await jiraFetch(config, "/rest/api/3/myself", options.fetchImpl);
  var body = await safeJson(response);
  assertJiraResponse(response);
  if (!normalize(body.accountId)) throw new Error("Jira connection returned an invalid profile.");
  return {
    accountId: normalize(body.accountId),
    displayName: normalize(body.displayName),
    active: body.active !== false
  };
}

async function loadJiraIssueStatuses(options) {
  options = options || {};
  var config = createConfig(options);
  var issueKeys = uniqueIssueKeys(options.issueKeys).slice(0, 100);
  var statuses = {};
  for (var offset = 0; offset < issueKeys.length; offset += 50) {
    var batch = issueKeys.slice(offset, offset + 50);
    var query = new URLSearchParams({
      jql: `key in (${batch.join(",")})`,
      fields: "status",
      maxResults: String(batch.length)
    });
    var response = await jiraFetch(config, `/rest/api/3/search/jql?${query.toString()}`, options.fetchImpl);
    var body = await safeJson(response);
    assertJiraResponse(response);
    (Array.isArray(body.issues) ? body.issues : []).forEach(function (issue) {
      var key = normalizeIssueKey(issue && issue.key);
      if (!key) return;
      statuses[key] = {
        issueKey: key,
        status: normalize(issue && issue.fields && issue.fields.status && issue.fields.status.name)
      };
    });
  }
  return statuses;
}

async function findJiraIssueForContact(options) {
  options = options || {};
  var config = createConfig(options);
  var contactEmail = normalize(options.contactEmail).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new Error("Jira contact email is invalid.");
  }
  var escapedEmail = contactEmail.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
  var query = new URLSearchParams({
    jql: `text ~ "${escapedEmail}" ORDER BY updated DESC`,
    fields: "status",
    maxResults: "5"
  });
  var response = await jiraFetch(config, `/rest/api/3/search/jql?${query.toString()}`, options.fetchImpl);
  var body = await safeJson(response);
  assertJiraResponse(response);
  var issue = Array.isArray(body.issues) ? body.issues[0] : null;
  var issueKey = normalizeIssueKey(issue && issue.key);
  if (!issueKey) return null;
  return {
    issueKey: issueKey,
    status: normalize(issue && issue.fields && issue.fields.status && issue.fields.status.name)
  };
}

async function loadJiraIssueByKey(options) {
  options = options || {};
  var config = createConfig(options);
  var issueKey = normalizeIssueKey(options.issueKey);
  if (!issueKey) throw new Error("Jira issue key is invalid.");
  var response = await jiraFetch(
    config,
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`,
    options.fetchImpl
  );
  var body = await safeJson(response);
  if (response && response.status === 404) return null;
  assertJiraResponse(response);
  var returnedKey = normalizeIssueKey(body.key);
  if (!returnedKey) throw new Error("Jira issue lookup returned an invalid issue.");
  return {
    issueKey: returnedKey,
    status: normalize(body.fields && body.fields.status && body.fields.status.name)
  };
}

function createConfig(options) {
  var baseUrl = normalizeBaseUrl(options.baseUrl);
  var email = normalize(options.email).toLowerCase();
  var apiToken = normalize(options.apiToken);
  if (!email || !email.includes("@") || !apiToken) throw new Error("Jira access is not configured.");
  return {
    baseUrl: baseUrl,
    authorization: `Basic ${Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64")}`
  };
}

async function jiraFetch(config, path, fetchImpl) {
  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timeout = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;
  try {
    return await (fetchImpl || fetch)(`${config.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: config.authorization
      },
      signal: controller ? controller.signal : undefined
    });
  } catch (_) {
    throw new Error("Jira connection could not be reached.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function assertJiraResponse(response) {
  if (!response || !response.ok) {
    throw new Error(`Jira connection failed (HTTP ${Number(response && response.status) || 0}).`);
  }
}

async function safeJson(response) {
  return response && response.json ? response.json().catch(function () { return {}; }) : {};
}

function uniqueIssueKeys(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(normalizeIssueKey).filter(Boolean)));
}

function normalizeIssueKey(value) {
  var match = normalize(value).toUpperCase().match(/^[A-Z][A-Z0-9]+-\d+$/);
  return match ? match[0] : "";
}

function normalizeBaseUrl(value) {
  var parsed;
  try {
    parsed = new URL(normalize(value));
  } catch (_) {
    throw new Error("Jira base URL is invalid.");
  }
  if (
    parsed.protocol !== "https:" ||
    !parsed.hostname.toLowerCase().endsWith(".atlassian.net") ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Jira base URL must be an HTTPS *.atlassian.net site.");
  }
  return parsed.origin;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  findJiraIssueForContact,
  loadJiraIssueByKey,
  loadJiraIssueStatuses,
  normalizeBaseUrl,
  normalizeIssueKey,
  probeJiraConnection
};
