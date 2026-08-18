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
