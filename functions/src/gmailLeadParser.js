"use strict";

var TRUSTED_SENDERS = new Set(["noreply@timelesstech.io", "no-reply@timelesstech.io"]);
var MAILBOX = "marketing@timelesstech.io";
var DEFAULT_TIME_ZONE = "Europe/Ljubljana";
var APPEND_HEADERS = Object.freeze([
  "Found At", "Email Date", "Name", "Last Name", "Contact Email", "Target Region", "Phone", "Address",
  "Business Type", "Company Name", "Interested in", "Inquiry", "Language", "Subject", "Sender",
  "Extracted Content", "Full Body", "Gmail Message ID", "Gmail Thread ID", "Onboarding Sent",
  "Onboarding Sent At", "Onboarding Message ID", "Jira Issue Key", "Jira Issue URL", "Jira Match Source",
  "Jira Status", "Lead Status", "Onboarding Complete", "Onboarding Submitted At", "Onboarding Sheet Row",
  "Info Sheet", "Onboarding Doc", "Last Jira Check", "Notes", "Last Checked"
]);

function parseGmailLeadMessage(message, options) {
  options = options || {};
  var headers = headerMap(message && message.payload && message.payload.headers);
  var body = normalizeBody(extractBody(message && message.payload));
  if (!isLeadMatch(headers, body)) return null;
  var parsed = parseLeadBody(headers, body);
  var foundAt = formatDateTime(options.nowMs == null ? Date.now() : options.nowMs, options.timeZone || DEFAULT_TIME_ZONE);
  var values = emptyAppendValues();
  Object.assign(values, {
    "Found At": foundAt,
    "Email Date": formatEmailDate(headers.Date, options.timeZone || DEFAULT_TIME_ZONE),
    "Name": parsed.name,
    "Last Name": parsed.lastName,
    "Contact Email": parsed.contactEmail,
    "Phone": parsed.phone,
    "Address": parsed.address,
    "Business Type": parsed.businessType,
    "Company Name": parsed.companyName,
    "Interested in": parsed.interestedIn,
    "Inquiry": parsed.inquiry,
    "Language": parsed.language,
    "Subject": normalize(headers.Subject),
    "Sender": normalize(headers.From),
    "Extracted Content": buildExtractedContent(parsed),
    "Full Body": body,
    "Gmail Message ID": normalize(message && message.id),
    "Gmail Thread ID": normalize(message && message.threadId),
    "Onboarding Complete": "No",
    "Last Jira Check": foundAt,
    "Last Checked": foundAt
  });
  return {
    messageId: normalize(message && message.id),
    contactEmail: normalize(parsed.contactEmail).toLowerCase(),
    companyName: normalize(parsed.companyName),
    format: parsed.format,
    values: values
  };
}

function parseGmailOnboardingMessage(message, options) {
  options = options || {};
  var headers = headerMap(message && message.payload && message.payload.headers);
  var body = normalizeBody(extractBody(message && message.payload));
  var subject = normalize(headers.Subject).toLowerCase();
  var normalizedBody = normalize(body).toLowerCase();
  var matches = subject.includes("onboarding form sent") ||
    normalizedBody.startsWith("onboarding sent") ||
    (normalizedBody.includes("onboarding sent") && normalizedBody.includes("we've just received new contact form from"));
  if (!matches) return null;
  var countMatch = body.match(/ONBOARDING SENT\s+(\d+)\s+TIME/i);
  return {
    messageId: normalize(message && message.id),
    threadId: normalize(message && message.threadId),
    contactEmail: extractField(body, "Email", ["Phone"]).toLowerCase(),
    countHint: countMatch && countMatch[1] ? Number(countMatch[1]) || 0 : 0,
    emailDate: formatEmailDate(headers.Date, options.timeZone || DEFAULT_TIME_ZONE),
    subject: normalize(headers.Subject)
  };
}

function isLeadMatch(headers, body) {
  var sender = extractEmail(headers.From).toLowerCase();
  var recipients = [headers.To, headers.Cc, headers.Bcc, headers["Delivered-To"], headers["X-Original-To"]]
    .map(normalize).join(" ").toLowerCase();
  var subject = normalize(headers.Subject).toLowerCase();
  var normalizedBody = normalize(body).toLowerCase();
  return TRUSTED_SENDERS.has(sender) &&
    (recipients.includes(MAILBOX) || subject === "new contact") &&
    (
      isNewBody(normalizedBody) ||
      subject.startsWith("contact form (tlt-webpage-") ||
      isOldBody(normalizedBody) ||
      (subject.startsWith("form submission from:") && isLegacyBody(normalizedBody))
    );
}

