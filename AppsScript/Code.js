function doGet(e) {
  if (e && e.parameter && e.parameter.setupAction) {
    return handleSetupRequest_(e);
  }

  if (e && e.parameter && e.parameter.testAction) {
    return handleTestRequest_(e);
  }

  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(TRACKER_CONFIG.appName)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function bootstrapTrackerAppCore() {
  return {
    viewerEmail: Session.getActiveUser().getEmail(),
    config: getTrackerPublicConfig_(),
    propertyStatus: getRequiredPropertyStatus_()
  };
}

function loadEmailMatchesForUi() {
  return loadEmailMatchesFromSheet_();
}

function refreshEmailMatchesFromGmail() {
  return refreshEmailMatchesWithOptions_({
    deepScan: false
  });
}

function deepScanEmailMatchesFromGmail() {
  return refreshEmailMatchesWithOptions_({
    deepScan: true
  });
}

function refreshEmailMatchesWithOptions_(options) {
  const scanResult = scanMarketingEmailsWithOnboarding_(options || {});

  saveEmailMatchesToSheet_(scanResult.matches);
  updateEmailMatchesOnboardingStatus_(scanResult.onboardingMatches);
  updateEmailMatchesFromOnboardingAndJira_();

  return loadEmailMatchesFromSheet_();
}

function getOperationsStatusForUi() {
  return getLeadStudioOperationsStatus_();
}

function runLeadStudioSmokeTestsForUi() {
  return runLeadStudioSmokeTests();
}

function scheduledRefreshLeads() {
  const lock = LockService.getScriptLock();

  if (!lock.tryLock(1000)) {
    appendDebugLog_('SCHEDULED_REFRESH_SKIPPED', 'scheduledRefreshLeads', 'Skipped scheduled refresh because another refresh is already running.', {});
    return;
  }

  try {
    const before = loadEmailMatchesFromSheet_();
    const after = refreshEmailMatchesFromGmail();

    appendDebugLog_('SCHEDULED_REFRESH_COMPLETE', 'scheduledRefreshLeads', 'Completed scheduled Refresh Leads run.', {
      beforeRows: before.rows.length,
      afterRows: after.rows.length,
      addedRows: after.rows.length - before.rows.length
    });
  } catch (error) {
    appendDebugLog_('SCHEDULED_REFRESH_FAILED', 'scheduledRefreshLeads', error && error.message ? error.message : String(error), {});
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function checkJiraConnectionForUi() {
  return jiraCheckConnection_();
}

function refreshJiraStatusesForUi() {
  updateEmailMatchesFromOnboardingAndJira_();

  return loadEmailMatchesFromSheet_();
}

function prepareDeepJiraRefreshForUi() {
  return Object.assign({
    ok: true
  }, buildJiraRefreshCandidateIndexes_());
}

function refreshJiraStatusesBatchForUi(payload) {
  const options = payload || {};
  const result = updateEmailMatchesFromOnboardingAndJira_({
    startIndex: options.startIndex || 0,
    batchSize: options.batchSize || 10,
    rowIndexes: options.rowIndexes || []
  });

  return Object.assign({
    ok: true
  }, result);
}

function updateManualJiraLinkForUi(payload) {
  return updateEmailMatchManualJiraLink_(payload);
}

function testLatestNewContactEmailForUi() {
  return testLatestNewContactEmail_();
}

function testMarketingMailboxAccessForUi() {
  return testMarketingMailboxAccess_();
}

function getServiceAccountInfoForSetupUi() {
  return getServiceAccountInfoForUi();
}

function handleSetupRequest_(e) {
  const action = normalizeValue_(e && e.parameter && e.parameter.setupAction).toLowerCase();
  const token = normalizeValue_(e && e.parameter && e.parameter.token);

  if (token !== 'lead_studio_setup_2026') {
    return buildJsonResponse_({
      ok: false,
      error: 'Unauthorized'
    });
  }

  if (!areSetupEndpointsEnabled_()) {
    return buildJsonResponse_({
      ok: false,
      error: 'Setup URL endpoints are disabled. Run setup functions directly from the Apps Script editor or set LEAD_STUDIO_SETUP_ENDPOINTS_ENABLED=true temporarily.'
    });
  }

  if (action === 'movedatabase') {
    return buildJsonResponse_(moveLeadStudioDatabaseToProjectFolder());
  }

  if (action === 'installdailyrefreshleadstrigger') {
    return buildJsonResponse_(installDailyRefreshLeadsTrigger());
  }

  if (action === 'removedailyrefreshleadstrigger') {
    return buildJsonResponse_(removeDailyRefreshLeadsTrigger());
  }

  if (action === 'dailyrefreshleadstriggerstatus') {
    return buildJsonResponse_(getDailyRefreshLeadsTriggerStatus());
  }

  return buildJsonResponse_({
    ok: false,
    error: 'Unknown setup action'
  });
}

function buildJsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

function handleTestRequest_(e) {
  const action = normalizeValue_(e && e.parameter && e.parameter.testAction).toLowerCase();
  const token = normalizeValue_(e && e.parameter && e.parameter.token);

  if (token !== 'lead_studio_test_2026') {
    return buildJsonResponse_({
      ok: false,
      error: 'Unauthorized'
    });
  }

  if (!areTestEndpointsEnabled_()) {
    return buildJsonResponse_({
      ok: false,
      error: 'Test URL endpoints are disabled. Use Settings diagnostics or set LEAD_STUDIO_TEST_ENDPOINTS_ENABLED=true temporarily.'
    });
  }

  if (action === 'newcontactgmail') {
    return buildJsonResponse_(testLatestNewContactEmail_());
  }

  if (action === 'refreshgmailmatches') {
    return buildJsonResponse_(refreshEmailMatchesForImportEndpoint_());
  }

  if (action === 'deepscangmailmatches') {
    return buildJsonResponse_(deepScanEmailMatchesForImportEndpoint_());
  }

  return buildJsonResponse_({
    ok: false,
    error: 'Unknown test action'
  });
}

function refreshEmailMatchesForImportEndpoint_() {
  const before = loadEmailMatchesFromSheet_();
  const after = refreshEmailMatchesFromGmail();

  return {
    ok: true,
    beforeRows: before.rows.length,
    afterRows: after.rows.length,
    addedRows: after.rows.length - before.rows.length,
    headers: after.headers,
    query: buildMarketingEmailQuery_({
      deepScan: false
    }),
    mailbox: TRACKER_CONFIG.gmail.mailboxUser,
    maxResults: TRACKER_CONFIG.gmail.maxResults
  };
}

function areSetupEndpointsEnabled_() {
  return normalizeValue_(PropertiesService.getScriptProperties().getProperty('LEAD_STUDIO_SETUP_ENDPOINTS_ENABLED')).toLowerCase() === 'true';
}

function areTestEndpointsEnabled_() {
  return normalizeValue_(PropertiesService.getScriptProperties().getProperty('LEAD_STUDIO_TEST_ENDPOINTS_ENABLED')).toLowerCase() === 'true';
}

function deepScanEmailMatchesForImportEndpoint_() {
  const before = loadEmailMatchesFromSheet_();
  const after = deepScanEmailMatchesFromGmail();

  return {
    ok: true,
    beforeRows: before.rows.length,
    afterRows: after.rows.length,
    addedRows: after.rows.length - before.rows.length,
    headers: after.headers,
    query: buildMarketingEmailQuery_({
      deepScan: true
    }),
    mailbox: TRACKER_CONFIG.gmail.mailboxUser,
    maxResults: TRACKER_CONFIG.gmail.deepScanMaxResults
  };
}
