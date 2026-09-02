"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { Storage } = require("@google-cloud/storage");
const googleClients = require("../src/googleClients");

const functionsRoot = path.resolve(__dirname, "..");

test("uses current service-specific Google clients instead of the umbrella package", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(functionsRoot, "package.json"), "utf8"));

  assert.equal(packageJson.dependencies["@google-cloud/storage"], "^8.0.1");
  assert.equal(packageJson.dependencies["@googleapis/sheets"], "^14.0.0");
  assert.equal(packageJson.dependencies["@googleapis/iamcredentials"], "^11.0.0");
  assert.equal(packageJson.dependencies["google-auth-library"], "^10.9.1");
  assert.equal(packageJson.dependencies.googleapis, undefined);
});

test("constructs bounded Sheets clients with the least required scope", () => {
  const reader = googleClients.createSheetsClient({ timeoutMs: 12345 });
  const writer = googleClients.createSheetsClient({ write: true, timeoutMs: 23456 });

  assert.equal(typeof reader.spreadsheets.values.get, "function");
  assert.equal(typeof writer.spreadsheets.values.append, "function");
  assert.equal(reader.context._options.timeout, 12345);
  assert.equal(writer.context._options.timeout, 23456);
  assert.equal(reader.context._options.retry, false);
  assert.equal(writer.context._options.retry, false);
  assert.deepEqual(reader.context._options.auth.scopes, [googleClients.READONLY_SHEETS_SCOPE]);
  assert.deepEqual(writer.context._options.auth.scopes, [googleClients.WRITE_SHEETS_SCOPE]);
});

test("constructs the IAM Credentials signJwt client with bounded requests", () => {
  const client = googleClients.createIamCredentialsClient({ timeoutMs: 15000 });

  assert.equal(typeof client.projects.serviceAccounts.signJwt, "function");
  assert.equal(client.context._options.timeout, 15000);
  assert.equal(client.context._options.retry, false);
  assert.deepEqual(client.context._options.auth.scopes, [googleClients.CLOUD_PLATFORM_SCOPE]);
});

test("keeps the Storage 8 object methods used by watch state and writer locking", () => {
  const storage = new Storage({ projectId: "compatibility-test" });
  const file = storage.bucket("compatibility-test-bucket").file("state.json");
  const generatedFile = storage.bucket("compatibility-test-bucket").file("lock.json", { generation: "123" });

  assert.equal(typeof file.download, "function");
  assert.equal(typeof file.save, "function");
  assert.equal(typeof file.getMetadata, "function");
  assert.equal(typeof generatedFile.delete, "function");
  assert.equal(generatedFile.generation, 123);
});