function parseLeadBody(headers, body) {
  var subject = normalize(headers.Subject).toLowerCase();
  if (subject.startsWith("form submission from:") && isLegacyBody(body)) {
    var fullName = extractField(body, "Name & Surname", ["E-mail"]);
    var nameParts = splitFullName(fullName);
    return {
      name: nameParts.name,
      lastName: nameParts.lastName,
      contactEmail: extractField(body, "E-mail", ["Phone number", "Address", "Message"]),
      phone: extractField(body, "Phone number", ["Address", "Message"]),
      address: extractField(body, "Address", ["Message"]),
      businessType: "",
      companyName: "",
      interestedIn: normalizeInterestedIn(extractField(body, "Interested in", ["Name & Surname"])),
      inquiry: extractField(body, "Message", ["Subscribe to our newsletter", "I agree to the processing"]),
      language: "",
      format: "legacy"
    };
  }
  if (subject.startsWith("contact form (tlt-webpage-") || isOldBody(body)) {
    return {
      name: extractField(body, "First Name", ["Last Name"]),
      lastName: extractField(body, "Last Name", ["E-mail", "Email"]),
      contactEmail: extractField(body, "E-mail", ["Phone Number"]) || extractField(body, "Email", ["Phone Number"]),
      phone: extractField(body, "Phone Number", ["Address"]),
      address: extractField(body, "Address", ["Preferred Language"]),
      businessType: normalizeBusinessType(extractField(body, "Business Type", ["Interested in"])),
      companyName: extractField(body, "Company Name", ["Business Type"]),
      interestedIn: normalizeInterestedIn(extractField(body, "Interested in", ["Your inquiry", "Your Inquiry"])),
      inquiry: extractField(body, "Your inquiry", []) || extractField(body, "Your Inquiry", []),
      language: normalizeLanguage(extractField(body, "Preferred Language", ["Company Name"])),
      format: "old"
    };
  }
  return {
    name: extractField(body, "Name", ["Last Name"]),
    lastName: extractField(body, "Last Name", ["Email"]),
    contactEmail: extractField(body, "Email", ["Phone"]),
    phone: extractField(body, "Phone", ["Address"]),
    address: extractField(body, "Address", ["Busines Type", "Business Type"]),
    businessType: normalizeBusinessType(
      extractField(body, "Busines Type", ["Company Name"]) || extractField(body, "Business Type", ["Company Name"])
    ),
    companyName: extractField(body, "Company Name", ["Interested in"]),
    interestedIn: normalizeInterestedIn(extractField(body, "Interested in", ["Inquiry"])),
    inquiry: extractField(body, "Inquiry", ["Language"]),
    language: normalizeLanguage(extractField(body, "Language", [])),
    format: "new"
  };
}

function emptyAppendValues() {
  return Object.fromEntries(APPEND_HEADERS.map(function (header) { return [header, ""]; }));
}

function buildExtractedContent(parsed) {
  return [
    parsed.businessType ? `Business Type: ${parsed.businessType}` : "",
    parsed.interestedIn ? `Interested in: ${parsed.interestedIn}` : "",
    parsed.language ? `Language: ${parsed.language}` : ""
  ].filter(Boolean).join(" | ");
}

function splitFullName(value) {
  var parts = normalize(value).split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { name: normalize(value), lastName: "" };
  return { name: parts.shift(), lastName: parts.join(" ") };
}

function normalizeLanguage(value) {
  var raw = normalize(value);
  if (!raw) return "";
  var tokenMatch = raw.match(/^([a-z]{2})(?:\b|[^a-z])/i);
  var token = tokenMatch ? tokenMatch[1].toLowerCase() : normalize(raw.split(/\s+/)[0]).toLowerCase();
  var lower = raw.toLowerCase();
  if (token === "en" || lower.startsWith("english")) return "English";
  if (token === "es" || lower.startsWith("espanol") || lower.startsWith("espa\u00f1ol")) return "Espa\u00f1ol";
  if (token === "pt" || lower.startsWith("portugu")) return "Portugu\u00eas";
  return token || raw;
}

