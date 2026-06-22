function getTrackerSpreadsheet_() {
  return SpreadsheetApp.openById(TRACKER_CONFIG.spreadsheetId);
}

function getEmailMatchesSheet_() {
  const sheet = getTrackerSpreadsheet_().getSheetByName(TRACKER_CONFIG.sheets.emailMatches);

  if (!sheet) {
    throw new Error('Missing sheet: ' + TRACKER_CONFIG.sheets.emailMatches);
  }

  return sheet;
}

function loadEmailMatchesFromSheet_() {
  const sheet = getEmailMatchesSheet_();
  const headers = getSheetHeaders_(sheet);
  const lastRow = sheet.getLastRow();
  const rows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];

  return {
    headers: getVisibleEmailMatchHeaders_(headers),
    rows: rows.filter(hasAnyRowValue_).map(function(row) {
      const allValues = headers.reduce(function(output, header, index) {
        output[header] = sanitizeSheetValue_(row[index], header);
        return output;
      }, {});

      return {
        values: getVisibleEmailMatchHeaders_(headers).reduce(function(output, header) {
          output[header] = allValues[header] || '';
          return output;
        }, {}),
        allValues: allValues
      };
    })
  };
}

function getVisibleEmailMatchHeaders_(sheetHeaders) {
  const availableHeaders = sheetHeaders || [];

  return TRACKER_CONFIG.uiTableColumns.filter(function(header) {
    return availableHeaders.indexOf(header) !== -1;
  });
}

function saveEmailMatchesToSheet_(matches) {
  const sheet = getEmailMatchesSheet_();
  const headers = getSheetHeaders_(sheet);
  const existingIds = getExistingMessageIds_(sheet, headers);
  const rowsToAppend = [];

  (matches || []).forEach(function(match) {
    const values = match && match.values ? match.values : {};
    const messageId = normalizeValue_(values['Gmail Message ID']);

    if (!messageId || existingIds[messageId]) {
      return;
    }

    existingIds[messageId] = true;
    rowsToAppend.push(headers.map(function(header) {
      return values[header] == null ? '' : values[header];
    }));
  });

  if (rowsToAppend.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAppend.length, headers.length).setValues(rowsToAppend);
  }

  return loadEmailMatchesFromSheet_();
}

function updateEmailMatchesOnboardingStatus_(onboardingMatches) {
  const sheet = getEmailMatchesSheet_();
  const headers = getSheetHeaders_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return;
  }

  const emailIndex = headers.indexOf('Contact Email');
  const onboardingIndex = headers.indexOf('Onboarding Sent');
  const onboardingAtIndex = headers.indexOf('Onboarding Sent At');
  const onboardingMessageIndex = headers.indexOf('Onboarding Message ID');

  if (emailIndex === -1 || onboardingIndex === -1) {
    return;
  }

  const rowCount = lastRow - 1;
  const values = sheet.getRange(2, 1, rowCount, headers.length).getValues();
  const lookup = buildSheetOnboardingLookup_(onboardingMatches);
  const onboardingValues = [];
  const onboardingAtValues = [];
  const onboardingMessageValues = [];

  values.forEach(function(row) {
    const match = lookup[normalizeValue_(row[emailIndex]).toLowerCase()];

    onboardingValues.push([match && match.count ? String(match.count) : '']);
    onboardingAtValues.push([match && match.latestAt ? match.latestAt : '']);
    onboardingMessageValues.push([match && match.messageIds ? match.messageIds.join(', ') : '']);
  });

  sheet.getRange(2, onboardingIndex + 1, rowCount, 1).setValues(onboardingValues);

  if (onboardingAtIndex !== -1) {
    sheet.getRange(2, onboardingAtIndex + 1, rowCount, 1).setValues(onboardingAtValues);
  }

  if (onboardingMessageIndex !== -1) {
    sheet.getRange(2, onboardingMessageIndex + 1, rowCount, 1).setValues(onboardingMessageValues);
  }
}

