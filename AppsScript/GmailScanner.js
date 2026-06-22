function scanMarketingEmails_(options) {
  return scanMarketingEmailsWithOnboarding_(options).matches;
}

function scanMarketingEmailsWithOnboarding_(options) {
  const scanOptions = options || {};
  const accessToken = getDelegatedGmailAccessToken_(TRACKER_CONFIG.gmail.mailboxUser);
  const scanResult = listMatchingGmailMessagesForQueries_(accessToken, buildMarketingEmailQueries_(scanOptions), scanOptions);
  const onboardingResult = scanOnboardingNotices_(accessToken, scanOptions);
  const onboardingLookup = buildOnboardingLookup_(onboardingResult.matches);
  const messages = scanResult.messages;
  const stats = scanResult.stats;
  const acceptedMessages = [];
  const rejectedSamples = [];

  messages.forEach(function(message) {
    const fullMessage = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(TRACKER_CONFIG.gmail.mailboxUser) + '/messages/' + encodeURIComponent(message.id), {
      format: 'full'
    });
    const headers = buildHeaderMap_(fullMessage.payload && fullMessage.payload.headers);
    const bodyText = normalizeEmailBodyText_(extractMessageBodyText_(fullMessage.payload));

    if (!isLeadEmailMatch_(headers, bodyText)) {
      if (rejectedSamples.length < 8) {
        rejectedSamples.push(buildRejectedLeadSample_(fullMessage, headers, bodyText));
      }
      return;
    }

    const parsed = parseLeadBody_(headers, bodyText);
    const contactEmail = parsed.Email || '';
    const onboardingMatch = findOnboardingForLead_(parsed, onboardingLookup);
    const jiraMatch = contactEmail ? safeFindJiraOnboardingForContact_(contactEmail) : emptyJiraMatch_();
    const checkedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');

    acceptedMessages.push({
      values: {
        'Found At': checkedAt,
        'Email Date': formatEmailDate_(headers.Date),
        Name: parsed.Name || '',
        'Last Name': parsed['Last Name'] || '',
        'Contact Email': contactEmail,
        Phone: parsed.Phone || '',
        Address: parsed.Address || '',
        'Business Type': parsed['Business Type'] || '',
        'Company Name': parsed['Company Name'] || '',
        'Interested in': parsed['Interested in'] || '',
        Inquiry: parsed.Inquiry || '',
        Language: parsed.Language || '',
        Sender: headers.From || '',
        Subject: headers.Subject || '',
        'Extracted Content': buildExtractedContentSummary_(parsed),
        'Full Body': bodyText,
        'Gmail Message ID': fullMessage.id || '',
        'Gmail Thread ID': fullMessage.threadId || '',
        'Onboarding Sent': onboardingMatch.count ? String(onboardingMatch.count) : '',
        'Onboarding Sent At': onboardingMatch.latestAt || '',
        'Onboarding Message ID': onboardingMatch.messageIds.join(', '),
        'Jira Issue Key': jiraMatch.issueKey,
        'Jira Issue URL': jiraMatch.issueUrl,
        'Jira Match Source': jiraMatch.issueKey ? 'jira_search_fallback' : '',
        'Jira Status': jiraMatch.status,
        'Lead Status': jiraMatch.leadStatus,
        'Onboarding Complete': jiraMatch.onboardingComplete ? 'Yes' : 'No',
        'Onboarding Submitted At': '',
        'Onboarding Sheet Row': '',
        'Info Sheet': '',
        'Onboarding Doc': '',
        'Last Jira Check': checkedAt,
        Notes: '',
        'Last Checked': checkedAt
      }
    });
  });

  appendDebugLog_('GMAIL_SCAN_SUMMARY', 'scanMarketingEmails_', 'Scanned Gmail lead queries.', {
    mailbox: TRACKER_CONFIG.gmail.mailboxUser,
    scanMode: scanOptions.deepScan ? 'deep' : 'fast',
    queries: stats,
    onboardingQueries: onboardingResult.stats,
    onboardingMatches: onboardingResult.matches.length,
    uniqueCandidates: messages.length,
    accepted: acceptedMessages.length,
    rejectedSamples: rejectedSamples
  });

  return {
    matches: acceptedMessages,
    onboardingMatches: onboardingResult.matches
  };
}

