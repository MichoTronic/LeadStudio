"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var mapWithConcurrency = require("../src/asyncUtils").mapWithConcurrency;

test("maps work with bounded concurrency while preserving result order", async function () {
  var active = 0;
  var maxActive = 0;
  var values = Array.from({ length: 12 }, function (_, index) { return index + 1; });
  var results = await mapWithConcurrency(values, 4, async function (value) {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(function (resolve) { setTimeout(resolve, (13 - value) % 4); });
    active -= 1;
    return value * 2;
  });

  assert.deepEqual(results, values.map(function (value) { return value * 2; }));
  assert.equal(maxActive, 4);
});

test("normalizes empty and invalid concurrency inputs", async function () {
  assert.deepEqual(await mapWithConcurrency(null, 0, async function () {}), []);
  assert.deepEqual(await mapWithConcurrency([1, 2], "invalid", async function (value) { return value; }), [1, 2]);
});