function updateEmailMatchesFromOnboardingAndJira_(options) {
  const refreshOptions = options || {};
  const sheet = getEmailMatchesSheet_();
  const headers = getSheetHeaders_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return {
      updatedRows: 0,
      matchedRows: 0,
      jiraCheckedRows: 0
    };
  }

  const rowCount = lastRow - 1;
  const values = sheet.getRange(2, 1, rowCount, headers.length).getValues();
  const indexes = buildHeaderIndexMap_(headers);
  const rowIndexes = (refreshOptions.rowIndexes || []).map(function(index) {
    return Number(index);
  }).filter(function(index) {
    return index >= 0 && index < rowCount;
  });
  const hasExplicitRows = rowIndexes.length > 0;
  const startIndex = Math.max(0, Math.min(rowCount, Number(refreshOptions.startIndex) || 0));
  const requestedBatchSize = Number(refreshOptions.batchSize) || rowCount;
  const batchSize = Math.max(1, Math.min(rowCount - startIndex || 1, requestedBatchSize));
  const endIndex = hasExplicitRows ? rowCount : Math.min(rowCount, startIndex + batchSize);
  const workItems = hasExplicitRows
    ? rowIndexes.map(function(index) {
      return {
        index: index,
        row: values[index]
      };
    })
    : values.slice(startIndex, endIndex).map(function(row, offset) {
      return {
        index: startIndex + offset,
        row: row
      };
    });
  const rowsToProcess = workItems.map(function(item) {
    return item.row;
  });
  const onboardingLookup = loadOnboardingRequestsLookup_();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const canCheckJira = hasJiraScriptProperties_();
  const jiraStatusLookup = canCheckJira ? safeGetJiraIssueStatusesByKeys_(collectJiraIssueKeysForRows_(rowsToProcess, indexes, onboardingLookup)) : {};
  let updatedRows = 0;
  let matchedRows = 0;
  let jiraCheckedRows = 0;
  const changedItems = [];

  workItems.forEach(function(item) {
    const row = item.row;
    const email = rowValueByHeader_(row, indexes, 'Contact Email');
    const name = rowValueByHeader_(row, indexes, 'Name');
    const lastName = rowValueByHeader_(row, indexes, 'Last Name');
    const existingKey = normalizeJiraIssueKey_(rowValueByHeader_(row, indexes, 'Jira Issue Key'));
    const existingUrl = rowValueByHeader_(row, indexes, 'Jira Issue URL');
    const existingSource = rowValueByHeader_(row, indexes, 'Jira Match Source');
    const onboardingResult = findOnboardingRequestForLead_(onboardingLookup, email, name, lastName);
    const onboardingMatch = onboardingResult.match;
    let issueKey = existingKey;
    let issueUrl = normalizeJiraIssueUrl_(existingUrl, existingKey);
    let source = existingSource;
    let rowChanged = false;

    if (onboardingMatch && onboardingMatch.jiraIssueKey) {
      matchedRows += 1;

      if (!issueKey) {
        issueKey = onboardingMatch.jiraIssueKey;
        issueUrl = onboardingMatch.jiraIssueUrl;
        source = onboardingResult.source;
        rowChanged = true;
      } else if (issueKey === onboardingMatch.jiraIssueKey) {
        issueUrl = issueUrl || onboardingMatch.jiraIssueUrl;
        source = source || onboardingResult.source;
        rowChanged = true;
      } else {
        appendDebugLog_('JIRA_MATCH_CONFLICT', 'updateEmailMatchesFromOnboardingAndJira_', 'Existing Jira key differs from onboarding sheet match.', {
          contactEmail: email,
          existingKey: issueKey,
          onboardingKey: onboardingMatch.jiraIssueKey,
          onboardingSheetRow: onboardingMatch.rowNumber
        });
      }

      rowChanged = setRowValueByHeader_(row, indexes, 'Onboarding Submitted At', onboardingMatch.submittedAt) || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Onboarding Sheet Row', onboardingMatch.rowNumber ? String(onboardingMatch.rowNumber) : '') || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Target Region', onboardingMatch.targetRegion) || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Info Sheet', onboardingMatch.infoSheetUrl) || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Onboarding Doc', onboardingMatch.onboardingDocUrl) || rowChanged;
    }

    if (issueKey) {
      rowChanged = setRowValueByHeader_(row, indexes, 'Jira Issue Key', issueKey) || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Jira Issue URL', issueUrl || buildJiraBrowserUrl_(issueKey)) || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Jira Match Source', source || 'existing_key') || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Onboarding Complete', 'Yes') || rowChanged;
      rowChanged = setRowValueByHeader_(row, indexes, 'Last Checked', now) || rowChanged;

      if (canCheckJira) {
        const jiraMatch = jiraStatusLookup[issueKey] || emptyJiraMatch_();

        jiraCheckedRows += 1;
        rowChanged = setRowValueByHeader_(row, indexes, 'Jira Issue URL', issueUrl || jiraMatch.issueUrl) || rowChanged;
        rowChanged = setRowValueByHeader_(row, indexes, 'Jira Status', jiraMatch.status) || rowChanged;
        rowChanged = setRowValueByHeader_(row, indexes, 'Lead Status', jiraMatch.leadStatus) || rowChanged;
        rowChanged = setRowValueByHeader_(row, indexes, 'Last Jira Check', now) || rowChanged;
      }
    } else {
      rowChanged = setRowValueByHeader_(row, indexes, 'Onboarding Complete', 'No') || rowChanged;
    }

    if (rowChanged) {
      updatedRows += 1;
      changedItems.push(item);
    }
  });

  if (hasExplicitRows) {
    changedItems.forEach(function(item) {
      sheet.getRange(item.index + 2, 1, 1, headers.length).setValues([item.row]);
    });
  } else if (updatedRows) {
    sheet.getRange(startIndex + 2, 1, rowsToProcess.length, headers.length).setValues(rowsToProcess);
  }

  appendDebugLog_('JIRA_REFRESH_SUMMARY', 'updateEmailMatchesFromOnboardingAndJira_', 'Refreshed onboarding sheet matches and Jira statuses.', {
    updatedRows: updatedRows,
    matchedRows: matchedRows,
    jiraCheckedRows: jiraCheckedRows,
    jiraConfigured: canCheckJira,
    startIndex: startIndex,
    processedRows: rowsToProcess.length,
    totalRows: rowCount,
    explicitRows: hasExplicitRows
  });

  return {
    updatedRows: updatedRows,
    matchedRows: matchedRows,
    jiraCheckedRows: jiraCheckedRows,
    jiraConfigured: canCheckJira,
    startIndex: startIndex,
    processedRows: rowsToProcess.length,
    totalRows: rowCount,
    nextIndex: endIndex,
    done: hasExplicitRows ? true : endIndex >= rowCount
  };
}