function normalizeBusinessType(value) {
  return normalizeOption(value, {
    game_provider: "Game Provider",
    platform_operator: "Platform Operator",
    affiliate: "Affiliate",
    game_aggregator: "Game Aggregator",
    other: "Other"
  });
}

function normalizeInterestedIn(value) {
  var raw = normalize(value);
  if (!raw) return "";
  var values = {
    game_aggregator: "Game Aggregator",
    bonus_engine: "Bonus Engine",
    bonus_engine_gamification: "Bonus Engine",
    white_label: "White Label",
    betexchange: "BetExchange",
    bet_exchange: "BetExchange",
    betting_exchange: "BetExchange",
    beting_exchange: "BetExchange",
    other: "Other",
    ohter: "Other"
  };
  return raw.split(",").map(function (item) { return normalizeOption(item, values); }).filter(Boolean).join(", ");
}

function normalizeOption(value, values) {
  var raw = normalize(value);
  if (!raw) return "";
  var key = raw.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return values[key] || raw;
}

function formatEmailDate(value, timeZone) {
  var raw = normalize(value);
  var date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? formatDateParts(date, timeZone, false) : raw;
}

function formatDateTime(value, timeZone) {
  var date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) return "";
  return formatDateParts(date, timeZone, true);
}

function formatDateParts(date, timeZone, includeTime) {
  var parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: includeTime ? "2-digit" : undefined,
    minute: includeTime ? "2-digit" : undefined,
    hourCycle: "h23"
  }).formatToParts(date).map(function (part) { return [part.type, part.value]; }));
  var dateValue = `${parts.year}/${parts.month}/${parts.day}`;
  return includeTime ? `${dateValue.replace(/\//g, "-")} ${parts.hour}:${parts.minute}` : dateValue;
}

function extractBody(payload) {
  if (!payload) return "";
  if (payload.body && payload.body.data) return decodeBase64Url(payload.body.data);
  return (payload.parts || []).map(extractBody).filter(Boolean).join("\n");
}

function decodeBase64Url(value) {
  var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function normalizeBody(value) {
  return decodeEntities(String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " "))
    .replace(/[\u034f\u200b-\u200d\ufeff]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return codePoint(parseInt(hex, 16)); })
    .replace(/&#(\d+);/g, function (_, decimal) { return codePoint(parseInt(decimal, 10)); })
    .replace(/\s+/g, " ").trim();
}

function codePoint(value) {
  try { return String.fromCodePoint(value); } catch (_) { return ""; }
}

function extractField(source, label, nextLabels) {
  var next = (nextLabels || []).map(escapeRegExp);
  var end = next.length ? `(?=\\s*(?:${next.join("|")}):)` : "$";
  var match = normalize(source).match(new RegExp(`(?:^|\\s)${escapeRegExp(label)}:\\s*([\\s\\S]*?)${end}`, "i"));
  return match && match[1] ? normalize(match[1]) : "";
}

function headerMap(headers) {
  return (headers || []).reduce(function (output, header) {
    output[header.name] = header.value;
    return output;
  }, {});
}

function extractEmail(value) {
  var raw = normalize(value);
  var match = raw.match(/<([^>]+)>/);
  return match && match[1] ? match[1].trim() : (raw.includes("@") ? raw : "");
}

function isNewBody(body) {
  var value = normalize(body).toLowerCase();
  return value.startsWith("new contact") && !value.startsWith("onboarding sent") && !value.includes("onboarding form sent");
}

function isOldBody(body) {
  var value = normalize(body).toLowerCase();
  return ["first name", "last name", "preferred language", "business type", "interested in"]
    .every(function (field) { return value.includes(field); });
}

function isLegacyBody(body) {
  var value = normalize(body).toLowerCase();
  return ["interested in", "name & surname", "e-mail", "message"]
    .every(function (field) { return value.includes(field); });
}

function escapeRegExp(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  APPEND_HEADERS,
  emptyAppendValues,
  extractBody,
  formatEmailDate,
  normalizeBody,
  parseGmailLeadMessage,
  parseGmailOnboardingMessage
};
