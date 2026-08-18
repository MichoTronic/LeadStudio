"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var parser = require("../src/gmailLeadParser");

function message(id, subject, body) {
  return {
    id: id,
    payload: {
      headers: [
        { name: "From", value: "Timeless Forms <noreply@timelesstech.io>" },
        { name: "To", value: "marketing@timelesstech.io" },
        { name: "Subject", value: subject }
      ],
      body: { data: Buffer.from(body, "utf8").toString("base64url") }
    }
  };
}

test("builds the complete GAS-compatible append payload for current messages", function () {
  var parsed = parser.parseGmailLeadMessage(message(
    "gmail-1",
    "New Contact",
    "New Contact Name: Ada Last Name: Lovelace Email: ada@example.com Phone: 1 Address: EU Business Type: Operator Company Name: Analytical Engines Interested in: Platform Inquiry: Hello Language: en"
  ), { nowMs: Date.UTC(2026, 7, 17, 10, 15), timeZone: "Europe/Ljubljana" });
  assert.equal(parsed.messageId, "gmail-1");
  assert.equal(parsed.contactEmail, "ada@example.com");
  assert.equal(parsed.companyName, "Analytical Engines");
  assert.equal(parsed.format, "new");
  assert.equal(Object.hasOwn(parsed, "body"), false);
  assert.deepEqual(Object.keys(parsed.values), parser.APPEND_HEADERS);
  assert.equal(parsed.values["Found At"], "2026-08-17 12:15");
  assert.equal(parsed.values["Name"], "Ada");
  assert.equal(parsed.values["Last Name"], "Lovelace");
  assert.equal(parsed.values["Language"], "English");
  assert.equal(parsed.values["Gmail Message ID"], "gmail-1");
  assert.match(parsed.values["Full Body"], /^New Contact Name: Ada/);
  assert.equal(parsed.values["Onboarding Complete"], "No");
});

test("parses old and legacy lead formats", function () {
  var old = parser.parseGmailLeadMessage(message(
    "gmail-2",
    "Contact Form (TLT-Webpage-en)",
    "First Name: Ada Last Name: Lovelace E-mail: ada@example.com Phone Number: 1 Address: EU Preferred Language: en Company Name: Analytical Engines Business Type: Operator Interested in: Platform Your inquiry: Hello"
  ));
  var legacy = parser.parseGmailLeadMessage(message(
    "gmail-3",
    "Form submission from: Timeless",
    "Interested in: Platform Name & Surname: Ada Lovelace E-mail: ada@example.com Phone number: 1 Address: EU Message: Hello"
  ));
  assert.equal(old.format, "old");
  assert.equal(old.companyName, "Analytical Engines");
  assert.equal(legacy.format, "legacy");
  assert.equal(legacy.contactEmail, "ada@example.com");
});

test("normalizes only the approved Interested in vocabulary", function () {
  var aliases = parser.parseGmailLeadMessage(message(
    "gmail-products-1",
    "New Contact",
    "New Contact Name: Ada Last Name: Lovelace Email: ada@example.com Phone: 1 Address: EU Business Type: Other Company Name: Analytical Engines Interested in: Games Agregator and Turnkey iGaming Package Inquiry: Hello Language: en"
  ));
  var unrelated = parser.parseGmailLeadMessage(message(
    "gmail-products-2",
    "New Contact",
    "New Contact Name: Grace Last Name: Hopper Email: grace@example.com Phone: 1 Address: EU Business Type: Other Company Name: Navy Interested in: 1x2 Gaming Inquiry: Hello Language: en"
  ));

  assert.equal(aliases.values["Interested in"], "Game Aggregator, White Label");
  assert.equal(unrelated.values["Interested in"], "");
});

test("rejects untrusted senders and cleans hidden HTML artifacts", function () {
  var untrusted = message("gmail-4", "New Contact", "New Contact Email: attacker@example.com Phone:");
  untrusted.payload.headers[0].value = "attacker@example.net";
  assert.equal(parser.parseGmailLeadMessage(untrusted), null);
  assert.equal(parser.normalizeBody("<p>A&#x200b;da &amp; Co</p>"), "A da & Co");
});

test("parses onboarding notices without retaining message content", function () {
  var parsed = parser.parseGmailOnboardingMessage(message(
    "onboarding-1",
    "Onboarding form sent",
    "ONBOARDING SENT 2 TIMES We've just received new contact form from Name: Ada Last Name: Lovelace Email: ADA@example.com Phone: 1"
  ));
  assert.equal(parsed.messageId, "onboarding-1");
  assert.equal(parsed.contactEmail, "ada@example.com");
  assert.equal(parsed.countHint, 2);
  assert.equal(parsed.threadId, "");
  assert.equal(parsed.emailDate, "");
  assert.equal(parsed.subject, "Onboarding form sent");
  assert.equal(Object.hasOwn(parsed, "body"), false);
  assert.equal(parser.parseGmailOnboardingMessage(message("other-1", "Other", "Email: a@example.com Phone: 1")), null);
});
