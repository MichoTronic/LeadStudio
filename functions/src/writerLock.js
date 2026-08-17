"use strict";

var crypto = require("node:crypto");
var Storage = require("@google-cloud/storage").Storage;

var DEFAULT_LOCK_NAME = "lead-studio-writer.lock";

async function withWriterLock(options, callback) {
  if (typeof callback !== "function") throw codedError("invalid-argument", "A writer operation is required.");
  var lock = await acquireWriterLock(options);
  try {
    return await callback();
  } finally {
    await lock.release().catch(function () {});
  }
}

async function acquireWriterLock(options) {
  options = options || {};
  var bucketName = normalize(options.bucketName);
  if (!bucketName) throw codedError("failed-precondition", "The Lead Studio writer lock bucket is not configured.");
  var storage = options.storage || new Storage();
  var lockName = normalize(options.lockName) || DEFAULT_LOCK_NAME;
  var owner = normalize(options.owner) || "lead-studio-writer";
  var ttlMs = positiveNumber(options.ttlMs, 5 * 60 * 1000);
  var waitMs = positiveNumber(options.waitMs, 5000);
  var retryMs = positiveNumber(options.retryMs, 250);
  var now = typeof options.now === "function" ? options.now : Date.now;
  var sleep = typeof options.sleep === "function" ? options.sleep : function (delay) {
    return new Promise(function (resolve) { setTimeout(resolve, delay); });
  };
  var deadline = now() + waitMs;
  var bucket = storage.bucket(bucketName);

  while (true) {
    var acquired = await tryAcquire({ bucket: bucket, lockName: lockName, owner: owner, ttlMs: ttlMs, now: now });
    if (acquired) return acquired;
    if (now() >= deadline) throw codedError("aborted", "Another Lead Studio writer is already running.");
    await sleep(retryMs);
  }
}

async function tryAcquire(options) {
  var file = options.bucket.file(options.lockName);
  var expiresAt = options.now() + options.ttlMs;
  try {
    await file.save(JSON.stringify({
      owner: options.owner,
      nonce: crypto.randomUUID(),
      expiresAt: expiresAt
    }), {
      resumable: false,
      validation: false,
      contentType: "application/json",
      metadata: { cacheControl: "no-store", metadata: { expiresAt: String(expiresAt) } },
      preconditionOpts: { ifGenerationMatch: 0 }
    });
    var metadata = (await file.getMetadata())[0] || {};
    var generation = normalize(metadata.generation);
    if (!generation) throw codedError("data-loss", "The Lead Studio writer lock generation is missing.");
    return {
      generation: generation,
      release: function () {
        return options.bucket.file(options.lockName, { generation: generation }).delete({ ignoreNotFound: true });
      }
    };
  } catch (error) {
    if (!isPreconditionFailure(error)) throw error;
    var existing;
    try {
      existing = (await file.getMetadata())[0] || {};
    } catch (metadataError) {
      if (Number(metadataError && (metadataError.code || metadataError.statusCode)) === 404) return null;
      throw metadataError;
    }
    var existingExpiry = Number(existing.metadata && existing.metadata.expiresAt) || 0;
    var existingGeneration = normalize(existing.generation);
    if (existingExpiry > options.now() || !existingGeneration) return null;
    try {
      await options.bucket.file(options.lockName, { generation: existingGeneration }).delete({ ignoreNotFound: true });
    } catch (deleteError) {
      if (!isPreconditionFailure(deleteError) && Number(deleteError && (deleteError.code || deleteError.statusCode)) !== 404) {
        throw deleteError;
      }
    }
    return null;
  }
}

function isPreconditionFailure(error) {
  var code = Number(error && (error.code || error.statusCode));
  return code === 409 || code === 412;
}

function positiveNumber(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function codedError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  DEFAULT_LOCK_NAME,
  acquireWriterLock,
  withWriterLock
};
