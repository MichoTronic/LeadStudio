"use strict";

var initializeApp = require("firebase-admin/app").initializeApp;
var functions = require("firebase-functions/v2/https");
var logger = require("firebase-functions/logger");
var params = require("firebase-functions/params");
var jiraClient = require("./src/jiraClient");
var leadStudio = require("./src/leadStudio");
var manualJiraLink = require("./src/manualJiraLink");
var onboardingSheet = require("./src/onboardingSheet");
var refreshMutation = require("./src/refreshMutation");
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
var leadStudioManualJiraEnabled = params.defineString("LEAD_STUDIO_MANUAL_JIRA_ENABLED", {
  default: "false"
});
var leadStudioManualJiraAcceptanceRow = params.defineString("LEAD_STUDIO_MANUAL_JIRA_ACCEPTANCE_ROW", {
  default: "2"
});
var leadStudioRefreshEnabled = params.defineString("LEAD_STUDIO_REFRESH_ENABLED", {
  default: "false"
});
var leadStudioRefreshAcceptanceEnabled = params.defineString("LEAD_STUDIO_REFRESH_ACCEPTANCE_ENABLED", {
  default: "false"
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

async function loadOnboardingRows() {
  var response = await createSheetsClient().spreadsheets.values.get({
    spreadsheetId: leadStudioOnboardingSpreadsheetId.value(),
    range: "'OnboardingRequests'!A1:Z500",
    valueRenderOption: "FORMATTED_VALUE"
  });
  return response && response.data && response.data.values || [];
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
      gmailOperationalLeadScan: function () {
        return workspaceDelegation.scanGmailLeadMessages({
          delegatedUser: leadStudioGmailUser.value(),
          serviceAccountEmail: leadStudioServiceAccountEmail.value(),
          signJwt: signWorkspaceJwt,
          operational: true,
          timeZone: "Europe/Ljubljana"
        });
      },
      gmailOperationalOnboardingScan: function () {
        return workspaceDelegation.scanGmailOnboardingMessages({
          delegatedUser: leadStudioGmailUser.value(),
          serviceAccountEmail: leadStudioServiceAccountEmail.value(),
          signJwt: signWorkspaceJwt,
          operational: true,
          timeZone: "Europe/Ljubljana"
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
      },
      refreshPlan: async function () {
        var prepared = await buildLiveRefreshPlan(createSheetsClient());
        return refreshMutation.publicPlan(prepared.plan);
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

async function buildLiveRefreshPlan(sheetsClient) {
  sheetsClient = sheetsClient || createWriteSheetsClient();
  var spreadsheetId = leadStudioSpreadsheetId.value().trim();
  var workspaceOptions = {
    delegatedUser: leadStudioGmailUser.value(),
    serviceAccountEmail: leadStudioServiceAccountEmail.value(),
    signJwt: signWorkspaceJwt,
    operational: true,
    timeZone: "Europe/Ljubljana"
  };
  var initial = await Promise.all([
    refreshMutation.readSnapshot({ sheetsClient: sheetsClient, spreadsheetId: spreadsheetId }),
    workspaceDelegation.scanGmailLeadMessages(workspaceOptions),
    workspaceDelegation.scanGmailOnboardingMessages(workspaceOptions),
    loadOnboardingRows()
  ]);
  var snapshot = initial[0];
  var gmailLeadScan = initial[1];
  var gmailOnboardingScan = initial[2];
  var onboardingLookup = onboardingSheet.buildOnboardingLookup(initial[3]);
  var issueKeys = refreshMutation.collectIssueKeys(snapshot, onboardingLookup);
  var newLeadEmails = refreshMutation.collectNewLeadContacts(snapshot, gmailLeadScan);
  var jiraConfig = {
    baseUrl: leadStudioJiraBaseUrl.value(),
    email: leadStudioJiraEmail.value(),
    apiToken: leadStudioJiraApiToken.value()
  };
  var jiraResults = await Promise.all([
    jiraClient.loadJiraIssueStatuses(Object.assign({}, jiraConfig, { issueKeys: issueKeys })),
    Promise.all(newLeadEmails.map(function (contactEmail) {
      return jiraClient.findJiraIssueForContact(Object.assign({}, jiraConfig, { contactEmail: contactEmail }))
        .then(function (issue) { return [contactEmail, issue]; });
    }))
  ]);
  var plan = refreshMutation.buildRefreshPlan({
    snapshot: snapshot,
    gmailLeadScan: gmailLeadScan,
    gmailOnboardingScan: gmailOnboardingScan,
    onboardingLookup: onboardingLookup,
    liveStatuses: jiraResults[0],
    jiraByEmail: Object.fromEntries(jiraResults[1]),
    timeZone: "Europe/Ljubljana"
  });
  plan.summary.inputs = {
    gmailLeadCandidates: gmailLeadScan.candidateMessages,
    gmailLeadAccepted: gmailLeadScan.acceptedMessages.length,
    gmailLeadComplete: gmailLeadScan.complete === true,
    gmailOnboardingCandidates: gmailOnboardingScan.candidateMessages,
    gmailOnboardingAccepted: gmailOnboardingScan.acceptedMessages.length,
    gmailOnboardingComplete: gmailOnboardingScan.complete === true,
    onboardingEligibleRows: Number(onboardingLookup.eligibleRows) || 0,
    jiraRequestedKeys: issueKeys.length,
    jiraLiveStatuses: Object.keys(jiraResults[0]).length,
    newLeadJiraLookups: newLeadEmails.length
  };
  return {
    sheetsClient: sheetsClient,
    spreadsheetId: spreadsheetId,
    plan: plan
  };
}

exports.leadStudioRefreshV4 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  timeoutSeconds: 180,
  memory: "512MiB",
  maxInstances: 1,
  concurrency: 1,
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT
}, async function (request) {
  var data = request && request.data || {};
  var actionName = String(data.action || "").trim();
  try {
    var authorization = await leadStudio.verifyAccess(data.studioAuthToken, "settings");
    var acceptance = actionName === "executeAcceptance";
    var prepare = actionName === "prepare" || actionName === "prepareAcceptance";
    if (!prepare && !acceptance && actionName !== "execute") {
      throw new functions.HttpsError("invalid-argument", "Unsupported refresh action.");
    }
    if (acceptance && leadStudioRefreshAcceptanceEnabled.value() !== "true") {
      throw new functions.HttpsError("failed-precondition", "Lead Studio refresh acceptance is disabled.");
    }
    if (actionName === "execute" && leadStudioRefreshEnabled.value() !== "true") {
      throw new functions.HttpsError("failed-precondition", "Lead Studio operational refresh is disabled.");
    }
    var prepared = await buildLiveRefreshPlan();
    if (prepare) {
      return {
        mode: "refresh-disabled",
        refresh: refreshMutation.publicPlan(prepared.plan),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    var result = await refreshMutation.executeRefreshPlan({
      plan: prepared.plan,
      sheetsClient: prepared.sheetsClient,
      spreadsheetId: prepared.spreadsheetId,
      actor: authorization.email,
      idempotencyKey: data.idempotencyKey,
      expectedVersion: data.expectedVersion,
      restoreAfterVerify: acceptance
    });
    logger.info("Lead Studio Firebase refresh completed", {
      actor: authorization.email,
      acceptance: acceptance,
      restored: result.restored,
      changedRows: result.changedRows,
      appendedRows: result.appendedRows
    });
    return {
      mode: acceptance ? "refresh-acceptance" : "refresh-operational",
      refresh: result,
      authorization: leadStudio.publicAuthorization(authorization)
    };
  } catch (error) {
    if (error instanceof functions.HttpsError) throw error;
    var code = ["invalid-argument", "failed-precondition", "aborted", "data-loss"].includes(error && error.code)
      ? error.code : "internal";
    logger.error("leadStudioRefreshV4 failed", { name: error && error.name, code: code, message: error && error.message });
    throw new functions.HttpsError(code, code === "internal" ? "Lead Studio refresh failed." : error.message);
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

exports.leadStudioManualJiraV4 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT,
  timeoutSeconds: 30,
  memory: "256MiB",
  maxInstances: 1
}, async function (request) {
  try {
    if (leadStudioManualJiraEnabled.value().toLowerCase() !== "true") {
      throw new functions.HttpsError("failed-precondition", "Lead Studio manual Jira writes are disabled.");
    }
    var data = request && request.data || {};
    var actionName = String(data.action || "").trim();
    var acceptanceAction = actionName === "prepareAcceptance" || actionName === "executeAcceptance";
    var authorization = await leadStudio.verifyAccess(data.studioAuthToken, acceptanceAction ? "settings" : "write");
    var rowNumber = acceptanceAction ? Number(leadStudioManualJiraAcceptanceRow.value()) : Number(data.rowNumber);
    var options = {
      sheetsClient: createWriteSheetsClient(),
      spreadsheetId: leadStudioSpreadsheetId.value().trim(),
      rowNumber: rowNumber,
      actor: authorization.email,
      idempotencyKey: data.idempotencyKey,
      expectedVersion: data.expectedVersion,
      issueKey: data.issueKey,
      jiraBaseUrl: leadStudioJiraBaseUrl.value(),
      jiraIssueByKey: function (issueKey) {
        return jiraClient.loadJiraIssueByKey({
          baseUrl: leadStudioJiraBaseUrl.value(),
          email: leadStudioJiraEmail.value(),
          apiToken: leadStudioJiraApiToken.value(),
          issueKey: issueKey
        });
      }
    };
    if (actionName === "prepareManualJiraLink") {
      return {
        mode: "manual-jira-disabled-pilot",
        manualJira: await manualJiraLink.prepareManualJiraLink(options),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    if (actionName === "saveManualJiraLink") {
      return {
        mode: "manual-jira-disabled-pilot",
        manualJira: await manualJiraLink.executeManualJiraLink(options),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    if (actionName === "prepareAcceptance") {
      return {
        mode: "manual-jira-acceptance",
        manualJira: await manualJiraLink.prepareManualJiraLink(options),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    if (actionName === "executeAcceptance") {
      var prepared = await manualJiraLink.prepareManualJiraLink(options);
      options.issueKey = prepared.issueKey;
      options.restoreAfterVerify = true;
      var result = await manualJiraLink.executeManualJiraLink(options);
      logger.info("Lead Studio manual Jira acceptance completed", {
        rowNumber: result.rowNumber,
        restored: result.restored,
        replayed: result.replayed,
        idempotencyKey: result.idempotencyKey
      });
      return {
        mode: "manual-jira-acceptance",
        manualJira: result,
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    throw new functions.HttpsError("invalid-argument", "Unsupported manual Jira action.");
  } catch (error) {
    if (error instanceof functions.HttpsError) throw error;
    var safeCodes = new Set(["aborted", "data-loss", "failed-precondition", "invalid-argument"]);
    var code = safeCodes.has(error && error.code) ? error.code : "internal";
    logger.error("leadStudioManualJiraV4 failed", {
      code: code,
      name: error && error.name,
      providerStatus: Number(error && error.response && error.response.status) || 0
    });
    throw new functions.HttpsError(code, code === "internal" ? "Lead Studio manual Jira update failed." : error.message);
  }
});
