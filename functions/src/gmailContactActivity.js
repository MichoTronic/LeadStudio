"use strict";

var workspaceDelegation = require("./workspaceDelegation");
var mapWithConcurrency = require("./asyncUtils").mapWithConcurrency;

var MAX_RELATED_MESSAGES = 30;
var MAX_CONVERSATIONS = 8;
var MAX_MESSAGES = 40;
var MAX_BODY_CHARS = 12000;
var FETCH_CONCURRENCY = 4;
var REQUEST_TIMEOUT_MS = 15 * 1000;

async function loadContactActivity(options) {
  options = options || {};
  var lead = options.lead || {};
  var delegatedUser = normalize(options.delegatedUser).toLowerCase();
  var contactEmail = normalize(lead.contactEmail).toLowerCase();
  if (!delegatedUser || !validEmail(contactEmail)) {
    return emptyActivity();
  }

  var fetchImpl = options.fetchImpl || fetch;
  var requestTimeoutMs = Number(options.requestTimeoutMs) > 0 ? Number(options.requestTimeoutMs) : REQUEST_TIMEOUT_MS;
  var accessToken = normalize(options.accessToken) || await workspaceDelegation.createDelegatedAccessToken(options);
  var threadKinds = new Map();
  addThread(threadKinds, lead.gmailThreadId, "original");

  var onboardingMessageIds = splitIds(lead.onboardingMessageId).slice(0, 8);
  var onboardingMessages = await mapWithConcurrency(onboardingMessageIds, FETCH_CONCURRENCY, function (messageId) {
    return gmailFetch(fetchImpl, messageUrl(delegatedUser, messageId, "metadata"), accessToken, true, requestTimeoutMs);
  });
  onboardingMessages.filter(Boolean).forEach(function (message) {
    addThread(threadKinds, message.threadId, "onboarding");
  });

  var searchUrl = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(delegatedUser)}/messages`);
  searchUrl.searchParams.set("q", relatedContactQuery(contactEmail, lead.emailDate));
  searchUrl.searchParams.set("maxResults", String(MAX_RELATED_MESSAGES));
  var relatedListing = await gmailFetch(fetchImpl, searchUrl.toString(), accessToken, false, requestTimeoutMs);
  var relatedMessages = Array.isArray(relatedListing.messages) ? relatedListing.messages : [];
  relatedMessages.forEach(function (message) { addThread(threadKinds, message && message.threadId, "related"); });

  var threadEntries = Array.from(threadKinds.entries());
  var selectedThreads = threadEntries.slice(0, MAX_CONVERSATIONS);
  var fetchedThreads = await mapWithConcurrency(selectedThreads, FETCH_CONCURRENCY, function (entry) {
    return gmailFetch(fetchImpl, threadUrl(delegatedUser, entry[0]), accessToken, true, requestTimeoutMs)
      .then(function (thread) { return thread ? { thread: thread, kind: entry[1] } : null; });
  });

  var shapedConversations = fetchedThreads.filter(Boolean).map(function (result) {
    return shapeConversation(result.thread, result.kind, delegatedUser, contactEmail);
  }).filter(function (conversation) {
    return conversation.messages.length > 0;
  }).sort(function (left, right) {
    return Date.parse(right.latestAt || 0) - Date.parse(left.latestAt || 0);
  });

  var remainingMessages = MAX_MESSAGES;
  var omittedMessages = false;
  var conversations = shapedConversations.map(function (conversation) {
    if (remainingMessages <= 0) {
      omittedMessages = true;
      return null;
    }
    if (conversation.messages.length > remainingMessages) {
      conversation.messages = conversation.messages.slice(0, remainingMessages);
      conversation.truncated = true;
      omittedMessages = true;
    }
    remainingMessages -= conversation.messages.length;
    return conversation;
  }).filter(Boolean).map(function (conversation, index) {
    return Object.assign({ key: `conversation-${index + 1}` }, conversation);
  });

  return {
    conversations: conversations,
    conversationCount: conversations.length,
    messageCount: conversations.reduce(function (total, conversation) { return total + conversation.messages.length; }, 0),
    truncated: threadEntries.length > selectedThreads.length || Boolean(relatedListing.nextPageToken) || omittedMessages,
    loadedAt: new Date().toISOString()
  };
}

function shapeConversation(thread, kind, mailbox, contactEmail) {
  var messages = (Array.isArray(thread && thread.messages) ? thread.messages : []).map(function (message) {
    return shapeMessage(message, mailbox, contactEmail);
  }).filter(Boolean).sort(function (left, right) {
    return Date.parse(right.date || 0) - Date.parse(left.date || 0);
  });
  var subjectMessage = messages.find(function (message) { return message.subject; });
  return {
    kind: kind,
    label: kindLabel(kind),
    subject: subjectMessage ? subjectMessage.subject : "Email conversation",
    latestAt: messages.length ? messages[0].date : "",
    truncated: false,
    messages: messages
  };
}

function shapeMessage(message, mailbox, contactEmail) {
  if (!message || !message.payload) return null;
  var headers = headerMap(message.payload.headers);
  var subject = limited(headers.subject, 500);
  var from = limited(headers.from, 1000);
  var to = limited(headers.to, 1500);
  var cc = limited(headers.cc, 1500);
  var bcc = limited(headers.bcc, 1500);
  var date = messageDate(message, headers.date);
  var bodyResult = extractPlainText(message.payload);
  var text = bodyResult.text.slice(0, MAX_BODY_CHARS);
  var direction = messageDirection(from, [to, cc, bcc].join(" "), subject, mailbox);
  return {
    direction: direction,
    directionLabel: directionLabel(direction),
    date: date,
    from: from || "-",
    to: to || "-",
    cc: cc,
    bcc: bcc,
    subject: subject || "(no subject)",
    text: text || "No plain-text content available.",
    excerpt: excerpt(text),
    bodyTruncated: bodyResult.text.length > MAX_BODY_CHARS,
    involvesContact: [from, to, cc, bcc].join(" ").toLowerCase().includes(contactEmail)
  };
}

function extractPlainText(payload) {
  var parts = collectTextParts(payload, { plain: [], html: [] });
  var source = parts.plain.length ? parts.plain.join("\n\n") : parts.html.join("\n\n");
  return { text: cleanMessageText(source, parts.plain.length === 0) };
}

function collectTextParts(part, output) {
  if (!part) return output;
  var mimeType = normalize(part.mimeType).toLowerCase();
  var filename = normalize(part.filename);
  if (!filename && part.body && part.body.data) {
    var decoded = decodeBase64Url(part.body.data);
    if (mimeType === "text/plain") output.plain.push(decoded);
    else if (mimeType === "text/html") output.html.push(decoded);
  }
  (Array.isArray(part.parts) ? part.parts : []).forEach(function (child) {
    collectTextParts(child, output);
  });
  return output;
}

function cleanMessageText(value, html) {
  var text = String(value || "");
  if (html) {
    var quoteStart = text.search(/<div[^>]+class=["'][^"']*gmail_quote/i);
    if (quoteStart >= 0) text = text.slice(0, quoteStart);
    text = text
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|\/h[1-6])\s*\/?>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (_, hex) { return safeCodePoint(parseInt(hex, 16)); })
      .replace(/&#(\d+);/g, function (_, decimal) { return safeCodePoint(parseInt(decimal, 10)); });
  }
  text = text.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u034f\u200b-\u200d\ufeff]/g, "");
  var quoteMarkers = [
    /\nOn [^\n]{1,240} wrote:\s*\n/i,
    /\n-{2,}\s*Original Message\s*-{2,}\s*\n/i,
    /\nFrom:\s*[^\n]+\n(?:Sent|Date):\s*[^\n]+\nTo:\s*[^\n]+\nSubject:\s*[^\n]+/i
  ];
  var cutAt = quoteMarkers.reduce(function (earliest, pattern) {
    var match = pattern.exec(text);
    return match && match.index > 20 ? Math.min(earliest, match.index) : earliest;
  }, text.length);
  return text.slice(0, cutAt).split("\n").map(function (line) {
    return line.replace(/[ \t]+/g, " ").trim();
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function messageDirection(from, recipients, subject, mailbox) {
  var senderEmail = extractEmail(from).toLowerCase();
  if (senderEmail === mailbox) return /^(?:fwd?|fw):/i.test(subject) ? "forwarded" : "outgoing";
  if (String(recipients || "").toLowerCase().includes(mailbox)) return "incoming";
  return "related";
}

function directionLabel(direction) {
  if (direction === "incoming") return "Incoming";
  if (direction === "outgoing") return "Outgoing";
  if (direction === "forwarded") return "Forwarded";
  return "Related";
}

function kindLabel(kind) {
  if (kind === "original") return "Original lead";
  if (kind === "onboarding") return "Onboarding";
  return "Related email";
}

function relatedContactQuery(email, emailDate) {
  var query = `{from:${email} to:${email} cc:${email} bcc:${email}}`;
  var parsed = Date.parse(normalize(emailDate));
  if (!Number.isFinite(parsed)) return query;
  var date = new Date(parsed - 7 * 24 * 60 * 60 * 1000);
  return `${query} after:${date.getUTCFullYear()}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addThread(map, threadId, kind) {
  var id = normalize(threadId);
  if (!id) return;
  var current = map.get(id);
  var rank = { related: 1, onboarding: 2, original: 3 };
  if (!current || rank[kind] > rank[current]) map.set(id, kind);
}

