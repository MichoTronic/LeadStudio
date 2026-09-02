"use strict";

var initializeApp = require("firebase-admin/app").initializeApp;
var functions = require("firebase-functions/v2/https");
var scheduler = require("firebase-functions/v2/scheduler");
var pubsub = require("firebase-functions/v2/pubsub");
var logger = require("firebase-functions/logger");
var params = require("firebase-functions/params");
var gmailIncrementalMutation = require("./src/gmailIncrementalMutation");
var jiraClient = require("./src/jiraClient");
var gmailContactActivity = require("./src/gmailContactActivity");
var gmailWatchState = require("./src/gmailWatchState");
var googleClients = require("./src/googleClients");
var leadStudio = require("./src/leadStudio");
var manualJiraLink = require("./src/manualJiraLink");
var onboardingSheet = require("./src/onboardingSheet");
var operationsStatus = require("./src/operationsStatus");
var refreshMutation = require("./src/refreshMutation");
var writerLock = require("./src/writerLock");
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
var leadStudioJiraBrowserBaseUrl = params.defineString("LEAD_STUDIO_JIRA_BROWSER_BASE_URL", {
  default: "https://jira.at.semper7.net"
});
var leadStudioJiraEmail = params.defineString("LEAD_STUDIO_JIRA_EMAIL", {
  default: "mitja@timelesstech.io"
});
var leadStudioOnboardingSpreadsheetId = params.defineString("LEAD_STUDIO_ONBOARDING_SPREADSHEET_ID", {
  default: "1Ev6nu3bp1Hjh86vB0YY-qvq9DjQh_IZzD5czBjMrtM0"
});
var leadStudioManualJiraEnabled = params.defineString("LEAD_STUDIO_MANUAL_JIRA_ENABLED", {
  default: "false"
});
var leadStudioScheduledRefreshEnabled = params.defineString("LEAD_STUDIO_SCHEDULED_REFRESH_ENABLED", {
  default: "false"
});
var leadStudioWriterLockBucket = params.defineString("LEAD_STUDIO_WRITER_LOCK_BUCKET", {
  default: "timeless-lead-studio-writer-locks"
});
var leadStudioGmailTopicName = params.defineString("LEAD_STUDIO_GMAIL_TOPIC_NAME", {
  default: "projects/timeless-lead-studio/topics/lead-studio-gmail-changes"
});
var leadStudioGmailWatchEnabled = params.defineString("LEAD_STUDIO_GMAIL_WATCH_ENABLED", {
  default: "false"
});
var leadStudioGmailPushEnabled = params.defineString("LEAD_STUDIO_GMAIL_PUSH_ENABLED", {
  default: "false"
});
var leadStudioGmailReconciliationDays = params.defineString("LEAD_STUDIO_GMAIL_RECONCILIATION_DAYS", {
  default: "14"
});
var leadStudioGmailNarrowReconciliationEnabled = params.defineString("LEAD_STUDIO_GMAIL_NARROW_RECONCILIATION_ENABLED", {
  default: "false"
});
var LEAD_STUDIO_ORIGINS = [
  "https://timeless-lead-studio.web.app",
  "https://timeless-lead-studio.firebaseapp.com"
];
var LEAD_STUDIO_WRITER_SERVICE_ACCOUNT = "lead-studio-writer@timeless-lead-studio.iam.gserviceaccount.com";
var EXTERNAL_REQUEST_TIMEOUT_MS = 30 * 1000;
var WRITER_LOCK_TTL_MS = 15 * 60 * 1000;
var sheetsReadClient;
var sheetsWriteClient;
var iamCredentialsClient;

function createSheetsClient() {
  if (!sheetsReadClient) {
    sheetsReadClient = googleClients.createSheetsClient({ timeoutMs: EXTERNAL_REQUEST_TIMEOUT_MS });
  }
  return sheetsReadClient;
}

function createWriteSheetsClient() {
  if (!sheetsWriteClient) {
    sheetsWriteClient = googleClients.createSheetsClient({ write: true, timeoutMs: EXTERNAL_REQUEST_TIMEOUT_MS });
  }
  return sheetsWriteClient;
}

function withLeadStudioWriterLock(owner, callback) {
  return writerLock.withWriterLock({
    bucketName: leadStudioWriterLockBucket.value(),
    owner: owner,
    ttlMs: WRITER_LOCK_TTL_MS,
    waitMs: 5000
  }, callback);
}

