function getJiraAuth_() {
  const sp = PropertiesService.getScriptProperties();
  const baseUrl = normalizeValue_(sp.getProperty(TRACKER_CONFIG.jira.baseUrlProperty)).replace(/\/+$/, '');
  const email = normalizeValue_(sp.getProperty(TRACKER_CONFIG.jira.emailProperty));
  const token = normalizeValue_(sp.getProperty(TRACKER_CONFIG.jira.tokenProperty));

  if (!baseUrl || !email || !token) {
    throw new Error('Missing Script Properties: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN');
  }

  const host = baseUrl.replace(/^https?:\/\//, '').split('/')[0];

  if (!/\.atlassian\.net$/i.test(host)) {
    throw new Error('JIRA_BASE_URL must be your *.atlassian.net site.');
  }

  return {
    baseUrl: baseUrl,
    headers: {
      Authorization: 'Basic ' + Utilities.base64Encode(email + ':' + token),
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }
  };
}

function jiraFetch_(path, options) {
  const auth = getJiraAuth_();
  const request = Object.assign({
    method: 'get',
    headers: auth.headers,
    muteHttpExceptions: true
  }, options || {});
  const response = UrlFetchApp.fetch(auth.baseUrl + path, request);
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Jira request failed: ' + status + ' ' + text);
  }

  return text ? JSON.parse(text) : {};
}

function jiraCheckConnection_() {
  const profile = jiraFetch_('/rest/api/3/myself');

  return {
    ok: true,
    accountId: profile.accountId || '',
    displayName: profile.displayName || '',
    emailAddress: profile.emailAddress || ''
  };
}

function findJiraOnboardingForContact_(contactEmail) {
  const email = normalizeValue_(contactEmail);

  if (!email) {
    return emptyJiraMatch_();
  }

  const jql = 'text ~ "' + email.replace(/"/g, '\\"') + '" ORDER BY updated DESC';
  const result = jiraFetch_('/rest/api/3/search/jql?maxResults=5&fields=summary,status&jql=' + encodeURIComponent(jql));
  const issues = result.issues || [];
  const firstIssue = issues[0];

  if (!firstIssue) {
    return emptyJiraMatch_();
  }

  return {
    issueKey: firstIssue.key || '',
    issueUrl: buildJiraBrowserUrl_(firstIssue.key || ''),
    status: firstIssue.fields && firstIssue.fields.status ? firstIssue.fields.status.name : '',
    leadStatus: mapJiraStatusToLeadStatus_(firstIssue.fields && firstIssue.fields.status),
    onboardingComplete: Boolean(firstIssue.key)
  };
}

function getJiraIssueStatusByKey_(issueKey) {
  const key = normalizeJiraIssueKey_(issueKey);

  if (!key) {
    return emptyJiraMatch_();
  }

  const issue = jiraFetch_('/rest/api/3/issue/' + encodeURIComponent(key) + '?fields=summary,status');
  const status = issue.fields && issue.fields.status;

  return {
    issueKey: issue.key || key,
    issueUrl: buildJiraBrowserUrl_(issue.key || key),
    status: status ? status.name : '',
    leadStatus: mapJiraStatusToLeadStatus_(status),
    onboardingComplete: Boolean(issue.key || key)
  };
}

function getJiraIssueStatusesByKeys_(issueKeys) {
  const keys = uniqueJiraIssueKeys_(issueKeys);

  if (!keys.length) {
    return {};
  }

  const jql = 'key in (' + keys.join(',') + ')';
  const result = jiraFetch_('/rest/api/3/search/jql?maxResults=' + keys.length + '&fields=summary,status&jql=' + encodeURIComponent(jql));
  const lookup = {};

  (result.issues || []).forEach(function(issue) {
    const key = normalizeJiraIssueKey_(issue && issue.key);
    const status = issue && issue.fields ? issue.fields.status : null;

    if (!key) {
      return;
    }

    lookup[key] = {
      issueKey: key,
      issueUrl: buildJiraBrowserUrl_(key),
      status: status ? status.name : '',
      leadStatus: mapJiraStatusToLeadStatus_(status),
      onboardingComplete: true
    };
  });

  return lookup;
}

function safeGetJiraIssueStatusesByKeys_(issueKeys) {
  const keys = uniqueJiraIssueKeys_(issueKeys);

  if (!keys.length) {
    return {};
  }

  try {
    return getJiraIssueStatusesByKeys_(keys);
  } catch (error) {
    appendDebugLog_('JIRA_BULK_STATUS_LOOKUP_SKIPPED', 'safeGetJiraIssueStatusesByKeys_', error && error.message ? error.message : String(error), {
      issueKeys: keys.join(', ')
    });
    return {};
  }
}

function safeGetJiraIssueStatusByKey_(issueKey) {
  try {
    return getJiraIssueStatusByKey_(issueKey);
  } catch (error) {
    appendDebugLog_('JIRA_STATUS_LOOKUP_SKIPPED', 'safeGetJiraIssueStatusByKey_', error && error.message ? error.message : String(error), {
      issueKey: issueKey
    });
    return emptyJiraMatch_();
  }
}

function hasJiraScriptProperties_() {
  const sp = PropertiesService.getScriptProperties();

  return Boolean(
    normalizeValue_(sp.getProperty(TRACKER_CONFIG.jira.baseUrlProperty)) &&
    normalizeValue_(sp.getProperty(TRACKER_CONFIG.jira.emailProperty)) &&
    normalizeValue_(sp.getProperty(TRACKER_CONFIG.jira.tokenProperty))
  );
}

function emptyJiraMatch_() {
  return {
    issueKey: '',
    issueUrl: '',
    status: '',
    leadStatus: '',
    onboardingComplete: false
  };
}

function mapJiraStatusToLeadStatus_(status) {
  const rawName = typeof status === 'string' ? status : status && status.name;
  const normalizedName = normalizeValue_(rawName).toLowerCase();

  return TRACKER_CONFIG.jira.statusMap[normalizedName] || '';
}

function normalizeJiraIssueKey_(value) {
  const raw = normalizeValue_(value).toUpperCase();
  const match = raw.match(/\b[A-Z][A-Z0-9]+-\d+\b/);

  return match ? match[0] : '';
}

function normalizeJiraIssueUrl_(value, issueKey) {
  const raw = normalizeValue_(value);

  if (raw) {
    return raw;
  }

  return buildJiraBrowserUrl_(issueKey);
}

function buildJiraBrowserUrl_(issueKey) {
  const key = normalizeJiraIssueKey_(issueKey);

  if (!key) {
    return '';
  }

  return TRACKER_CONFIG.jira.browserBaseUrl.replace(/\/+$/, '') + '/browse/' + key;
}

function uniqueJiraIssueKeys_(issueKeys) {
  const seen = {};

  return (issueKeys || []).reduce(function(output, issueKey) {
    const key = normalizeJiraIssueKey_(issueKey);

    if (!key || seen[key]) {
      return output;
    }

    seen[key] = true;
    output.push(key);
    return output;
  }, []);
}