function buildJiraRefreshCandidateIndexes_() {
  const sheet = getEmailMatchesSheet_();
  const headers = getSheetHeaders_(sheet);
  const lastRow = sheet.getLastRow();

  if (lastRow <= 1) {
    return {
      totalRows: 0,
      candidateIndexes: []
    };
  }

  const rowCount = lastRow - 1;
  const values = sheet.getRange(2, 1, rowCount, headers.length).getValues();
  const indexes = buildHeaderIndexMap_(headers);
  const onboardingLookup = loadOnboardingRequestsLookup_();
  const candidateIndexes = [];

  values.forEach(function(row, index) {
    const email = rowValueByHeader_(row, indexes, 'Contact Email');
    const name = rowValueByHeader_(row, indexes, 'Name');
    const lastName = rowValueByHeader_(row, indexes, 'Last Name');
    const existingKey = normalizeJiraIssueKey_(rowValueByHeader_(row, indexes, 'Jira Issue Key'));
    const onboardingResult = findOnboardingRequestForLead_(onboardingLookup, email, name, lastName);
    const onboardingMatch = onboardingResult.match;

    if (existingKey || onboardingMatch && onboardingMatch.jiraIssueKey) {
      candidateIndexes.push(index);
    }
  });

  appendDebugLog_('JIRA_REFRESH_CANDIDATES', 'buildJiraRefreshCandidateIndexes_', 'Prepared candidate rows for Jira refresh.', {
    totalRows: rowCount,
    candidateRows: candidateIndexes.length
  });

  return {
    totalRows: rowCount,
    candidateIndexes: candidateIndexes
  };
}