function gmailWorkspaceOptions(overrides) {
  return Object.assign({
    delegatedUser: leadStudioGmailUser.value(),
    serviceAccountEmail: leadStudioServiceAccountEmail.value(),
    signJwt: signWorkspaceJwt,
    timeZone: "Europe/Ljubljana",
    requestTimeoutMs: EXTERNAL_REQUEST_TIMEOUT_MS
  }, overrides || {});
}

function watchStateOptions() {
  return { bucketName: leadStudioWriterLockBucket.value() };
}

async function loadOnboardingRows() {
  var response = await createSheetsClient().spreadsheets.values.get({
    spreadsheetId: leadStudioOnboardingSpreadsheetId.value(),
    range: "'OnboardingRequests'!A1:Z500",
    valueRenderOption: "FORMATTED_VALUE",
    fields: "values"
  });
  return response && response.data && response.data.values || [];
}

async function signWorkspaceJwt(payload) {
  if (!iamCredentialsClient) {
    iamCredentialsClient = googleClients.createIamCredentialsClient({ timeoutMs: EXTERNAL_REQUEST_TIMEOUT_MS });
  }
  var response = await iamCredentialsClient.projects.serviceAccounts.signJwt({
    name: `projects/-/serviceAccounts/${leadStudioServiceAccountEmail.value()}`,
    requestBody: { payload: JSON.stringify(payload) }
  });
  return response && response.data && response.data.signedJwt;
}

