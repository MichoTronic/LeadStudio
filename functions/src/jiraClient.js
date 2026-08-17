"use strict";

async function probeJiraConnection(options) {
  options = options || {};
  var baseUrl = normalizeBaseUrl(options.baseUrl);
  var email = normalize(options.email).toLowerCase();
  var apiToken = normalize(options.apiToken);
  if (!email || !email.includes("@") || !apiToken) {
    throw new Error("Jira access is not configured.");
  }

  var controller = typeof AbortController === "function" ? new AbortController() : null;
  var timeout = controller ? setTimeout(function () { controller.abort(); }, 10000) : null;
  var response;
  try {
    response = await (options.fetchImpl || fetch)(`${baseUrl}/rest/api/3/myself`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${Buffer.from(`${email}:${apiToken}`, "utf8").toString("base64")}`
      },
      signal: controller ? controller.signal : undefined
    });
  } catch (_) {
    throw new Error("Jira connection could not be reached.");
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  var body = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    throw new Error(`Jira connection failed (HTTP ${Number(response.status) || 0}).`);
  }
  if (!normalize(body.accountId)) {
    throw new Error("Jira connection returned an invalid profile.");
  }
  return {
    accountId: normalize(body.accountId),
    displayName: normalize(body.displayName),
    active: body.active !== false
  };
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
  normalizeBaseUrl,
  probeJiraConnection
};
