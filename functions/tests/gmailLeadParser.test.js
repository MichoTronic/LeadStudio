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

test("parses current New Contact messages without retaining the body", function () {
  var parsed = parser.parseGmailLeadMessage(message(
    "gmail-1",
    "New Contact",
    "New Contact Name: Ada Last Name: Lovelace Email: ada@example.com Phone: 1 Address: EU Business Type: Operator Company Name: Analytical Engines Interested in: Platform Inquiry: Hello Language: en"
  ));
  assert.deepEqual(parsed, {
    messageId: "gmail-1",
    contactEmail: "ada@example.com",
    companyName: "Analytical Engines",
    format: "new"
  });
  assert.equal(Object.hasOwn(parsed, "body"), false);
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

test("rejects untrusted senders and cleans hidden HTML artifacts", function () {
  var untrusted = message("gmail-4", "New Contact", "New Contact Email: attacker@example.com Phone:");
  untrusted.payload.headers[0].value = "attacker@example.net";
  assert.equal(parser.parseGmailLeadMessage(untrusted), null);
  assert.equal(parser.normalizeBody("<p>A&#x200b;da &amp; Co</p>"), "A da & Co");
});
