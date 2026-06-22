const TRACKER_CONFIG = Object.freeze({
  appName: 'Lead Studio',
  spreadsheetId: '1M5U5kq_s8Yf1iRgv3goChXUkqLfRSwJLDrXrApjXjx4',
  driveFolderId: '1gnvbM3Tt75DtFg3onFp2tMURUGS9kZ60',
  sheets: Object.freeze({
    emailMatches: 'Email Matches',
    trackerConfig: 'Tracker Config',
    jiraCache: 'Jira Cache',
    debugLog: 'Debug Log'
  }),
  jira: Object.freeze({
    baseUrlProperty: 'JIRA_BASE_URL',
    emailProperty: 'JIRA_EMAIL',
    tokenProperty: 'JIRA_API_TOKEN',
    projectKey: 'SF',
    browserBaseUrl: 'https://jira.at.semper7.net',
    statusMap: Object.freeze({
      '01 new lead': 'Lead',
      '02 qualified lead': 'Qualified Leads',
      '06 active': 'Active',
      '07 inactive': 'Not Active',
      '08 customer archive': 'Not Active'
    })
  }),
  onboardingSheet: Object.freeze({
    spreadsheetId: '1Ev6nu3bp1Hjh86vB0YY-qvq9DjQh_IZzD5czBjMrtM0',
    sheetName: 'OnboardingRequests',
    columns: Object.freeze({
      timestamp: 'Timestamp',
      companyName: 'Company Name',
      clientOperatorName: 'Client / Operator Name',
      targetRegion: 'Operating Markets',
      responsiblePerson: 'Responsible Person',
      emailAddress: 'Email Address',
      jiraIssueKey: 'JIRA task ID',
      driveFolderUrl: 'Google Drive Folder URL',
      infoSheetUrl: 'Info Sheet',
      onboardingDocUrl: 'Onboarding Doc',
      jiraIssueUrl: 'JIRA task URL'
    })
  }),
  gmail: Object.freeze({
    mailboxUser: 'marketing@timelesstech.io',
    serviceAccountJsonFileId: '1yAOLGYJPmb0qOtPofiRsl014KpuacWOE',
    pageSize: 100,
    maxResults: 500,
    deepScanMaxResults: 5000,
    fastScanMonths: 3,
    defaultQuery: 'in:anywhere subject:"New Contact"',
    legacyQuery: 'in:anywhere subject:"Contact Form"',
    onboardingQuery: 'in:anywhere "ONBOARDING SENT"',
    deepQueries: Object.freeze([
      'in:anywhere subject:"Form submission from:"',
      'in:anywhere "New Contact" "Company Name" "Interested in"',
      'in:anywhere "First Name" "Last Name" "Preferred Language"',
      'in:anywhere "Your inquiry" "Business Type" "Interested in"',
      'in:anywhere "Name & Surname" "E-mail" "Interested in"'
    ])
  }),
  options: Object.freeze({
    targetRegions: Object.freeze([
      'ROW',
      'Asia',
      'LATAM'
    ]),
    businessTypes: Object.freeze([
      'Game Provider',
      'Platform Operator',
      'Affiliate',
      'Game Aggregator',
      'Other'
    ]),
    interestedIn: Object.freeze([
      'Game Aggregator',
      'Bonus Engine',
      'White Label',
      'BetExchange',
      'Other'
    ])
  }),
  tableColumns: Object.freeze([
    'Found At',
    'Email Date',
    'Name',
    'Last Name',
    'Contact Email',
    'Target Region',
    'Phone',
    'Address',
    'Business Type',
    'Company Name',
    'Interested in',
    'Inquiry',
    'Language',
    'Subject',
    'Sender',
    'Extracted Content',
    'Full Body',
    'Gmail Message ID',
    'Gmail Thread ID',
    'Onboarding Sent',
    'Onboarding Sent At',
    'Onboarding Message ID',
    'Jira Issue Key',
    'Jira Issue URL',
    'Jira Match Source',
    'Jira Status',
    'Lead Status',
    'Onboarding Complete',
    'Onboarding Submitted At',
    'Onboarding Sheet Row',
    'Info Sheet',
    'Onboarding Doc',
    'Last Jira Check',
    'Notes',
    'Last Checked'
  ]),
  uiTableColumns: Object.freeze([
    'Email Date',
    'Company Name',
    'Name',
    'Last Name',
    'Contact Email',
    'Target Region',
    'Business Type',
    'Interested in',
    'Language',
    'Jira Issue Key',
    'Jira Status',
    'Onboarding Complete',
    'Last Checked'
  ])
});

function getTrackerPublicConfig_() {
  return {
    appName: TRACKER_CONFIG.appName,
    spreadsheetId: TRACKER_CONFIG.spreadsheetId,
    gmail: {
      mailboxUser: TRACKER_CONFIG.gmail.mailboxUser,
      pageSize: TRACKER_CONFIG.gmail.pageSize,
      maxResults: TRACKER_CONFIG.gmail.maxResults,
      deepScanMaxResults: TRACKER_CONFIG.gmail.deepScanMaxResults,
      fastScanMonths: TRACKER_CONFIG.gmail.fastScanMonths,
      defaultQuery: TRACKER_CONFIG.gmail.defaultQuery,
      legacyQuery: TRACKER_CONFIG.gmail.legacyQuery,
      onboardingQuery: TRACKER_CONFIG.gmail.onboardingQuery,
      deepQueries: TRACKER_CONFIG.gmail.deepQueries.slice()
    },
    jira: {
      projectKey: TRACKER_CONFIG.jira.projectKey,
      browserBaseUrl: TRACKER_CONFIG.jira.browserBaseUrl
    },
    onboardingSheet: {
      spreadsheetId: TRACKER_CONFIG.onboardingSheet.spreadsheetId,
      sheetName: TRACKER_CONFIG.onboardingSheet.sheetName
    },
    options: {
      targetRegions: TRACKER_CONFIG.options.targetRegions.slice(),
      businessTypes: TRACKER_CONFIG.options.businessTypes.slice(),
      interestedIn: TRACKER_CONFIG.options.interestedIn.slice()
    },
    tableColumns: TRACKER_CONFIG.tableColumns.slice(),
    uiTableColumns: TRACKER_CONFIG.uiTableColumns.slice()
  };
}

function getRequiredPropertyStatus_() {
  const sp = PropertiesService.getScriptProperties();
  const names = [
    TRACKER_CONFIG.jira.baseUrlProperty,
    TRACKER_CONFIG.jira.emailProperty,
    TRACKER_CONFIG.jira.tokenProperty
  ];

  return names.map(function(name) {
    return {
      name: name,
      configured: Boolean(sp.getProperty(name))
    };
  });
}

function normalizeValue_(value) {
  return String(value == null ? '' : value).trim();
}
