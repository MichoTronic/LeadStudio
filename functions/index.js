"use strict";

var initializeApp = require("firebase-admin/app").initializeApp;
var functions = require("firebase-functions/v2/https");
var logger = require("firebase-functions/logger");
var params = require("firebase-functions/params");
var jiraClient = require("./src/jiraClient");
var leadStudio = require("./src/leadStudio");
var writeAcceptance = require("./src/writeAcceptance");
var workspaceDelegation = require("./src/workspaceDelegation");

initializeApp();

var leadStudioSpreadsheetId = params.defineSecret("LEAD_STUDIO_SPREADSHEET_ID");
var leadStudioJiraApiToken = params.defineSecret("LEAD_STUDIO_JIRA_API_TOKEN");
var leadStudioGmailUser = params.defineString("LEAD_STUDIO_GMAIL_USER", {
  default: "marketing@timelesstech.io"
});
var leadStudioServiceAccountEmail = params.defineString("LEAD_STUDIO_SERVICE_ACCOUNT_EMAIL", {
  default: "819383433430-compute@developer.gserviceaccount.com"
});
var leadStudioJiraBaseUrl = params.defineString("LEAD_STUDIO_JIRA_BASE_URL", {
  default: "https://gaming-universe.atlassian.net"
});
var leadStudioJiraEmail = params.defineString("LEAD_STUDIO_JIRA_EMAIL", {
  default: "mitja@timelesstech.io"
});
var leadStudioOnboardingSpreadsheetId = params.defineString("LEAD_STUDIO_ONBOARDING_SPREADSHEET_ID", {
  default: "1Ev6nu3bp1Hjh86vB0YY-qvq9DjQh_IZzD5czBjMrtM0"
});
var leadStudioWriteAcceptanceEnabled = params.defineString("LEAD_STUDIO_WRITE_ACCEPTANCE_ENABLED", {
  default: "false"
});
var leadStudioWriteAcceptanceRow = params.defineString("LEAD_STUDIO_WRITE_ACCEPTANCE_ROW", {
  default: "2"
});
var LEAD_STUDIO_ORIGINS = [
  "https://timeless-lead-studio.web.app",
  "https://timeless-lead-studio.firebaseapp.com",
  "https://timeless-lead-studio--v4-firebase-pilot-l3jpap21.web.app"
];
var LEAD_STUDIO_WRITER_SERVICE_ACCOUNT = "lead-studio-writer@timeless-lead-studio.iam.gserviceaccount.com";

function createSheetsClient() {
  var google = require("googleapis").google;
  return google.sheets({
    version: "v4",
    auth: new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    })
  });
}

function createWriteSheetsClient() {
  var google = require("googleapis").google;
  return google.sheets({
    version: "v4",
    auth: new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    })
  });
}

async function signWorkspaceJwt(payload) {
  var google = require("googleapis").google;
  var auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"]
  });
  var iamcredentials = google.iamcredentials({ version: "v1", auth: auth });
  var response = await iamcredentials.projects.serviceAccounts.signJwt({
    name: `projects/-/serviceAccounts/${leadStudioServiceAccountEmail.value()}`,
    requestBody: { payload: JSON.stringify(payload) }
  });
  return response && response.data && response.data.signedJwt;
}

