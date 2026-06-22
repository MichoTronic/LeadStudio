function getOnboardingRequestsSheet_() {
  const spreadsheet = SpreadsheetApp.openById(TRACKER_CONFIG.onboardingSheet.spreadsheetId);
  const sheet = spreadsheet.getSheetByName(TRACKER_CONFIG.onboardingSheet.sheetName);

  if (!sheet) {
    throw new Error('Missing onboarding sheet: ' + TRACKER_CONFIG.onboardingSheet.sheetName);
  }

  return sheet;
}

function loadOnboardingRequestsLookup_() {
  const sheet = getOnboardingRequestsSheet_();
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const lookup = {
    byEmail: {},
    byResponsiblePerson: {}
  };

  if (lastRow <= 1 || !lastColumn) {
    return lookup;
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(normalizeValue_);
  const columnMap = headers.reduce(function(output, header, index) {
    if (header) {
      output[header] = index;
    }
    return output;
  }, {});

  values.slice(1).forEach(function(row, rowIndex) {
    const match = buildOnboardingRequestMatch_(row, columnMap, rowIndex + 2);
    const emailKey = buildEmailMatchKey_(match.email);
    const responsiblePersonKey = buildPersonNameMatchKey_(match.responsiblePerson);

    if (!match.jiraIssueKey) {
      return;
    }

    if (emailKey && (!lookup.byEmail[emailKey] || compareOnboardingMatches_(match, lookup.byEmail[emailKey]) > 0)) {
      lookup.byEmail[emailKey] = match;
    }

    if (responsiblePersonKey && (!lookup.byResponsiblePerson[responsiblePersonKey] || compareOnboardingMatches_(match, lookup.byResponsiblePerson[responsiblePersonKey]) > 0)) {
      lookup.byResponsiblePerson[responsiblePersonKey] = match;
    }
  });

  return lookup;
}

function buildOnboardingRequestMatch_(row, columnMap, sheetRowNumber) {
  const columns = TRACKER_CONFIG.onboardingSheet.columns;
  const jiraIssueKey = normalizeJiraIssueKey_(getMappedRowValue_(row, columnMap, columns.jiraIssueKey));

  return {
    rowNumber: sheetRowNumber,
    submittedAt: formatOnboardingTimestamp_(getMappedRowValue_(row, columnMap, columns.timestamp)),
    companyName: getMappedRowValue_(row, columnMap, columns.companyName),
    clientOperatorName: getMappedRowValue_(row, columnMap, columns.clientOperatorName),
    targetRegion: normalizeTargetRegionValue_(getMappedRowValue_(row, columnMap, columns.targetRegion)),
    responsiblePerson: getMappedRowValue_(row, columnMap, columns.responsiblePerson),
    email: getMappedRowValue_(row, columnMap, columns.emailAddress),
    jiraIssueKey: jiraIssueKey,
    jiraIssueUrl: normalizeJiraIssueUrl_(getMappedRowValue_(row, columnMap, columns.jiraIssueUrl), jiraIssueKey),
    driveFolderUrl: getMappedRowValue_(row, columnMap, columns.driveFolderUrl),
    infoSheetUrl: getMappedRowValue_(row, columnMap, columns.infoSheetUrl),
    onboardingDocUrl: getMappedRowValue_(row, columnMap, columns.onboardingDocUrl)
  };
}

function getMappedRowValue_(row, columnMap, headerName) {
  const index = columnMap[headerName];

  if (index == null || index === -1) {
    return '';
  }

  return normalizeValue_(row[index]);
}

function compareOnboardingMatches_(left, right) {
  const leftTime = parseComparableDate_(left && left.submittedAt);
  const rightTime = parseComparableDate_(right && right.submittedAt);

  if (leftTime !== rightTime) {
    return leftTime - rightTime;
  }

  return Number(left && left.rowNumber) - Number(right && right.rowNumber);
}

function parseComparableDate_(value) {
  const raw = normalizeValue_(value);
  const date = raw ? new Date(raw) : null;

  return date && !isNaN(date.getTime()) ? date.getTime() : 0;
}

function formatOnboardingTimestamp_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  }

  return normalizeValue_(value);
}

function findOnboardingRequestForLead_(lookup, email, name, lastName) {
  const safeLookup = lookup || {};
  const byEmail = safeLookup.byEmail || {};
  const byResponsiblePerson = safeLookup.byResponsiblePerson || {};
  const emailKey = buildEmailMatchKey_(email);
  const nameKey = buildPersonNameMatchKey_([name, lastName].filter(Boolean).join(' '));

  if (emailKey && byEmail[emailKey]) {
    return {
      match: byEmail[emailKey],
      source: 'auto_onboarding_sheet'
    };
  }

  if (nameKey && byResponsiblePerson[nameKey]) {
    return {
      match: byResponsiblePerson[nameKey],
      source: 'auto_onboarding_responsible_person'
    };
  }

  return {
    match: null,
    source: ''
  };
}

function buildPersonNameMatchKey_(value) {
  return normalizeValue_(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTargetRegionValue_(value) {
  const allowed = TRACKER_CONFIG.options.targetRegions || [];
  const rawParts = normalizeValue_(value).split(',');
  const seen = {};

  return rawParts.map(function(part) {
    const normalized = normalizeValue_(part).toLowerCase();
    const match = allowed.filter(function(option) {
      return option.toLowerCase() === normalized;
    })[0] || '';

    if (!match || seen[match]) {
      return '';
    }

    seen[match] = true;
    return match;
  }).filter(Boolean).join(', ');
}
