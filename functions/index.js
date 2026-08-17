"use strict";

var initializeApp = require("firebase-admin/app").initializeApp;
var functions = require("firebase-functions/v2/https");
var logger = require("firebase-functions/logger");
var params = require("firebase-functions/params");
var leadStudio = require("./src/leadStudio");

initializeApp();

var leadStudioSpreadsheetId = params.defineSecret("LEAD_STUDIO_SPREADSHEET_ID");
var LEAD_STUDIO_ORIGINS = [
  "https://timeless-lead-studio.web.app",
  "https://timeless-lead-studio.firebaseapp.com",
  "https://timeless-lead-studio--v4-firebase-pilot-l3jpap21.web.app"
];

function createSheetsClient() {
  var google = require("googleapis").google;
  return google.sheets({
    version: "v4",
    auth: new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    })
  });
}

exports.leadStudioActionV4 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 4
}, async function (request) {
  try {
    return await leadStudio.runAction(request, {
      sheetsClient: createSheetsClient(),
      spreadsheetId: leadStudioSpreadsheetId.value().trim()
    });
  } catch (error) {
    if (error instanceof functions.HttpsError) throw error;
    logger.error("leadStudioActionV4 failed", {
      name: error && error.name,
      message: error && error.message
    });
    throw new functions.HttpsError("internal", "Lead Studio could not load its data.");
  }
});
