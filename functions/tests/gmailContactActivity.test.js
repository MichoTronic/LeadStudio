"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var activity = require("../src/gmailContactActivity");

function response(body, status) {
  status = status || 200;
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: async function () { return body; }
  };
}

function encoded(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function message(id, threadId, date, headers, body, mimeType) {
  return {
    id: id,
    threadId: threadId,
    internalDate: String(Date.parse(date)),
    payload: {
      mimeType: mimeType || "text/plain",
      headers: Object.keys(headers).map(function (name) { return { name: name, value: headers[name] }; }),
      body: { data: encoded(body) }
    }
  };
}

test("loads original, onboarding, and related Gmail conversations without returning provider IDs", async function () {
  var original = message("message-original", "thread-original", "2026-08-10T08:00:00Z", {
    From: "Timeless Forms <noreply@timelesstech.io>",
    To: "marketing@timelesstech.io",
    Subject: "New Contact"
  }, "New Contact\nName: Ada");
  var onboarding = message("message-onboarding", "thread-onboarding", "2026-08-11T09:00:00Z", {
    From: "Marketing <marketing@timelesstech.io>",
    To: "Ada <ada@example.com>",
    Bcc: "archive@timelesstech.io",
    Subject: "Onboarding"
  }, "Welcome to onboarding");
  var reply = message("message-reply", "thread-related", "2026-08-12T10:00:00Z", {
    From: "Ada <ada@example.com>",
    To: "Marketing <marketing@timelesstech.io>",
    Cc: "Owner <owner@example.com>",
    Subject: "Re: Partnership"
  }, "Thanks, I have completed it.\n\nOn Mon, Marketing wrote:\nOld duplicated text");
  var forwarded = message("message-forward", "thread-related", "2026-08-12T11:00:00Z", {
    From: "Marketing <marketing@timelesstech.io>",
    To: "Sales <sales@timelesstech.io>",
    Subject: "Fwd: Partnership"
  }, "Please review this contact.");

  var result = await activity.loadContactActivity({
    accessToken: "private-token",
    delegatedUser: "marketing@timelesstech.io",
    lead: {
      contactEmail: "ada@example.com",
      emailDate: "2026-08-10",
      gmailThreadId: "thread-original",
      onboardingMessageId: "message-onboarding"
    },
    fetchImpl: async function (url) {
      var parsed = new URL(url);
      if (parsed.pathname.endsWith("/messages/message-onboarding")) return response({ threadId: "thread-onboarding" });
      if (parsed.pathname.endsWith("/messages")) {
        assert.match(parsed.searchParams.get("q"), /from:ada@example\.com/);
        return response({ messages: [{ threadId: "thread-related" }, { threadId: "thread-original" }] });
      }
      if (parsed.pathname.endsWith("/threads/thread-original")) return response({ messages: [original] });
      if (parsed.pathname.endsWith("/threads/thread-onboarding")) return response({ messages: [onboarding] });
      if (parsed.pathname.endsWith("/threads/thread-related")) return response({ messages: [reply, forwarded] });
      throw new Error(`Unexpected Gmail URL: ${url}`);
    }
  });

  assert.equal(result.conversationCount, 3);
  assert.equal(result.messageCount, 4);
  assert.equal(result.conversations[0].label, "Related email");
  assert.equal(result.conversations[0].messages[0].direction, "forwarded");
  assert.equal(result.conversations[0].messages[1].direction, "incoming");
  assert.equal(result.conversations[0].messages[1].text, "Thanks, I have completed it.");
  var onboardingResult = result.conversations.find(function (conversation) { return conversation.kind === "onboarding"; });
  assert.equal(onboardingResult.messages[0].direction, "outgoing");
  assert.equal(onboardingResult.messages[0].bcc, "archive@timelesstech.io");
  assert.equal(JSON.stringify(result).includes("thread-original"), false);
  assert.equal(JSON.stringify(result).includes("message-onboarding"), false);
  assert.equal(JSON.stringify(result).includes("private-token"), false);
});

test("sanitizes HTML into readable text and removes Gmail quoted history", function () {
  var cleaned = activity.cleanMessageText(
    '<div>Hello &amp; welcome.</div><div>Second line.</div><div class="gmail_quote">Quoted secret</div>',
    true
  );
  assert.equal(cleaned, "Hello & welcome.\nSecond line.");
});

test("returns an empty bounded activity for an invalid contact email", async function () {
  var result = await activity.loadContactActivity({
    delegatedUser: "marketing@timelesstech.io",
    lead: { contactEmail: "not-an-email" },
    accessToken: "unused",
    fetchImpl: async function () { throw new Error("Gmail should not be called"); }
  });
  assert.deepEqual(result.conversations, []);
  assert.equal(result.messageCount, 0);
});
