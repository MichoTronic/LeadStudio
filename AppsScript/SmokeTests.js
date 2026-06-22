function runLeadStudioSmokeTests() {
  const results = [];

  recordSmokeTest_(results, 'parse current New Contact format', function() {
    const parsed = parseLeadBody_({
      Subject: 'New Contact'
    }, [
      'New Contact',
      'Name: Ana',
      'Last Name: Novak',
      'Email: ana@example.com',
      'Phone: +386 40 000 000',
      'Address: Ljubljana',
      'Busines Type: game_provider',
      'Company Name: Alpha Studio',
      'Interested in: game_aggregator, betexchange',
      'Inquiry: Hello there',
      'Language: en'
    ].join('\n'));

    assertSmokeEqual_(parsed.Name, 'Ana', 'Name');
    assertSmokeEqual_(parsed['Last Name'], 'Novak', 'Last Name');
    assertSmokeEqual_(parsed.Email, 'ana@example.com', 'Email');
    assertSmokeEqual_(parsed['Business Type'], 'Game Provider', 'Business Type');
    assertSmokeEqual_(parsed['Interested in'], 'Game Aggregator, BetExchange', 'Interested in');
    assertSmokeEqual_(parsed.Language, 'English', 'Language');
  });

  recordSmokeTest_(results, 'parse old Contact Form format', function() {
    const parsed = parseLeadBody_({
      Subject: 'Contact Form (TLT-Webpage-test)'
    }, [
      'First Name: Ivo',
      'Last Name: Horvat',
      'E-mail: ivo@example.com',
      'Phone Number: +385 1 000 000',
      'Address: Zagreb',
      'Preferred Language: English',
      'Company Name: Beta LTD',
      'Business Type: platform_operator',
      'Interested in: white_label',
      'Your inquiry: Old form body'
    ].join('\n'));

    assertSmokeEqual_(parsed.Name, 'Ivo', 'Name');
    assertSmokeEqual_(parsed.Email, 'ivo@example.com', 'Email');
    assertSmokeEqual_(parsed['Business Type'], 'Platform Operator', 'Business Type');
    assertSmokeEqual_(parsed['Interested in'], 'White Label', 'Interested in');
  });

  recordSmokeTest_(results, 'parse legacy webform format', function() {
    const parsed = parseLeadBody_({
      Subject: 'Form submission from: TLT'
    }, [
      'Interested in: Bonus Engine',
      'Name & Surname: Mia Kovac',
      'E-mail: mia@example.com',
      'Phone number: +386 31 111 111',
      'Address: Maribor',
      'Message: Legacy inquiry',
      'Subscribe to our newsletter: no'
    ].join('\n'));

    assertSmokeEqual_(parsed.Name, 'Mia', 'Name');
    assertSmokeEqual_(parsed['Last Name'], 'Kovac', 'Last Name');
    assertSmokeEqual_(parsed.Email, 'mia@example.com', 'Email');
    assertSmokeEqual_(parsed['Interested in'], 'Bonus Engine', 'Interested in');
  });

  recordSmokeTest_(results, 'map Jira statuses to lifecycle buckets', function() {
    assertSmokeEqual_(mapJiraStatusToLeadStatus_('01 NEW LEAD'), 'Lead', 'New lead map');
    assertSmokeEqual_(mapJiraStatusToLeadStatus_({ name: '02 Qualified Lead' }), 'Qualified Leads', 'Qualified map');
    assertSmokeEqual_(mapJiraStatusToLeadStatus_('06 Active'), 'Active', 'Active map');
    assertSmokeEqual_(mapJiraStatusToLeadStatus_('08 Customer Archive'), 'Not Active', 'Archive map');
  });

  recordSmokeTest_(results, 'date range matching boundaries', function() {
    const range = {
      from: '2026-06-16',
      to: '2026-06-22'
    };

    assertSmokeEqual_(matchesDateRangeForSmoke_('2026/06/16', range), true, 'From date inclusive');
    assertSmokeEqual_(matchesDateRangeForSmoke_('2026/06/22', range), true, 'To date inclusive');
    assertSmokeEqual_(matchesDateRangeForSmoke_('2026/06/15', range), false, 'Before range');
    assertSmokeEqual_(matchesDateRangeForSmoke_('2026/06/23', range), false, 'After range');
  });

  recordSmokeTest_(results, 'visible export row shaping', function() {
    const exportRows = buildExportRowsForSmoke_([
      {
        allValues: {
          'Email Date': '2026/06/22',
          'Company Name': 'Alpha Studio',
          'Contact Email': 'ana@example.com',
          'Jira Issue Key': 'SF-1',
          'Jira Issue URL': 'https://jira.example/browse/SF-1'
        }
      }
    ], ['Email Date', 'Company Name', 'Contact Email', 'Jira Issue Key']);

    assertSmokeEqual_(exportRows.headers.join('|'), 'Email Date|Company Name|Contact Email|Jira Issue Key|Jira Issue URL', 'Headers');
    assertSmokeEqual_(exportRows.rows[0][4], 'https://jira.example/browse/SF-1', 'Jira URL injected');
  });

  const failed = results.filter(function(result) {
    return !result.ok;
  });
  const summary = {
    ok: failed.length === 0,
    passed: results.length - failed.length,
    failed: failed.length,
    results: results
  };

  Logger.log(JSON.stringify(summary, null, 2));

  if (failed.length) {
    throw new Error('Lead Studio smoke tests failed: ' + failed.map(function(result) {
      return result.name + ' - ' + result.error;
    }).join('; '));
  }

  return summary;
}

function recordSmokeTest_(results, name, fn) {
  try {
    fn();
    results.push({
      name: name,
      ok: true
    });
  } catch (error) {
    results.push({
      name: name,
      ok: false,
      error: error && error.message ? error.message : String(error)
    });
  }
}

function assertSmokeEqual_(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(label + ': expected "' + expected + '", got "' + actual + '"');
  }
}

function matchesDateRangeForSmoke_(value, range) {
  const rowDate = parseSmokeDate_(String(value || '').replace(/\//g, '-'));

  if (!rowDate) {
    return false;
  }

  if (range.from) {
    const fromDate = parseSmokeDate_(range.from);

    if (fromDate && rowDate < fromDate) {
      return false;
    }
  }

  if (range.to) {
    const toDate = parseSmokeDate_(range.to);

    if (toDate) {
      toDate.setHours(23, 59, 59, 999);

      if (rowDate > toDate) {
        return false;
      }
    }
  }

  return true;
}

function parseSmokeDate_(value) {
  const parts = String(value || '').trim().split('-').map(Number);

  if (parts.length !== 3 || parts.some(function(part) {
    return !part;
  })) {
    return null;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  return isNaN(date.getTime()) ? null : date;
}

function buildExportRowsForSmoke_(rows, visibleHeaders) {
  const headers = visibleHeaders.slice();
  const jiraKeyIndex = headers.indexOf('Jira Issue Key');

  if (jiraKeyIndex !== -1 && headers.indexOf('Jira Issue URL') === -1) {
    headers.splice(jiraKeyIndex + 1, 0, 'Jira Issue URL');
  }

  return {
    headers: headers,
    rows: rows.map(function(entry) {
      const values = (entry && (entry.allValues || entry.values)) || {};

      return headers.map(function(header) {
        return values[header] || '';
      });
    })
  };
}