exports.leadStudioActionV5 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 4,
  concurrency: 10
}, async function (request) {
  try {
    return await leadStudio.runAction(request, {
      sheetsClient: createSheetsClient(),
      spreadsheetId: leadStudioSpreadsheetId.value().trim(),
      gmailProbe: function () {
        return workspaceDelegation.probeGmailMailbox(gmailWorkspaceOptions());
      },
      gmailLeadScan: function () {
        return workspaceDelegation.scanGmailLeadMessages(gmailWorkspaceOptions());
      },
      gmailDeepLeadScan: function () {
        return workspaceDelegation.scanGmailLeadMessages(gmailWorkspaceOptions({
          deepScan: true
        }));
      },
      gmailOnboardingScan: function () {
        return workspaceDelegation.scanGmailOnboardingMessages(gmailWorkspaceOptions());
      },
      gmailOperationalLeadScan: function () {
        return workspaceDelegation.scanGmailLeadMessages(gmailWorkspaceOptions({ operational: true }));
      },
      gmailOperationalOnboardingScan: function () {
        return workspaceDelegation.scanGmailOnboardingMessages(gmailWorkspaceOptions({ operational: true }));
      },
      gmailContactActivity: function (lead) {
        return gmailContactActivity.loadContactActivity(gmailWorkspaceOptions({
          lead: lead
        }));
      },
      onboardingSheetProbe: async function () {
        var response = await createSheetsClient().spreadsheets.values.get({
          spreadsheetId: leadStudioOnboardingSpreadsheetId.value(),
          range: "'OnboardingRequests'!A1:Z2",
          valueRenderOption: "FORMATTED_VALUE",
          fields: "values"
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
          valueRenderOption: "FORMATTED_VALUE",
          fields: "values"
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
      },
      operationsStatus: async function () {
        return operationsStatus.loadOperationsStatus({
          sheetsClient: createSheetsClient(),
          spreadsheetId: leadStudioSpreadsheetId.value().trim(),
          watchState: await gmailWatchState.readWatchState(watchStateOptions()),
          runtime: {
            scheduledRefreshEnabled: leadStudioScheduledRefreshEnabled.value() === "true",
            gmailWatchEnabled: leadStudioGmailWatchEnabled.value() === "true",
            gmailPushEnabled: leadStudioGmailPushEnabled.value() === "true",
            narrowReconciliationEnabled: leadStudioGmailNarrowReconciliationEnabled.value() === "true",
            reconciliationDays: Number(leadStudioGmailReconciliationDays.value()) || 14
          }
        });
      }
    });
  } catch (error) {
    if (error instanceof functions.HttpsError) throw error;
    logger.error("leadStudioActionV5 failed", {
      name: error && error.name,
      message: error && error.message
    });
    throw new functions.HttpsError("internal", "Lead Studio could not load its data.");
  }
});

async function buildLiveRefreshPlan(sheetsClient, options) {
  options = options || {};
  sheetsClient = sheetsClient || createWriteSheetsClient();
  var spreadsheetId = leadStudioSpreadsheetId.value().trim();
  var workspaceOptions = {
    delegatedUser: leadStudioGmailUser.value(),
    serviceAccountEmail: leadStudioServiceAccountEmail.value(),
    signJwt: signWorkspaceJwt,
    operational: true,
    timeZone: "Europe/Ljubljana",
    lookbackDays: options.forceFullGmailScan === true || leadStudioGmailNarrowReconciliationEnabled.value() !== "true"
      ? undefined : (Number(leadStudioGmailReconciliationDays.value()) || 14)
  };
  workspaceOptions.accessTokenPromise = options.accessTokenPromise ||
    workspaceDelegation.createDelegatedAccessToken(workspaceOptions);
  var snapshotPromise = refreshMutation.readSnapshot({ sheetsClient: sheetsClient, spreadsheetId: spreadsheetId });
  var leadScanOptions = Object.assign({}, workspaceOptions, {
    excludedMessageIdsPromise: snapshotPromise.then(refreshMutation.collectGmailMessageIds)
  });
  var initial = await Promise.all([
    snapshotPromise,
    workspaceDelegation.scanGmailLeadMessages(leadScanOptions),
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
    jiraClient.findJiraIssuesForContacts(Object.assign({}, jiraConfig, {
      contactEmails: newLeadEmails,
      concurrency: 4
    }))
  ]);
  var plan = refreshMutation.buildRefreshPlan({
    snapshot: snapshot,
    gmailLeadScan: gmailLeadScan,
    gmailOnboardingScan: gmailOnboardingScan,
    onboardingLookup: onboardingLookup,
    liveStatuses: jiraResults[0],
    jiraByEmail: jiraResults[1],
    timeZone: "Europe/Ljubljana"
  });
  plan.summary.inputs = {
    gmailLeadCandidates: gmailLeadScan.candidateMessages,
    gmailLeadSkippedKnown: gmailLeadScan.skippedKnownMessages,
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

exports.leadStudioScheduledRefreshV5 = scheduler.onSchedule({
  region: "europe-west1",
  schedule: "0 6 * * *",
  timeZone: "Europe/Ljubljana",
  retryCount: 2,
  maxRetrySeconds: 900,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 300,
  maxDoublings: 2,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  timeoutSeconds: 180,
  memory: "512MiB",
  maxInstances: 1,
  concurrency: 1,
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT
}, async function (event) {
  if (leadStudioScheduledRefreshEnabled.value() !== "true") {
    logger.info("Lead Studio scheduled refresh skipped because its gate is disabled.");
    return;
  }
  try {
    var execution = await withLeadStudioWriterLock("scheduled-refresh", async function () {
      var prepared = await buildLiveRefreshPlan();
      var result = await refreshMutation.executeRefreshPlan({
        plan: prepared.plan,
        sheetsClient: prepared.sheetsClient,
        spreadsheetId: prepared.spreadsheetId,
        actor: "firebase-scheduler",
        idempotencyKey: refreshMutation.scheduledIdempotencyKey(event && event.scheduleTime),
        expectedVersion: prepared.plan.originalVersion,
        restoreAfterVerify: false
      });
      return { result: result, inputs: prepared.plan.summary.inputs };
    });
    logger.info("Lead Studio scheduled Firebase refresh completed", {
      changedRows: execution.result.changedRows,
      appendedRows: execution.result.appendedRows,
      replayed: execution.result.replayed,
      gmailLeadCandidates: execution.inputs.gmailLeadCandidates,
      gmailLeadSkippedKnown: execution.inputs.gmailLeadSkippedKnown,
      gmailLeadDownloaded: execution.inputs.gmailLeadCandidates - execution.inputs.gmailLeadSkippedKnown,
      delegatedCredentialExchanges: 1
    });
  } catch (error) {
    logger.error("leadStudioScheduledRefreshV5 failed", {
      name: error && error.name,
      code: error && error.code,
      message: error && error.message
    });
    throw error;
  }
});

async function renewGmailWatch() {
  return withLeadStudioWriterLock("gmail-watch-renewal", async function () {
    var current = await gmailWatchState.readWatchState(watchStateOptions());
    var watch = await workspaceDelegation.renewGmailWatch(gmailWorkspaceOptions({
      topicName: leadStudioGmailTopicName.value()
    }));
    var now = new Date().toISOString();
    return gmailWatchState.writeWatchState(watchStateOptions(), Object.assign({}, current || {}, {
      emailAddress: watch.emailAddress,
      processedHistoryId: current && current.processedHistoryId || watch.historyId,
      watchHistoryId: watch.historyId,
      watchExpiration: watch.expiration,
      renewedAt: now,
      lastFailureAt: "",
      lastFailureCode: ""
    }));
  });
}

exports.leadStudioRenewGmailWatchV5 = scheduler.onSchedule({
  region: "europe-west1",
  schedule: "0 3 * * *",
  timeZone: "Europe/Ljubljana",
  retryCount: 2,
  timeoutSeconds: 60,
  memory: "256MiB",
  maxInstances: 1,
  concurrency: 1,
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT
}, async function () {
  if (leadStudioGmailWatchEnabled.value() !== "true") {
    logger.info("Lead Studio Gmail watch renewal skipped because its gate is disabled.");
    return;
  }
  try {
    var state = await renewGmailWatch();
    logger.info("Lead Studio Gmail watch renewed", {
      emailAddress: state.emailAddress,
      expiration: state.watchExpiration
    });
  } catch (error) {
    logger.error("leadStudioRenewGmailWatchV5 failed", {
      name: error && error.name,
      code: error && error.code,
      statusCode: error && error.statusCode,
      message: error && error.message
    });
    throw error;
  }
});

exports.leadStudioHealthCheckV5 = scheduler.onSchedule({
  region: "europe-west1",
  schedule: "15 */6 * * *",
  timeZone: "Europe/Ljubljana",
  retryCount: 0,
  secrets: [leadStudioSpreadsheetId],
  timeoutSeconds: 30,
  memory: "256MiB",
  maxInstances: 1,
  concurrency: 1,
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT
}, async function () {
  var status = await operationsStatus.loadOperationsStatus({
    sheetsClient: createSheetsClient(),
    spreadsheetId: leadStudioSpreadsheetId.value().trim(),
    watchState: await gmailWatchState.readWatchState(watchStateOptions()),
    runtime: {
      scheduledRefreshEnabled: leadStudioScheduledRefreshEnabled.value() === "true",
      gmailWatchEnabled: leadStudioGmailWatchEnabled.value() === "true",
      gmailPushEnabled: leadStudioGmailPushEnabled.value() === "true"
    }
  });
  var failures = operationsStatus.healthFailures(status);
  if (failures.length) {
    logger.error("Lead Studio runtime health check failed", { failures: failures });
    var error = new Error("Lead Studio runtime health check failed.");
    error.code = "failed-precondition";
    throw error;
  }
  logger.info("Lead Studio runtime health check passed", {
    scheduledEvent: status.debugLog.latestScheduled && status.debugLog.latestScheduled.timestamp,
    gmailWatchConfigured: status.gmailWatch.configured === true
  });
});

function gmailNotification(event) {
  var message = event && event.data && event.data.message || {};
  try {
    if (message.json) return message.json;
  } catch (_) {}
  try {
    return JSON.parse(Buffer.from(String(message.data || ""), "base64").toString("utf8"));
  } catch (_) {
    return {};
  }
}

async function recordGmailPushFailure(error) {
  try {
    await withLeadStudioWriterLock("gmail-push-failure", async function () {
      var current = await gmailWatchState.readWatchState(watchStateOptions());
      if (!current) return;
      await gmailWatchState.writeWatchState(watchStateOptions(), Object.assign({}, current, {
        lastFailureAt: new Date().toISOString(),
        lastFailureCode: String(error && (error.code || error.statusCode) || "internal")
      }));
    });
  } catch (_) {}
}

exports.leadStudioGmailPushV5 = pubsub.onMessagePublished({
  topic: "lead-studio-gmail-changes",
  region: "europe-west1",
  retry: true,
  timeoutSeconds: 360,
  memory: "512MiB",
  maxInstances: 1,
  concurrency: 1,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT
}, async function (event) {
  var pushStartedMs = Date.now();
  if (leadStudioGmailPushEnabled.value() !== "true") {
    logger.info("Lead Studio Gmail push skipped because its gate is disabled.");
    return;
  }
  var notification = gmailNotification(event);
  var expectedMailbox = leadStudioGmailUser.value().trim().toLowerCase();
  if (String(notification.emailAddress || "").trim().toLowerCase() !== expectedMailbox) {
    logger.warn("Ignored Gmail notification for an unexpected mailbox.");
    return;
  }
  try {
    logger.info("Lead Studio Gmail history ingestion started.");
    var output = await withLeadStudioWriterLock("gmail-push", async function () {
      var state = await gmailWatchState.readWatchState(watchStateOptions());
      if (!state || !state.processedHistoryId) {
        var missingStateError = new Error("Gmail watch state has not been initialized.");
        missingStateError.code = "failed-precondition";
        throw missingStateError;
      }
      var sharedAccessToken = workspaceDelegation.createDelegatedAccessToken(gmailWorkspaceOptions());
      var history;
      try {
        history = await workspaceDelegation.loadGmailHistory(gmailWorkspaceOptions({
          startHistoryId: state.processedHistoryId,
          accessTokenPromise: sharedAccessToken,
          requestTimeoutMs: EXTERNAL_REQUEST_TIMEOUT_MS
        }));
      } catch (historyError) {
        if (Number(historyError && historyError.statusCode) !== 404) throw historyError;
        var recoveryPlan = await buildLiveRefreshPlan(createWriteSheetsClient(), {
          forceFullGmailScan: true,
          accessTokenPromise: sharedAccessToken
        });
        var recoveryEnd = String(notification.historyId || state.watchHistoryId || state.processedHistoryId).trim();
        var recoveryResult = await refreshMutation.executeRefreshPlan({
          plan: recoveryPlan.plan,
          sheetsClient: recoveryPlan.sheetsClient,
          spreadsheetId: recoveryPlan.spreadsheetId,
          actor: "firebase-gmail-recovery",
          idempotencyKey: gmailIncrementalMutation.pushIdempotencyKey(state.processedHistoryId, recoveryEnd),
          expectedVersion: recoveryPlan.plan.originalVersion,
          restoreAfterVerify: false,
          auditEventPrefix: "FIREBASE_GMAIL_RECOVERY",
          auditSource: "leadStudioGmailPushV5",
          command: "gmail_history_recovery"
        });
        var renewed = await workspaceDelegation.renewGmailWatch(gmailWorkspaceOptions({
          topicName: leadStudioGmailTopicName.value(),
          accessTokenPromise: sharedAccessToken
        }));
        var recoveredAt = new Date().toISOString();
        await gmailWatchState.writeWatchState(watchStateOptions(), Object.assign({}, state, {
          emailAddress: renewed.emailAddress,
          processedHistoryId: renewed.historyId,
          watchHistoryId: renewed.historyId,
          watchExpiration: renewed.expiration,
          renewedAt: recoveredAt,
          lastPushAt: recoveredAt,
          lastSuccessAt: recoveredAt,
          lastFailureAt: "",
          lastFailureCode: "",
          lastCandidateMessages: 0,
          lastAcceptedLeads: 0,
          lastAcceptedOnboarding: 0
        }));
        return { recovered: true, result: recoveryResult };
      }
      logger.info("Lead Studio Gmail history loaded.", {
        pages: history.pages,
        candidateMessages: history.candidateMessages,
        durationMs: Date.now() - pushStartedMs
      });
      var sheetsClient = createWriteSheetsClient();
      var snapshot = await refreshMutation.readSnapshot({
        sheetsClient: sheetsClient,
        spreadsheetId: leadStudioSpreadsheetId.value().trim()
      });
      logger.info("Lead Studio Gmail push Sheet snapshot loaded.", {
        rowCount: snapshot.rows.length,
        durationMs: Date.now() - pushStartedMs
      });
      var plan = gmailIncrementalMutation.buildIncrementalPlan({
        snapshot: snapshot,
        leadMessages: history.acceptedLeadMessages,
        onboardingMessages: history.acceptedOnboardingMessages
      });
      var result = await refreshMutation.executeRefreshPlan({
        plan: plan,
        sheetsClient: sheetsClient,
        spreadsheetId: leadStudioSpreadsheetId.value().trim(),
        actor: "firebase-gmail-push",
        idempotencyKey: gmailIncrementalMutation.pushIdempotencyKey(history.startHistoryId, history.historyId),
        expectedVersion: plan.originalVersion,
        restoreAfterVerify: false,
        auditEventPrefix: "FIREBASE_GMAIL_PUSH",
        auditSource: "leadStudioGmailPushV5",
        command: "gmail_history_ingestion"
      });
      var now = new Date().toISOString();
      await gmailWatchState.writeWatchState(watchStateOptions(), Object.assign({}, state, {
        processedHistoryId: history.historyId,
        lastPushAt: now,
        lastSuccessAt: now,
        lastFailureAt: "",
        lastFailureCode: "",
        lastCandidateMessages: history.candidateMessages,
        lastAcceptedLeads: history.acceptedLeadMessages.length,
        lastAcceptedOnboarding: history.acceptedOnboardingMessages.length
      }));
      return { recovered: false, history: history, result: result };
    });
    logger.info(output.recovered ? "Lead Studio Gmail history cursor recovered" : "Lead Studio Gmail history ingestion completed", {
      recovered: output.recovered,
      candidateMessages: output.history ? output.history.candidateMessages : 0,
      acceptedLeads: output.history ? output.history.acceptedLeadMessages.length : 0,
      acceptedOnboarding: output.history ? output.history.acceptedOnboardingMessages.length : 0,
      changedRows: output.result.changedRows,
      appendedRows: output.result.appendedRows,
      replayed: output.result.replayed,
      durationMs: Date.now() - pushStartedMs
    });
  } catch (error) {
    await recordGmailPushFailure(error);
    logger.error("leadStudioGmailPushV5 failed", {
      name: error && error.name,
      code: error && error.code,
      statusCode: error && error.statusCode,
      message: error && error.message,
      durationMs: Date.now() - pushStartedMs
    });
    throw error;
  }
});

exports.leadStudioManualJiraV5 = functions.onCall({
  region: "europe-west1",
  cors: LEAD_STUDIO_ORIGINS,
  secrets: [leadStudioSpreadsheetId, leadStudioJiraApiToken],
  serviceAccount: LEAD_STUDIO_WRITER_SERVICE_ACCOUNT,
  timeoutSeconds: 30,
  memory: "256MiB",
  maxInstances: 1,
  concurrency: 1
}, async function (request) {
  try {
    var data = request && request.data || {};
    var actionName = String(data.action || "").trim();
    if (leadStudioManualJiraEnabled.value().toLowerCase() !== "true") {
      throw new functions.HttpsError("failed-precondition", "Lead Studio manual Jira writes are disabled.");
    }
    var authorization = await leadStudio.verifyAccess(data.studioAuthToken, "write");
    var rowNumber = Number(data.rowNumber);
    var options = {
      sheetsClient: createWriteSheetsClient(),
      spreadsheetId: leadStudioSpreadsheetId.value().trim(),
      rowNumber: rowNumber,
      actor: authorization.email,
      idempotencyKey: data.idempotencyKey,
      expectedVersion: data.expectedVersion,
      issueKey: data.issueKey,
      jiraBaseUrl: leadStudioJiraBaseUrl.value(),
      jiraBrowserBaseUrl: leadStudioJiraBrowserBaseUrl.value(),
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
        mode: "manual-jira-operational",
        manualJira: await manualJiraLink.prepareManualJiraLink(options),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    if (actionName === "saveManualJiraLink") {
      return {
        mode: "manual-jira-operational",
        manualJira: await withLeadStudioWriterLock("manual-jira", function () {
          return manualJiraLink.executeManualJiraLink(options);
        }),
        authorization: leadStudio.publicAuthorization(authorization)
      };
    }
    throw new functions.HttpsError("invalid-argument", "Unsupported manual Jira action.");
  } catch (error) {
    if (error instanceof functions.HttpsError) throw error;
    var safeCodes = new Set(["aborted", "data-loss", "failed-precondition", "invalid-argument"]);
    var code = safeCodes.has(error && error.code) ? error.code : "internal";
    logger.error("leadStudioManualJiraV5 failed", {
      code: code,
      name: error && error.name,
      providerStatus: Number(error && error.response && error.response.status) || 0
    });
    throw new functions.HttpsError(code, code === "internal" ? "Lead Studio manual Jira update failed." : error.message);
  }
});