function listMatchingGmailMessagesForQueries_(accessToken, queries, options) {
  const seenIds = {};
  const messages = [];
  const stats = [];

  (queries || []).forEach(function(query) {
    const queryResult = listMatchingGmailMessages_(accessToken, query, options);
    const queryMessages = queryResult.messages;

    stats.push({
      query: query,
      returned: queryMessages.length,
      pages: queryResult.pages,
      hitLimit: queryResult.hitLimit,
      hasMore: queryResult.hasMore
    });

    queryMessages.forEach(function(message) {
      const messageId = normalizeValue_(message && message.id);

      if (!messageId || seenIds[messageId]) {
        return;
      }

      seenIds[messageId] = true;
      messages.push(message);
    });
  });

  return {
    messages: messages,
    stats: stats
  };
}

function scanOnboardingNotices_(accessToken, options) {
  const scanOptions = options || {};
  const queryResult = listMatchingGmailMessagesForQueries_(accessToken, buildOnboardingEmailQueries_(scanOptions), scanOptions);
  const matches = [];

  queryResult.messages.forEach(function(message) {
    const fullMessage = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(TRACKER_CONFIG.gmail.mailboxUser) + '/messages/' + encodeURIComponent(message.id), {
      format: 'full'
    });
    const headers = buildHeaderMap_(fullMessage.payload && fullMessage.payload.headers);
    const bodyText = normalizeEmailBodyText_(extractMessageBodyText_(fullMessage.payload));

    if (!isOnboardingNoticeMatch_(headers, bodyText)) {
      return;
    }

    const parsed = parseOnboardingNoticeBody_(bodyText);

    matches.push({
      email: parsed.Email || '',
      name: parsed.Name || '',
      lastName: parsed['Last Name'] || '',
      phone: parsed.Phone || '',
      address: parsed.Address || '',
      company: parsed['Company Name'] || '',
      countHint: parsed.CountHint || 0,
      date: formatEmailDate_(headers.Date),
      messageId: fullMessage.id || '',
      threadId: fullMessage.threadId || '',
      subject: headers.Subject || ''
    });
  });

  appendDebugLog_('GMAIL_ONBOARDING_SCAN_SUMMARY', 'scanOnboardingNotices_', 'Scanned Gmail onboarding notices.', {
    mailbox: TRACKER_CONFIG.gmail.mailboxUser,
    scanMode: scanOptions.deepScan ? 'deep' : 'fast',
    queries: queryResult.stats,
    uniqueCandidates: queryResult.messages.length,
    accepted: matches.length
  });

  return {
    matches: matches,
    stats: queryResult.stats
  };
}

function listMatchingGmailMessages_(accessToken, query, options) {
  const messages = [];
  const scanOptions = options || {};
  const configuredMaxResults = scanOptions.deepScan
    ? TRACKER_CONFIG.gmail.deepScanMaxResults
    : TRACKER_CONFIG.gmail.maxResults;
  const maxResults = Math.max(1, Number(configuredMaxResults) || 500);
  const pageSize = Math.min(500, Math.max(1, Number(TRACKER_CONFIG.gmail.pageSize) || 100));
  let nextPageToken = '';
  let pages = 0;

  do {
    const response = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(TRACKER_CONFIG.gmail.mailboxUser) + '/messages', {
      q: query,
      maxResults: Math.min(pageSize, maxResults - messages.length),
      pageToken: nextPageToken
    });
    const pageMessages = response.messages || [];

    pages += 1;
    Array.prototype.push.apply(messages, pageMessages);
    nextPageToken = response.nextPageToken || '';
  } while (nextPageToken && messages.length < maxResults);

  return {
    messages: messages,
    pages: pages,
    hitLimit: messages.length >= maxResults,
    hasMore: Boolean(nextPageToken)
  };
}

function gmailApiFetch_(accessToken, path, params) {
  const queryString = buildQueryString_(params || {});
  const response = UrlFetchApp.fetch('https://gmail.googleapis.com' + path + queryString, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      Accept: 'application/json'
    },
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  const text = response.getContentText();

  if (status < 200 || status >= 300) {
    throw new Error('Gmail API request failed: ' + status + ' ' + text);
  }

  return text ? JSON.parse(text) : {};
}

