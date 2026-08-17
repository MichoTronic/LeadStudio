"use strict";

var assert = require("node:assert/strict");
var test = require("node:test");
var writerLock = require("../src/writerLock");

function fakeStorage(initial) {
  var state = initial || null;
  var generation = state ? Number(state.generation) : 0;
  function file(_name, options) {
    return {
      save: async function (_body, request) {
        if (request.preconditionOpts.ifGenerationMatch === 0 && state) {
          var conflict = new Error("exists"); conflict.code = 412; throw conflict;
        }
        generation += 1;
        state = { generation: String(generation), metadata: request.metadata.metadata };
      },
      getMetadata: async function () {
        if (!state) { var missing = new Error("missing"); missing.code = 404; throw missing; }
        return [Object.assign({}, state, { metadata: Object.assign({}, state.metadata) })];
      },
      delete: async function () {
        if (!state) return;
        if (options && String(options.generation) !== String(state.generation)) {
          var stale = new Error("stale generation"); stale.code = 412; throw stale;
        }
        state = null;
      }
    };
  }
  return {
    bucket: function () { return { file: file }; },
    state: function () { return state; }
  };
}

test("serializes a writer operation and releases its exact lock generation", async function () {
  var storage = fakeStorage();
  var result = await writerLock.withWriterLock({
    bucketName: "locks",
    storage: storage,
    now: function () { return 1000; }
  }, async function () {
    assert.ok(storage.state());
    return "complete";
  });
  assert.equal(result, "complete");
  assert.equal(storage.state(), null);
});

test("rejects a busy writer after the bounded wait", async function () {
  var clock = 1000;
  var storage = fakeStorage({ generation: "4", metadata: { expiresAt: "9000" } });
  await assert.rejects(writerLock.acquireWriterLock({
    bucketName: "locks",
    storage: storage,
    now: function () { return clock; },
    waitMs: 20,
    retryMs: 10,
    sleep: async function (delay) { clock += delay; }
  }), /already running/);
});

test("removes an expired generation and acquires a fresh lock", async function () {
  var storage = fakeStorage({ generation: "7", metadata: { expiresAt: "999" } });
  var lock = await writerLock.acquireWriterLock({
    bucketName: "locks",
    storage: storage,
    now: function () { return 1000; },
    sleep: async function () {}
  });
  assert.equal(lock.generation, "8");
  await lock.release();
  assert.equal(storage.state(), null);
});
