"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var watchState = require("../src/gmailWatchState");

function fakeStorage(initial) {
  var content = initial == null ? null : Buffer.from(JSON.stringify(initial));
  return {
    bucket: function () {
      return { file: function () {
        return {
          download: async function () {
            if (!content) { var error = new Error("missing"); error.code = 404; throw error; }
            return [content];
          },
          save: async function (next) { content = Buffer.from(next); }
        };
      } };
    },
    current: function () { return content && JSON.parse(content.toString("utf8")); }
  };
}

test("returns null for missing Gmail watch state", async function () {
  assert.equal(await watchState.readWatchState({ storage: fakeStorage(), bucketName: "bucket" }), null);
});

test("writes normalized Gmail watch state without provider tokens", async function () {
  var storage = fakeStorage();
  var result = await watchState.writeWatchState({ storage: storage, bucketName: "bucket" }, {
    emailAddress: "Marketing@TimelessTech.io",
    processedHistoryId: " 123 ",
    watchHistoryId: "124",
    watchExpiration: "1787100000000",
    renewedAt: "2026-08-18T10:00:00.000Z",
    accessToken: "must-not-persist"
  });
  assert.equal(result.emailAddress, "marketing@timelesstech.io");
  assert.equal(storage.current().processedHistoryId, "123");
  assert.equal(storage.current().accessToken, undefined);
});