function buildQueryString_(params) {
  const parts = [];

  Object.keys(params || {}).forEach(function(key) {
    const value = params[key];

    if (Array.isArray(value)) {
      value.forEach(function(item) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(item));
      });
      return;
    }

    if (value != null && value !== '') {
      parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
    }
  });

  return parts.length ? '?' + parts.join('&') : '';
}

function buildMarketingEmailQueries_(options) {
  const scanOptions = options || {};
  const queries = [
    TRACKER_CONFIG.gmail.defaultQuery,
    TRACKER_CONFIG.gmail.legacyQuery
  ].map(normalizeValue_).filter(Boolean);

  if (scanOptions.deepScan) {
    return queries.concat(TRACKER_CONFIG.gmail.deepQueries || []).map(normalizeValue_).filter(Boolean);
  }

  return queries.map(function(query) {
    return query + ' after:' + buildFastScanAfterDate_();
  });
}

function buildOnboardingEmailQueries_(options) {
  const scanOptions = options || {};
  const queries = [
    TRACKER_CONFIG.gmail.onboardingQuery,
    'in:anywhere subject:"Onboarding form sent"'
  ].map(normalizeValue_).filter(Boolean);

  if (scanOptions.deepScan) {
    return queries;
  }

  return queries.map(function(query) {
    return query + ' after:' + buildFastScanAfterDate_();
  });
}

function buildMarketingEmailQuery_(options) {
  return buildMarketingEmailQueries_(options).join(' OR ');
}

