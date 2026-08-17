"use strict";

var initializeApp = require("firebase-admin/app").initializeApp;
var functions = require("firebase-functions/v2/https");
var logger = require("firebase-functions/logger");
var params = require("firebase-functions/params");
var jiraClient = require("./src/jiraClient");
var leadStudio = require("./src/leadStudio");
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
