"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

test("Lead Studio follows the Timeless Tech browser identity standard", () => {
  const index = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const favicon = fs.readFileSync(path.join(root, "public", "favicon.svg"), "utf8");
  assert.match(index, /<title>Lead Studio \| Timeless Tech<\/title>/);
  assert.match(index, /href="\/favicon\.svg\?v=browser-identity-v1"/);
  assert.match(favicon, /fill="#3b9cff"/i);
  assert.match(favicon, /fill="#ffffff"/i);
});

test("production browser source excludes retired GAS and acceptance surfaces", () => {
  const index = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
  const config = fs.readFileSync(path.join(root, "public", "config.js"), "utf8");
  const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const functionsIndex = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");
  const source = [index, config, app, functionsIndex].join("\n");

  assert.doesNotMatch(source, /script\.google\.com\/macros/);
  assert.doesNotMatch(source, /legacy-link|legacyUrl/);
  assert.doesNotMatch(source, /leadStudioWriteAcceptanceV4|leadStudioRefreshV4/);
  assert.doesNotMatch(source, /prepareAcceptance|executeAcceptance/);
});

test("V4 source uses production-only runtime identities and bounded writer calls", () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const app = fs.readFileSync(path.join(root, "public", "app.js"), "utf8");
  const functionsIndex = fs.readFileSync(path.join(root, "functions", "index.js"), "utf8");
  const leadStudio = fs.readFileSync(path.join(root, "functions", "src", "leadStudio.js"), "utf8");

  assert.equal(packageJson.version, "4.0.0");
  assert.match(app, /clientId:\s*"lead-studio-v4"/);
  assert.doesNotMatch(app, /lead-studio-v4-test|previewDeployment/);
  assert.doesNotMatch(functionsIndex, /v4-firebase-pilot/);
  assert.match(functionsIndex, /WRITER_LOCK_TTL_MS\s*=\s*15\s*\*\s*60\s*\*\s*1000/);
  assert.match(functionsIndex, /EXTERNAL_REQUEST_TIMEOUT_MS\s*=\s*30\s*\*\s*1000/);
  assert.doesNotMatch(leadStudio, /read-only-pilot/);
});