function buildFastScanAfterDate_() {
  const date = new Date();
  const months = Math.max(1, Number(TRACKER_CONFIG.gmail.fastScanMonths) || 3);

  date.setMonth(date.getMonth() - months);

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

function formatEmailDate_(value) {
  const raw = normalizeValue_(value);
  const date = raw ? new Date(raw) : null;

  if (!date || isNaN(date.getTime())) {
    return raw;
  }

  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy/MM/dd');
}

function buildHeaderMap_(headers) {
  return (headers || []).reduce(function(output, header) {
    output[header.name] = header.value;
    return output;
  }, {});
}

function buildRejectedLeadSample_(fullMessage, headers, bodyText) {
  return {
    messageId: fullMessage.id || '',
    date: headers.Date || '',
    from: headers.From || '',
    to: headers.To || '',
    deliveredTo: headers['Delivered-To'] || '',
    subject: headers.Subject || '',
    bodyStart: normalizeValue_(bodyText).substring(0, 120)
  };
}

function extractEmailAddress_(value) {
  const raw = normalizeValue_(value);
  const match = raw.match(/<([^>]+)>/);

  if (match && match[1]) {
    return match[1].trim();
  }

  return raw.indexOf('@') !== -1 ? raw : '';
}

function detectTopic_(subject) {
  const value = normalizeValue_(subject).toLowerCase();

  if (value.indexOf('onboarding') !== -1) {
    return 'Onboarding';
  }

  if (value.indexOf('contact') !== -1 || value.indexOf('lead') !== -1) {
    return 'Lead';
  }

  return '';
}

function isLeadEmailMatch_(headers, bodyText) {
  const mailbox = TRACKER_CONFIG.gmail.mailboxUser.toLowerCase();
  const sender = extractEmailAddress_(headers.From).toLowerCase();
  const recipient = [
    headers.To || '',
    headers.Cc || '',
    headers.Bcc || '',
    headers['Delivered-To'] || '',
    headers['X-Original-To'] || ''
  ].join(' ').toLowerCase();
  const subject = normalizeValue_(headers.Subject).toLowerCase();
  const normalizedBody = normalizeValue_(bodyText).toLowerCase();

  return (
      sender === mailbox ||
      normalizeValue_(headers.From).toLowerCase().indexOf(mailbox) !== -1
    ) &&
    (
      recipient.indexOf(mailbox) !== -1 ||
      subject === 'new contact'
    ) &&
    (
      isNewContactBodyStart_(normalizedBody) ||
      subject.indexOf('contact form (tlt-webpage-') === 0 ||
      isOldContactFormBody_(normalizedBody) ||
      (
        isLegacyWebformSubject_(headers.Subject) &&
        isLegacyWebformBody_(normalizedBody)
      )
    );
}

function isNewContactBodyStart_(normalizedBody) {
  const body = normalizeValue_(normalizedBody).toLowerCase();

  return body.indexOf('new contact') === 0 &&
    body.indexOf('onboarding sent') !== 0 &&
    body.indexOf('onboarding form sent') === -1;
}

function isOnboardingNoticeMatch_(headers, bodyText) {
  const subject = normalizeValue_(headers.Subject).toLowerCase();
  const body = normalizeValue_(bodyText).toLowerCase();

  return subject.indexOf('onboarding form sent') !== -1 ||
    body.indexOf('onboarding sent') === 0 ||
    (
      body.indexOf('onboarding sent') !== -1 &&
      body.indexOf("we've just received new contact form from") !== -1
    );
}

function isOldContactFormBody_(normalizedBody) {
  const body = normalizeValue_(normalizedBody).toLowerCase();

  return body.indexOf('first name') !== -1 &&
    body.indexOf('last name') !== -1 &&
    body.indexOf('preferred language') !== -1 &&
    body.indexOf('business type') !== -1 &&
    body.indexOf('interested in') !== -1;
}

function isLegacyWebformBody_(normalizedBody) {
  const body = normalizeValue_(normalizedBody).toLowerCase();

  return body.indexOf('interested in') !== -1 &&
    body.indexOf('name & surname') !== -1 &&
    body.indexOf('e-mail') !== -1 &&
    body.indexOf('message') !== -1;
}

function parseLeadBody_(headers, bodyText) {
  if (isLegacyWebformSubject_(headers.Subject) && isLegacyWebformBody_(bodyText)) {
    return parseLegacyWebformBody_(bodyText);
  }

  if (isOldContactFormSubject_(headers.Subject) || isOldContactFormBody_(bodyText)) {
    return parseOldContactFormBody_(bodyText);
  }

  return parseNewContactBody_(bodyText);
}

function isOldContactFormSubject_(subject) {
  return normalizeValue_(subject).toLowerCase().indexOf('contact form (tlt-webpage-') === 0;
}

function isLegacyWebformSubject_(subject) {
  return normalizeValue_(subject).toLowerCase().indexOf('form submission from:') === 0;
}

function parseNewContactBody_(bodyText) {
  const source = normalizeValue_(bodyText);

  return {
    Name: extractNewContactField_(source, 'Name', ['Last Name']),
    'Last Name': extractNewContactField_(source, 'Last Name', ['Email']),
    Email: extractNewContactField_(source, 'Email', ['Phone']),
    Phone: extractNewContactField_(source, 'Phone', ['Address']),
    Address: extractNewContactField_(source, 'Address', ['Busines Type', 'Business Type']),
    'Business Type': normalizeBusinessTypeValue_(extractNewContactField_(source, 'Busines Type', ['Company Name']) ||
      extractNewContactField_(source, 'Business Type', ['Company Name'])),
    'Company Name': extractNewContactField_(source, 'Company Name', ['Interested in']),
    'Interested in': normalizeInterestedInValue_(extractNewContactField_(source, 'Interested in', ['Inquiry'])),
    Inquiry: extractNewContactField_(source, 'Inquiry', ['Language']),
    Language: normalizeLanguageValue_(extractNewContactField_(source, 'Language', []))
  };
}

function parseLegacyWebformBody_(bodyText) {
  const source = normalizeValue_(bodyText);
  const fullName = extractNewContactField_(source, 'Name & Surname', ['E-mail']);
  const nameParts = splitFullName_(fullName);

  return {
    Name: nameParts.Name,
    'Last Name': nameParts['Last Name'],
    Email: extractNewContactField_(source, 'E-mail', ['Phone number', 'Address', 'Message']),
    Phone: extractNewContactField_(source, 'Phone number', ['Address', 'Message']),
    Address: extractNewContactField_(source, 'Address', ['Message']),
    'Business Type': '',
    'Company Name': '',
    'Interested in': normalizeInterestedInValue_(extractNewContactField_(source, 'Interested in', ['Name & Surname'])),
    Inquiry: extractNewContactField_(source, 'Message', ['Subscribe to our newsletter', 'I agree to the processing']),
    Language: ''
  };
}

function parseOnboardingNoticeBody_(bodyText) {
  const source = normalizeValue_(bodyText);

  return {
    Name: extractNewContactField_(source, 'Name', ['Last Name']),
    'Last Name': extractNewContactField_(source, 'Last Name', ['Email']),
    Email: extractNewContactField_(source, 'Email', ['Phone']),
    Phone: extractNewContactField_(source, 'Phone', ['Address']),
    Address: extractNewContactField_(source, 'Address', ['Busines Type', 'Business Type']),
    'Business Type': normalizeBusinessTypeValue_(extractNewContactField_(source, 'Busines Type', ['Company Name']) ||
      extractNewContactField_(source, 'Business Type', ['Company Name'])),
    'Company Name': extractNewContactField_(source, 'Company Name', ['Interested in']),
    'Interested in': normalizeInterestedInValue_(extractNewContactField_(source, 'Interested in', ['Inquiry'])),
    Inquiry: extractNewContactField_(source, 'Inquiry', ['Language']),
    Language: normalizeLanguageValue_(extractNewContactField_(source, 'Language', [])),
    CountHint: extractOnboardingCountHint_(source)
  };
}

function parseOldContactFormBody_(bodyText) {
  const source = normalizeValue_(bodyText);

  return {
    Name: extractNewContactField_(source, 'First Name', ['Last Name']),
    'Last Name': extractNewContactField_(source, 'Last Name', ['E-mail', 'Email']),
    Email: extractNewContactField_(source, 'E-mail', ['Phone Number']) ||
      extractNewContactField_(source, 'Email', ['Phone Number']),
    Phone: extractNewContactField_(source, 'Phone Number', ['Address']),
    Address: extractNewContactField_(source, 'Address', ['Preferred Language']),
    'Business Type': normalizeBusinessTypeValue_(extractNewContactField_(source, 'Business Type', ['Interested in'])),
    'Company Name': extractNewContactField_(source, 'Company Name', ['Business Type']),
    'Interested in': normalizeInterestedInValue_(extractNewContactField_(source, 'Interested in', ['Your inquiry', 'Your Inquiry'])),
    Inquiry: extractNewContactField_(source, 'Your inquiry', []) ||
      extractNewContactField_(source, 'Your Inquiry', []),
    Language: normalizeLanguageValue_(extractNewContactField_(source, 'Preferred Language', ['Company Name']))
  };
}

function extractOnboardingCountHint_(value) {
  const match = normalizeValue_(value).match(/ONBOARDING SENT\s+(\d+)\s+TIME/i);

  return match && match[1] ? Number(match[1]) || 0 : 0;
}

function splitFullName_(value) {
  const fullName = normalizeValue_(value);
  const parts = fullName.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      Name: fullName,
      'Last Name': ''
    };
  }

  return {
    Name: parts.shift(),
    'Last Name': parts.join(' ')
  };
}