function collectJiraIssueKeysForRows_(rows, indexes, onboardingLookup) {
  const keys = [];

  (rows || []).forEach(function(row) {
    const email = rowValueByHeader_(row, indexes, 'Contact Email');
    const name = rowValueByHeader_(row, indexes, 'Name');
    const lastName = rowValueByHeader_(row, indexes, 'Last Name');
    const existingKey = normalizeJiraIssueKey_(rowValueByHeader_(row, indexes, 'Jira Issue Key'));
    const onboardingResult = findOnboardingRequestForLead_(onboardingLookup, email, name, lastName);
    const onboardingMatch = onboardingResult.match;

    keys.push(existingKey || onboardingMatch && onboardingMatch.jiraIssueKey);
  });

  return keys;
}

function updateEmailMatchManualJiraLink_(payload) {
  const data = payload || {};
  const messageId = normalizeValue_(data.messageId);
  const issueKey = normalizeJiraIssueKey_(data.issueKey);
  const issueUrl = normalizeJiraIssueUrl_(data.issueUrl, issueKey);

  if (!messageId) {
    throw new Error('Missing Gmail Message ID for Jira link update.');
  }

  if (!issueKey || !issueUrl) {
    throw new Error('Both Jira issue key and URL are required.');
  }

  const sheet = getEmailMatchesSheet_();
  const headers = getSheetHeaders_(sheet);
  const indexes = buildHeaderIndexMap_(headers);
  const messageIndex = indexes['Gmail Message ID'];
  const lastRow = sheet.getLastRow();

  if (messageIndex == null || messageIndex === -1 || lastRow <= 1) {
    throw new Error('Email Matches sheet cannot be updated because Gmail Message ID column is missing.');
  }

  const rowCount = lastRow - 1;
  const values = sheet.getRange(2, 1, rowCount, headers.length).getValues();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  let updated = false;

  values.forEach(function(row) {
    if (updated || normalizeValue_(row[messageIndex]) !== messageId) {
      return;
    }

    setRowValueByHeader_(row, indexes, 'Jira Issue Key', issueKey);
    setRowValueByHeader_(row, indexes, 'Jira Issue URL', issueUrl);
    setRowValueByHeader_(row, indexes, 'Jira Match Source', 'manual');
    setRowValueByHeader_(row, indexes, 'Onboarding Complete', 'Yes');
    setRowValueByHeader_(row, indexes, 'Last Checked', now);

    if (hasJiraScriptProperties_()) {
      const jiraMatch = safeGetJiraIssueStatusByKey_(issueKey);

      setRowValueByHeader_(row, indexes, 'Jira Status', jiraMatch.status);
      setRowValueByHeader_(row, indexes, 'Lead Status', jiraMatch.leadStatus);
      setRowValueByHeader_(row, indexes, 'Last Jira Check', now);
    }

    updated = true;
  });

  if (!updated) {
    throw new Error('Could not find lead row for Gmail Message ID: ' + messageId);
  }

  sheet.getRange(2, 1, rowCount, headers.length).setValues(values);
  appendDebugLog_('JIRA_MANUAL_LINK_UPDATED', 'updateEmailMatchManualJiraLink_', 'Manually updated Jira link for lead.', {
    messageId: messageId,
    issueKey: issueKey,
    issueUrl: issueUrl
  });

  return loadEmailMatchesFromSheet_();
}

function buildHeaderIndexMap_(headers) {
  return (headers || []).reduce(function(output, header, index) {
    output[header] = index;
    return output;
  }, {});
}

