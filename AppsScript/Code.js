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

function getLeadStudioAuthRuntimeConfig() {
  const authConfig = TRACKER_CONFIG.studioAuth || {};

  return {
    studioId: authConfig.studioId || 'lead-studio',
    requiredScope: 'read',
    verifierUrl: authConfig.verifierUrl,
    authPopupUrl: authConfig.authPopupUrl,
    firebaseConfig: {
      apiKey: '',
      authDomain: authConfig.authDomain,
      projectId: authConfig.projectId,
      storageBucket: authConfig.storageBucket,
      messagingSenderId: authConfig.messagingSenderId,
      appId: authConfig.appId,
      measurementId: authConfig.measurementId
    }
  };
}

function bootstrapTrackerAppCore(authPayload) {
  const currentUser = assertAuthorizedUser_(authPayload, 'read');

  return {
    viewerEmail: currentUser.email,
    viewerRole: currentUser.role,
    config: getTrackerPublicConfig_(),
    propertyStatus: getRequiredPropertyStatus_()
  };
}

function loadEmailMatchesForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'read');
  return loadEmailMatchesFromSheet_();
}

function refreshEmailMatchesFromGmail(authPayload) {
  assertAuthorizedUser_(authPayload, 'write');
  return refreshEmailMatchesWithOptions_({
    deepScan: false
  });
}

function deepScanEmailMatchesFromGmail(authPayload) {
  assertAuthorizedUser_(authPayload, 'write');
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

function getOperationsStatusForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'read');
  return getLeadStudioOperationsStatus_();
}

function runLeadStudioSmokeTestsForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'settings');
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
    const after = refreshEmailMatchesWithOptions_({
      deepScan: false
    });

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

function checkJiraConnectionForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'settings');
  return jiraCheckConnection_();
}

function refreshJiraStatusesForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'write');
  updateEmailMatchesFromOnboardingAndJira_();

  return loadEmailMatchesFromSheet_();
}

function prepareDeepJiraRefreshForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'write');
  return Object.assign({
    ok: true
  }, buildJiraRefreshCandidateIndexes_());
}

function refreshJiraStatusesBatchForUi(payload, authPayload) {
  assertAuthorizedUser_(authPayload, 'write');
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

function updateManualJiraLinkForUi(payload, authPayload) {
  assertAuthorizedUser_(authPayload, 'write');
  return updateEmailMatchManualJiraLink_(payload);
}

function testLatestNewContactEmailForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'settings');
  return testLatestNewContactEmail_();
}

function testMarketingMailboxAccessForUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'settings');
  return testMarketingMailboxAccess_();
}

function getServiceAccountInfoForSetupUi(authPayload) {
  assertAuthorizedUser_(authPayload, 'settings');
  return getServiceAccountInfoForUi();
}

function assertAuthorizedUser_(authPayload, requiredScope) {
  const authConfig = TRACKER_CONFIG.studioAuth || {};

  if (!authConfig.enabled) {
    return {
      email: normalizeValue_(Session.getActiveUser().getEmail()).toLowerCase(),
      role: '',
      scopes: [],
      authorized: true
    };
  }

  const idToken = normalizeValue_(authPayload && authPayload.idToken);

  if (!idToken) {
    throw new Error('Access denied. Please sign in with Google.');
  }

  const result = verifyStudioAccess_(idToken, requiredScope || 'read');

  if (!result.allowed) {
    throw new Error(result.message || 'Access denied.');
  }

  return {
    email: result.email || '',
    role: result.role || '',
    scopes: result.scopes || [],
    authorized: true
  };
}

function verifyStudioAccess_(idToken, requiredScope) {
  const authConfig = TRACKER_CONFIG.studioAuth || {};
  const response = UrlFetchApp.fetch(authConfig.verifierUrl, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      idToken: idToken,
      studioId: authConfig.studioId || 'lead-studio',
      requiredScope: requiredScope || 'read'
    })
  });
  const status = response.getResponseCode();
  let result = {};

  try {
    result = JSON.parse(response.getContentText() || '{}');
  } catch (error) {
    result = {};
  }

  if (status < 200 || status >= 300) {
    return {
      allowed: false,
      reason: result.reason || 'verifier_error',
      message: result.message || 'Access verification failed.'
    };
  }

  return result;
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
  const after = refreshEmailMatchesWithOptions_({
    deepScan: false
  });

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
  const after = refreshEmailMatchesWithOptions_({
    deepScan: true
  });

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
