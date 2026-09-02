"use strict";

var googleClients = require("../functions/src/googleClients");
var gmailWatchState = require("../functions/src/gmailWatchState");
var writerLock = require("../functions/src/writerLock");
var Storage = require("../functions/node_modules/@google-cloud/storage").Storage;

var spreadsheetId = required("LEAD_STUDIO_COMPATIBILITY_SPREADSHEET_ID");
var serviceAccountEmail = required("LEAD_STUDIO_COMPATIBILITY_SERVICE_ACCOUNT_EMAIL");
var bucketName = required("LEAD_STUDIO_COMPATIBILITY_BUCKET");
var allowIsolatedWrite = process.env.LEAD_STUDIO_COMPATIBILITY_WRITE === "true";

async function run() {
  var results = {};

  await probe(results, "sheetsRead", async function () {
    var sheetsClient = googleClients.createSheetsClient({ timeoutMs: 30000 });
    var response = await sheetsClient.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: "OnboardingRequests!A1:A2",
      valueRenderOption: "FORMATTED_VALUE"
    });
    return { rows: (response.data.values || []).length };
  });

  await probe(results, "iamSignJwt", async function () {
    var iamClient = googleClients.createIamCredentialsClient({ timeoutMs: 30000 });
    var response = await iamClient.projects.serviceAccounts.signJwt({
      name: `projects/-/serviceAccounts/${serviceAccountEmail}`,
      requestBody: {
        payload: JSON.stringify({
          purpose: "lead-studio-google-client-compatibility",
          issuedAt: Math.floor(Date.now() / 1000)
        })
      }
    });
    return { signatureReturned: Boolean(response.data && response.data.signedJwt) };
  });

  var storage = new Storage();
  await probe(results, "storageWatchStateRead", async function () {
    var state = await gmailWatchState.readWatchState({ bucketName: bucketName, storage: storage });
    return {
      watchStatePresent: Boolean(state),
      historyCursorPresent: Boolean(state && state.processedHistoryId)
    };
  });

  if (allowIsolatedWrite) {
    await probe(results, "storageIsolatedLockRoundTrip", async function () {
      var lockName = `compatibility/v5-google-clients-${Date.now()}.lock`;
      var lock;
      try {
        lock = await writerLock.acquireWriterLock({
          bucketName: bucketName,
          storage: storage,
          lockName: lockName,
          owner: "v5-google-client-compatibility",
          ttlMs: 60000,
          waitMs: 1000
        });
      } finally {
        if (lock) await lock.release();
      }
      return {
        generationReturned: Boolean(lock && lock.generation),
        removed: !(await storage.bucket(bucketName).file(lockName).exists())[0]
      };
    });
  } else {
    results.storageIsolatedLockRoundTrip = { skipped: true };
  }

  console.log(JSON.stringify(results, null, 2));
  if (Object.values(results).some(function (result) { return result.passed === false; })) {
    process.exitCode = 1;
  }
}

async function probe(results, name, callback) {
  try {
    results[name] = Object.assign({ passed: true }, await callback());
  } catch (error) {
    results[name] = { passed: false, code: String(error && error.code || "unknown") };
  }
}

function required(name) {
  var value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

run().catch(function (error) {
  console.error(`Google client smoke failed: ${error.code || "unknown"}`);
  process.exitCode = 1;
});
