"use strict";

var TRUSTED_SENDERS = new Set(["noreply@timelesstech.io", "no-reply@timelesstech.io"]);
var MAILBOX = "marketing@timelesstech.io";

function parseGmailLeadMessage(message) {
  var headers = headerMap(message && message.payload && message.payload.headers);
  var body = normalizeBody(extractBody(message && message.payload));
  if (!isLeadMatch(headers, body)) return null;
  var parsed = parseLeadBody(headers, body);
  return {
    messageId: normalize(message && message.id),
    contactEmail: normalize(parsed.contactEmail).toLowerCase(),
    companyName: normalize(parsed.companyName),
    format: parsed.format
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
    return {
      contactEmail: extractField(body, "E-mail", ["Phone number", "Address", "Message"]),
      companyName: "",
      format: "legacy"
    };
  }
  if (subject.startsWith("contact form (tlt-webpage-") || isOldBody(body)) {
    return {
      contactEmail: extractField(body, "E-mail", ["Phone Number"]) || extractField(body, "Email", ["Phone Number"]),
      companyName: extractField(body, "Company Name", ["Business Type"]),
      format: "old"
    };
  }
  return {
    contactEmail: extractField(body, "Email", ["Phone"]),
    companyName: extractField(body, "Company Name", ["Interested in"]),
    format: "new"
  };
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
  extractBody,
  normalizeBody,
  parseGmailLeadMessage
};
