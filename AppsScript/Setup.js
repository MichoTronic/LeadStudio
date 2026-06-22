function moveLeadStudioDatabaseToProjectFolder() {
  const file = DriveApp.getFileById(TRACKER_CONFIG.spreadsheetId);
  const folder = DriveApp.getFolderById(TRACKER_CONFIG.driveFolderId);

  file.moveTo(folder);

  return {
    ok: true,
    spreadsheetId: TRACKER_CONFIG.spreadsheetId,
    folderId: TRACKER_CONFIG.driveFolderId
  };
}

function setJiraScriptPropertiesForSetup_(token, baseUrl, email, apiToken) {
  if (normalizeValue_(token) !== 'lead_studio_setup_2026') {
    throw new Error('Unauthorized');
  }

  if (!normalizeValue_(baseUrl) || !normalizeValue_(email) || !normalizeValue_(apiToken)) {
    throw new Error('Missing Jira setup value.');
  }

  PropertiesService.getScriptProperties().setProperties({
    JIRA_BASE_URL: normalizeValue_(baseUrl).replace(/\/+$/, ''),
    JIRA_EMAIL: normalizeValue_(email),
    JIRA_API_TOKEN: normalizeValue_(apiToken)
  }, false);

  return getRequiredPropertyStatus_();
}

function setJiraScriptPropertiesForSetup(token, baseUrl, email, apiToken) {
  return setJiraScriptPropertiesForSetup_(token, baseUrl, email, apiToken);
}

function installDailyRefreshLeadsTrigger() {
  removeDailyRefreshLeadsTrigger();

  const trigger = ScriptApp.newTrigger('scheduledRefreshLeads')
    .timeBased()
    .everyDays(1)
    .atHour(6)
    .nearMinute(0)
    .create();

  appendDebugLog_('DAILY_REFRESH_TRIGGER_INSTALLED', 'installDailyRefreshLeadsTrigger', 'Installed daily Refresh Leads trigger for 06:00 project time.', {
    triggerUniqueId: trigger.getUniqueId(),
    timezone: Session.getScriptTimeZone()
  });

  const status = getDailyRefreshLeadsTriggerStatus();
  Logger.log(JSON.stringify(status, null, 2));

  return status;
}

function removeDailyRefreshLeadsTrigger() {
  let removed = 0;

  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() !== 'scheduledRefreshLeads') {
      return;
    }

    ScriptApp.deleteTrigger(trigger);
    removed += 1;
  });

  if (removed) {
    appendDebugLog_('DAILY_REFRESH_TRIGGER_REMOVED', 'removeDailyRefreshLeadsTrigger', 'Removed daily Refresh Leads triggers.', {
      removed: removed
    });
  }

  const result = {
    ok: true,
    removed: removed
  };

  Logger.log(JSON.stringify(result, null, 2));

  return result;
}

function getDailyRefreshLeadsTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === 'scheduledRefreshLeads';
  });

  const status = {
    ok: true,
    timezone: Session.getScriptTimeZone(),
    triggerCount: triggers.length,
    triggers: triggers.map(function(trigger) {
      return {
        uniqueId: trigger.getUniqueId(),
        handlerFunction: trigger.getHandlerFunction(),
        eventType: String(trigger.getEventType()),
        source: String(trigger.getTriggerSource())
      };
    })
  };

  Logger.log(JSON.stringify(status, null, 2));

  return status;
}
