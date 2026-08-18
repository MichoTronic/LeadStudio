"use strict";

var Storage = require("@google-cloud/storage").Storage;

var DEFAULT_STATE_NAME = "gmail/watch-state.json";

async function readWatchState(options) {
  options = options || {};
  var file = stateFile(options);
  try {
    var contents = (await file.download())[0];
    var state = JSON.parse(contents.toString("utf8"));
    return normalizeState(state);
  } catch (error) {
    if (Number(error && (error.code || error.statusCode)) === 404) return null;
    throw error;
  }
}

async function writeWatchState(options, state) {
  options = options || {};
  var normalized = normalizeState(state);
  if (!normalized.emailAddress || !normalized.processedHistoryId) {
    throw new Error("Gmail watch state requires a mailbox and processed history cursor.");
  }
  await stateFile(options).save(JSON.stringify(normalized), {
    resumable: false,
    validation: false,
    contentType: "application/json",
    metadata: { cacheControl: "no-store" }
  });
  return normalized;
}

function stateFile(options) {
  var bucketName = normalize(options.bucketName);
  if (!bucketName) throw new Error("The Gmail watch state bucket is not configured.");
  var storage = options.storage || new Storage();
  return storage.bucket(bucketName).file(normalize(options.stateName) || DEFAULT_STATE_NAME);
}

function normalizeState(state) {
  state = state || {};
  return {
    emailAddress: normalize(state.emailAddress).toLowerCase(),
    processedHistoryId: normalize(state.processedHistoryId),
    watchHistoryId: normalize(state.watchHistoryId),
    watchExpiration: normalize(state.watchExpiration),
    renewedAt: normalize(state.renewedAt),
    lastPushAt: normalize(state.lastPushAt),
    lastSuccessAt: normalize(state.lastSuccessAt),
    lastFailureAt: normalize(state.lastFailureAt),
    lastFailureCode: normalize(state.lastFailureCode),
    lastCandidateMessages: nonNegativeNumber(state.lastCandidateMessages),
    lastAcceptedLeads: nonNegativeNumber(state.lastAcceptedLeads),
    lastAcceptedOnboarding: nonNegativeNumber(state.lastAcceptedOnboarding)
  };
}

function nonNegativeNumber(value) {
  var number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalize(value) {
  return String(value == null ? "" : value).trim();
}

module.exports = {
  DEFAULT_STATE_NAME,
  normalizeState,
  readWatchState,
  writeWatchState
};
