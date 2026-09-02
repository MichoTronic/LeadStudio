"use strict";

var GoogleAuth = require("google-auth-library").GoogleAuth;
var sheets = require("@googleapis/sheets").sheets;
var iamcredentials = require("@googleapis/iamcredentials").iamcredentials;

var READONLY_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";
var WRITE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
var CLOUD_PLATFORM_SCOPE = "https://www.googleapis.com/auth/cloud-platform";

function createSheetsClient(options) {
  options = options || {};
  return sheets({
    version: "v4",
    timeout: positiveNumber(options.timeoutMs, 30000),
    retry: false,
    auth: options.auth || new GoogleAuth({
      scopes: [options.write ? WRITE_SHEETS_SCOPE : READONLY_SHEETS_SCOPE]
    })
  });
}

function createIamCredentialsClient(options) {
  options = options || {};
  return iamcredentials({
    version: "v1",
    timeout: positiveNumber(options.timeoutMs, 30000),
    retry: false,
    auth: options.auth || new GoogleAuth({ scopes: [CLOUD_PLATFORM_SCOPE] })
  });
}

function positiveNumber(value, fallback) {
  var number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

module.exports = {
  CLOUD_PLATFORM_SCOPE,
  READONLY_SHEETS_SCOPE,
  WRITE_SHEETS_SCOPE,
  createIamCredentialsClient,
  createSheetsClient
};