function messageUrl(user, messageId, format) {
  var url = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(user)}/messages/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", format || "metadata");
  return url.toString();
}

function threadUrl(user, threadId) {
  var url = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(user)}/threads/${encodeURIComponent(threadId)}`);
  url.searchParams.set("format", "full");
  return url.toString();
}

async function gmailFetch(fetchImpl, url, accessToken, allowNotFound, requestTimeoutMs) {
  var response = await workspaceDelegation.fetchWithTimeout(
    fetchImpl,
    url,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    requestTimeoutMs
  );
  var body = await response.json().catch(function () { return {}; });
  if (allowNotFound && response.status === 404) return null;
  if (!response.ok) throw new Error(`Gmail contact activity request failed (HTTP ${Number(response.status) || 0}).`);
  return body;
}

function messageDate(message, headerDate) {
  var internal = Number(message && message.internalDate);
  if (Number.isFinite(internal) && internal > 0) return new Date(internal).toISOString();
  var parsed = Date.parse(normalize(headerDate));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : "";
}

function headerMap(headers) {
  return (Array.isArray(headers) ? headers : []).reduce(function (output, header) {
    output[normalize(header && header.name).toLowerCase()] = normalize(header && header.value);
    return output;
  }, {});
}

function extractEmail(value) {
  var match = normalize(value).match(/<([^>]+)>/);
  return normalize(match && match[1] || value).replace(/^mailto:/i, "");
}

function excerpt(value) {
  var compact = normalize(String(value || "").replace(/\s+/g, " "));
  return compact.length > 220 ? `${compact.slice(0, 217)}...` : compact;
}

function decodeBase64Url(value) {
  var normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function safeCodePoint(value) {
  try { return String.fromCodePoint(value); } catch (_) { return ""; }
}

function splitIds(value) {
  return normalize(value).split(",").map(normalize).filter(Boolean);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function limited(value, limit) {
  return normalize(value).slice(0, limit);
}

function emptyActivity() {
  return { conversations: [], conversationCount: 0, messageCount: 0, truncated: false, loadedAt: new Date().toISOString() };
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  MAX_BODY_CHARS,
  MAX_CONVERSATIONS,
  MAX_MESSAGES,
  REQUEST_TIMEOUT_MS,
  cleanMessageText,
  extractPlainText,
  loadContactActivity,
  messageDirection,
  relatedContactQuery,
  shapeMessage
};