exports.leadStudioActionV4 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 4
}, async function (request) {
  try {
    return await leadStudio.runAction(request, {
      sheetsClient: createSheetsClient(),
      spreadsheetId: leadStudioSpreadsheetId.value().trim(),
      gmailProbe: function () {
        return workspaceDelegation.probeGmailMailbox({
          delegatedUser: leadStudioGmailUser.value(),
          serviceAccountEmail: leadStudioServiceAccountEmail.value(),
          signJwt: signWorkspaceJwt
        });
      },
      gmailLeadScan: function () {
        return workspaceDelegation.scanGmailLeadMessages({
          delegatedUser: leadStudioGmailUser.value(),
          serviceAccountEmail: leadStudioServiceAccountEmail.value(),
          signJwt: signWorkspaceJwt
        });
      },
      gmailDeepLeadScan: function () {
        return workspaceDelegation.scanGmailLeadMessages({
          delegatedUser: leadStudioGmailUser.value(),
          serviceAccountEmail: leadStudioServiceAccountEmail.value(),
          signJwt: signWorkspaceJwt,
          deepScan: true
        });
      },
      gmailOnboardingScan: function () {
        return workspaceDelegation.scanGmailOnboardingMessages({
          delegatedUser: leadStudioGmailUser.value(),
          serviceAccountEmail: leadStudioServiceAccountEmail.value(),
          signJwt: signWorkspaceJwt
        });
      },
      onboardingSheetProbe: async function () {
        var response = await createSheetsClient().spreadsheets.values.get({
          spreadsheetId: leadStudioOnboardingSpreadsheetId.value(),
          range: "'OnboardingRequests'!A1:Z2",
          valueRenderOption: "FORMATTED_VALUE"
        });
        var values = response && response.data && response.data.values || [];
        return {
          sheetName: "OnboardingRequests",
          sampledRows: Math.max(values.length - 1, 0),
          columns: values.length ? values[0].length : 0
        };
      },
      onboardingSheetRows: async function () {
        var response = await createSheetsClient().spreadsheets.values.get({
          spreadsheetId: leadStudioOnboardingSpreadsheetId.value(),
          range: "'OnboardingRequests'!A1:Z500",
          valueRenderOption: "FORMATTED_VALUE"
        });
        return response && response.data && response.data.values || [];
      },
      jiraProbe: function () {
        return jiraClient.probeJiraConnection({
          baseUrl: leadStudioJiraBaseUrl.value(),
          email: leadStudioJiraEmail.value(),
          apiToken: leadStudioJiraApiToken.value()
        });
      },
      jiraIssueStatuses: function (issueKeys) {
        return jiraClient.loadJiraIssueStatuses({
          baseUrl: leadStudioJiraBaseUrl.value(),
          email: leadStudioJiraEmail.value(),
          apiToken: leadStudioJiraApiToken.value(),
          issueKeys: issueKeys
        });
      },
      jiraIssueForEmail: function (email) {
        return jiraClient.findJiraIssueForContact({
          baseUrl: leadStudioJiraBaseUrl.value(),
          email: leadStudioJiraEmail.value(),
          apiToken: leadStudioJiraApiToken.value(),
          contactEmail: email
        });
      },
      jiraIssueByKey: function (issueKey) {
        return jiraClient.loadJiraIssueByKey({
          baseUrl: leadStudioJiraBaseUrl.value(),
          email: leadStudioJiraEmail.value(),
          apiToken: leadStudioJiraApiToken.value(),
          issueKey: issueKey
        });
      }
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

exports.leadStudioWriteAcceptanceV4 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId],
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT,
  timeoutSeconds: 30,
  memory: "256MiB",
  maxInstances: 1
}, async function (request) {
  try {
    if (leadStudioWriteAcceptanceEnabled.value().toLowerCase() !== "true") {
      throw new functions.HttpsError("failed-precondition", "Lead Studio write acceptance is disabled.");
    }
    var data = request && request.data || {};
    var authorization = await leadStudio.verifyAccess(data.studioAuthToken, "settings");
    var options = {
      sheetsClient: createWriteSheetsClient(),
      spreadsheetId: leadStudioSpreadsheetId.value().trim(),
      rowNumber: Number(leadStudioWriteAcceptanceRow.value()),
      actor: authorization.email,
      idempotencyKey: data.idempotencyKey,
      expectedVersion: data.expectedVersion
    };
    if (data.action === "prepareNotesRoundTrip") {
      return {
        mode: "write-acceptance",
        acceptance: await writeAcceptance.prepareNotesRoundTrip(options),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    if (data.action === "executeNotesRoundTrip") {
      var result = await writeAcceptance.executeNotesRoundTrip(options);
      logger.info("Lead Studio write acceptance completed", {
        rowNumber: result.rowNumber,
        field: result.field,
        restored: result.restored,
        replayed: result.replayed,
        idempotencyKey: result.idempotencyKey
      });
      return {
        mode: "write-acceptance",
        acceptance: result,
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    throw new functions.HttpsError("invalid-argument", "Unsupported write acceptance action.");
  } catch (error) {
    if (error instanceof functions.HttpsError) throw error;
    var safeCodes = new Set(["aborted", "data-loss", "failed-precondition", "invalid-argument"]);
    var code = safeCodes.has(error && error.code) ? error.code : "internal";
    logger.error("leadStudioWriteAcceptanceV4 failed", {
      code: code,
      name: error && error.name,
      providerStatus: Number(error && error.response && error.response.status) || 0,
      providerMessage: error && error.message
    });
    throw new functions.HttpsError(code, code === "internal" ? "Lead Studio write acceptance failed." : error.message);
  }
});