function rowValueByHeader_(row, indexes, header) {
  const index = indexes[header];

  return index == null || index === -1 ? '' : normalizeValue_(row[index]);
}

function setRowValueByHeader_(row, indexes, header, value) {
  const index = indexes[header];

  if (index == null || index === -1) {
    return false;
  }

  const normalized = value == null ? '' : value;

  if (row[index] === normalized) {
    return false;
  }

  row[index] = normalized;
  return true;
}

function buildSheetOnboardingLookup_(onboardingMatches) {
  const lookup = {};

  (onboardingMatches || []).forEach(function(match) {
    const key = normalizeValue_(match && match.email).toLowerCase();

    if (!key) {
      return;
    }

    if (!lookup[key]) {
      lookup[key] = {
        count: 0,
        latestAt: '',
        messageIds: [],
        seenIds: {}
      };
    }

    lookup[key].count += 1;

    if (match.countHint > lookup[key].count) {
      lookup[key].count = match.countHint;
    }

    if (match.date && (!lookup[key].latestAt || match.date > lookup[key].latestAt)) {
      lookup[key].latestAt = match.date;
    }

    if (match.messageId && !lookup[key].seenIds[match.messageId]) {
      lookup[key].seenIds[match.messageId] = true;
      lookup[key].messageIds.push(match.messageId);
    }
  });

  Object.keys(lookup).forEach(function(key) {
    delete lookup[key].seenIds;
  });

  return lookup;
}

function getExistingMessageIds_(sheet, headers) {
  const messageIdIndex = headers.indexOf('Gmail Message ID');
  const output = {};
  const lastRow = sheet.getLastRow();

  if (messageIdIndex === -1 || lastRow <= 1) {
    return output;
  }

  sheet.getRange(2, messageIdIndex + 1, lastRow - 1, 1).getValues().forEach(function(row) {
    const messageId = normalizeValue_(row[0]);

    if (messageId) {
      output[messageId] = true;
    }
  });

  return output;
}

function getSheetHeaders_(sheet) {
  const lastColumn = sheet.getLastColumn();

  if (!lastColumn) {
    const defaultHeaders = TRACKER_CONFIG.tableColumns.slice();

    sheet.getRange(1, 1, 1, defaultHeaders.length).setValues([defaultHeaders]);
    return defaultHeaders;
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(function(header) {
    return normalizeValue_(header);
  }).filter(Boolean);
  const missingHeaders = TRACKER_CONFIG.tableColumns.filter(function(header) {
    return headers.indexOf(header) === -1;
  });

  if (missingHeaders.length) {
    sheet.getRange(1, headers.length + 1, 1, missingHeaders.length).setValues([missingHeaders]);
    Array.prototype.push.apply(headers, missingHeaders);
  }

  return headers;
}

function hasAnyRowValue_(row) {
  return (row || []).some(function(value) {
    return normalizeValue_(value) !== '';
  });
}

function sanitizeSheetValue_(value, header) {
  if (value == null) {
    return '';
  }

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), header === 'Email Date' ? 'yyyy/MM/dd' : 'yyyy-MM-dd HH:mm');
  }

  if (header === 'Email Date') {
    return formatSheetEmailDate_(value);
  }

  return typeof value === 'string' ? cleanEmailTextArtifacts_(decodeHtmlEntities_(value)) : value;
}

function formatSheetEmailDate_(value) {
  const raw = normalizeValue_(value);
  const date = raw ? new Date(raw) : null;

  if (!date || isNaN(date.getTime())) {
    return raw;
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

function appendDebugLog_(eventName, functionName, message, details) {
  const sheet = getTrackerSpreadsheet_().getSheetByName(TRACKER_CONFIG.sheets.debugLog);

  if (!sheet) {
    return;
  }

  sheet.appendRow([
    new Date(),
    normalizeValue_(eventName),
    normalizeValue_(functionName),
    normalizeValue_(message),
    typeof details === 'string' ? details : JSON.stringify(details || {})
  ]);
}