function buildOnboardingLookup_(matches) {
  const lookup = {};

  (matches || []).forEach(function(match) {
    const key = buildEmailMatchKey_(match.email);

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

function findOnboardingForLead_(parsed, lookup) {
  const key = buildEmailMatchKey_(parsed && parsed.Email);

  return key && lookup[key] ? lookup[key] : {
    count: 0,
    latestAt: '',
    messageIds: []
  };
}

function buildEmailMatchKey_(email) {
  return normalizeValue_(email).toLowerCase();
}

function extractNewContactField_(source, label, nextLabels) {
  const escapedLabel = escapeRegExp_(label);
  const escapedNextLabels = (nextLabels || []).map(escapeRegExp_);
  const endPattern = escapedNextLabels.length
    ? '(?=\\s*(?:' + escapedNextLabels.join('|') + '):)'
    : '$';
  const pattern = new RegExp('(?:^|\\s)' + escapedLabel + ':\\s*([\\s\\S]*?)' + endPattern, 'i');
  const match = source.match(pattern);

  return match && match[1] ? normalizeValue_(match[1]) : '';
}

function escapeRegExp_(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeLanguageValue_(value) {
  const raw = normalizeValue_(value);

  if (!raw) {
    return '';
  }

  const firstTokenMatch = raw.match(/^([a-z]{2})(?:\b|[^a-z])/i);
  const firstToken = firstTokenMatch
    ? firstTokenMatch[1].toLowerCase()
    : normalizeValue_(raw.split(/\s+/)[0]).toLowerCase();
  const lowerRaw = raw.toLowerCase();

  if (firstToken === 'en' || lowerRaw.indexOf('english') === 0) {
    return 'English';
  }

  if (firstToken === 'es' || lowerRaw.indexOf('espanol') === 0 || lowerRaw.indexOf('espa\u00f1ol') === 0) {
    return 'Espa\u00f1ol';
  }

  if (firstToken === 'pt' || lowerRaw.indexOf('portugu') === 0) {
    return 'Portugu\u00eas';
  }

  return firstToken || raw;
}

function normalizeBusinessTypeValue_(value) {
  return normalizeOptionValue_(value, {
    game_provider: 'Game Provider',
    platform_operator: 'Platform Operator',
    affiliate: 'Affiliate',
    game_aggregator: 'Game Aggregator',
    other: 'Other'
  });
}

function normalizeInterestedInValue_(value) {
  return normalizeOptionListValue_(value, {
    game_aggregator: 'Game Aggregator',
    bonus_engine: 'Bonus Engine',
    bonus_engine_gamification: 'Bonus Engine',
    white_label: 'White Label',
    betexchange: 'BetExchange',
    bet_exchange: 'BetExchange',
    betting_exchange: 'BetExchange',
    beting_exchange: 'BetExchange',
    other: 'Other',
    ohter: 'Other'
  });
}

function normalizeOptionListValue_(value, options) {
  const raw = normalizeValue_(value);

  if (!raw) {
    return '';
  }

  return raw.split(',').map(function(item) {
    return normalizeOptionValue_(item, options);
  }).filter(Boolean).join(', ');
}

function normalizeOptionValue_(value, options) {
  const raw = normalizeValue_(value);

  if (!raw) {
    return '';
  }

  return options[buildOptionKey_(raw)] || raw;
}

function buildOptionKey_(value) {
  return normalizeValue_(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildExtractedContentSummary_(parsed) {
  return [
    parsed['Business Type'] ? 'Business Type: ' + parsed['Business Type'] : '',
    parsed['Interested in'] ? 'Interested in: ' + parsed['Interested in'] : '',
    parsed.Language ? 'Language: ' + parsed.Language : ''
  ].filter(Boolean).join(' | ');
}

function safeFindJiraOnboardingForContact_(contactEmail) {
  try {
    return findJiraOnboardingForContact_(contactEmail);
  } catch (error) {
    appendDebugLog_('JIRA_LOOKUP_SKIPPED', 'safeFindJiraOnboardingForContact_', error && error.message ? error.message : String(error), {
      contactEmail: contactEmail
    });
    return emptyJiraMatch_();
  }
}

function testLatestNewContactEmail_() {
  const mailbox = TRACKER_CONFIG.gmail.mailboxUser;
  const accessToken = getDelegatedGmailAccessToken_(mailbox);
  const query = 'from:' + mailbox + ' to:' + mailbox + ' subject:"New Contact"';

  try {
    const response = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(mailbox) + '/messages', {
      q: query,
      maxResults: 1
    });
    const message = response.messages && response.messages[0];

    if (!message) {
      const notFoundResult = {
        ok: true,
        accessOk: true,
        query: query,
        found: false,
        error: 'Mailbox access works, but no matching Gmail message was found.'
      };
      appendDebugLog_('GMAIL_NEW_CONTACT_TEST_NO_MATCH', 'testLatestNewContactEmail_', notFoundResult.error, notFoundResult);
      return notFoundResult;
    }

    const fullMessage = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(mailbox) + '/messages/' + encodeURIComponent(message.id), {
      format: 'full'
    });
    const headers = buildHeaderMap_(fullMessage.payload && fullMessage.payload.headers);
    const bodyText = normalizeEmailBodyText_(extractMessageBodyText_(fullMessage.payload));
    const bodyStart = bodyText.substring(0, 240);
    const result = {
      ok: true,
      accessOk: true,
      query: query,
      found: true,
      messageId: fullMessage.id || '',
      threadId: fullMessage.threadId || '',
      date: headers.Date || '',
      sender: headers.From || '',
      recipient: headers.To || '',
      subject: headers.Subject || '',
      bodyStartsWithNewContact: bodyText.indexOf('NEW CONTACT') === 0,
      bodyStart: bodyStart
    };

    appendDebugLog_('GMAIL_NEW_CONTACT_TEST_OK', 'testLatestNewContactEmail_', 'Checked latest New Contact message.', result);
    return result;
  } catch (error) {
    const failResult = {
      ok: false,
      accessOk: false,
      query: query,
      error: error && error.message ? error.message : String(error)
    };
    appendDebugLog_('GMAIL_NEW_CONTACT_TEST_ERROR', 'testLatestNewContactEmail_', failResult.error, failResult);
    return failResult;
  }
}

function testMarketingMailboxAccess_() {
  const mailbox = TRACKER_CONFIG.gmail.mailboxUser;
  const query = 'in:inbox';

  try {
    const accessToken = getDelegatedGmailAccessToken_(mailbox);
    const profile = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(mailbox) + '/profile');
    const listResponse = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(mailbox) + '/messages', {
      q: query,
      maxResults: 1
    });
    const message = listResponse.messages && listResponse.messages[0];
    let latest = null;

    if (message) {
      const fullMessage = gmailApiFetch_(accessToken, '/gmail/v1/users/' + encodeURIComponent(mailbox) + '/messages/' + encodeURIComponent(message.id), {
        format: 'full',
        metadataHeaders: ['From', 'To', 'Subject', 'Date']
      });
      const headers = buildHeaderMap_(fullMessage.payload && fullMessage.payload.headers);
      const bodyText = normalizeEmailBodyText_(extractMessageBodyText_(fullMessage.payload));

      latest = {
        messageId: fullMessage.id || '',
        threadId: fullMessage.threadId || '',
        date: headers.Date || '',
        sender: headers.From || '',
        recipient: headers.To || '',
        subject: headers.Subject || '',
        bodyStart: bodyText.substring(0, 240)
      };
    }

    const result = {
      ok: true,
      accessOk: true,
      mailbox: mailbox,
      profileEmail: profile.emailAddress || '',
      messagesTotal: profile.messagesTotal || 0,
      threadsTotal: profile.threadsTotal || 0,
      latestQuery: query,
      latest: latest
    };

    appendDebugLog_('GMAIL_ACCESS_TEST_OK', 'testMarketingMailboxAccess_', 'Marketing mailbox access works.', result);
    return result;
  } catch (error) {
    const failResult = {
      ok: false,
      accessOk: false,
      mailbox: mailbox,
      error: error && error.message ? error.message : String(error)
    };

    appendDebugLog_('GMAIL_ACCESS_TEST_ERROR', 'testMarketingMailboxAccess_', failResult.error, failResult);
    return failResult;
  }
}

function extractMessageBodyText_(payload) {
  if (!payload) {
    return '';
  }

  if (payload.body && payload.body.data) {
    return decodeGmailBase64_(payload.body.data);
  }

  return (payload.parts || []).map(function(part) {
    return extractMessageBodyText_(part);
  }).filter(Boolean).join('\n');
}

function decodeGmailBase64_(data) {
  const normalized = String(data || '').replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Utilities.base64Decode(normalized);

  return Utilities.newBlob(bytes).getDataAsString();
}

function normalizeEmailBodyText_(text) {
  return cleanEmailTextArtifacts_(decodeHtmlEntities_(String(text || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()));
}

function cleanEmailTextArtifacts_(value) {
  return String(value || '')
    .replace(/&#(?:x0*34f|0*847);/gi, ' ')
    .replace(/&#(?:x0*200b|0*8203);/gi, ' ')
    .replace(/&#(?:x0*200c|0*8204);/gi, ' ')
    .replace(/&#(?:x0*200d|0*8205);/gi, ' ')
    .replace(/&#(?:x0*feff|0*65279);/gi, ' ')
    .replace(/[\u034f\u200b-\u200d\ufeff]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities_(value) {
  return String(value || '')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, function(match, hex) {
      return htmlCodePointToString_(parseInt(hex, 16), match);
    })
    .replace(/&#(\d+);/g, function(match, decimal) {
      return htmlCodePointToString_(parseInt(decimal, 10), match);
    });
}

function htmlCodePointToString_(codePoint, fallback) {
  if (!isFinite(codePoint) || codePoint < 0) {
    return fallback || '';
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch (error) {
    return fallback || '';
  }
}
