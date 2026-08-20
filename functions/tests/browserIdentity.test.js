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
