(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.LeadStudioList = api;
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var INTEREST_OPTIONS = ["Game Aggregator", "Bonus Engine", "White Label", "BetExchange", "Other"];
  var INTEREST_PATTERNS = [
    [/\bgame\s*aggregat(?:or|ion)\b|\baggregator\b/i],
    [/\bbonus\s*engine\b|\bgamification\b/i],
    [/\bwhite\s*label\b|\bturn\s*key(?:\s+solution)?\b/i],
    [/\bbet\s*exchange\b|\bbetting\s*exchange\b|\bbetexchange\b/i],
    [/\bother\b|\bohter\b/i]
  ];

  function normalize(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function splitValues(value) {
    return String(value == null ? "" : value).split(",").map(function (item) {
      return item.trim();
    }).filter(Boolean);
  }

  function canonicalInterests(value) {
    var searchable = String(value == null ? "" : value)
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2");
    return INTEREST_OPTIONS.filter(function (_, index) {
      return INTEREST_PATTERNS[index].some(function (pattern) { return pattern.test(searchable); });
    });
  }

  function canonicalInterestValue(value) {
    return canonicalInterests(value).join(", ");
  }

  function parseLeadDate(value) {
    if (!value) return null;
    var direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) return direct;
    var match = String(value).match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (!match) return null;
    var date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function isComplete(value) {
    return ["y", "yes", "true", "complete", "completed"].includes(normalize(value));
  }

  function statusLabel(lead, statusMap) {
    statusMap = statusMap || {};
    return String(lead && lead.leadStatus || statusMap[normalize(lead && lead.jiraStatus)] || "Lead").trim();
  }

  function isLifecycleTracked(lead) {
    return Boolean(normalize(lead && lead.jiraStatus) || normalize(lead && lead.jiraIssueKey) || isComplete(lead && lead.onboardingComplete));
  }

  function matchesSelections(value, selections) {
    if (!Array.isArray(selections) || !selections.length) return true;
    var selected = new Set(selections.map(normalize));
    return splitValues(value).some(function (item) { return selected.has(normalize(item)); });
  }

  function filterLeads(leads, options) {
    options = options || {};
    var query = normalize(options.query);
    var status = normalize(options.status);
    var onboarding = normalize(options.onboarding);
    var fromDate = dateBoundary(options.fromDate, false);
    var toDate = dateBoundary(options.toDate, true);
    var days = fromDate || toDate ? 0 : Number(options.days) || 0;
    var now = Number(options.now) || Date.now();
    var cutoff = days ? now - days * 86400000 : 0;
    var statusMap = options.statusMap || {};

    return (Array.isArray(leads) ? leads : []).filter(function (lead) {
      var searchable = normalize([
        lead.name, lead.lastName, lead.contactEmail, lead.companyName,
        lead.businessType, lead.interestedIn, lead.targetRegion, lead.inquiry,
        lead.leadStatus, lead.jiraStatus, lead.jiraIssueKey
      ].join(" "));
      if (query && !searchable.includes(query)) return false;
      if (status && normalize(statusLabel(lead, statusMap)) !== status) return false;
      if (status === "lead" && !isLifecycleTracked(lead)) return false;
      var complete = isComplete(lead.onboardingComplete);
      if (onboarding === "complete" && !complete) return false;
      if (onboarding === "pending" && complete) return false;
      if (!matchesSelections(lead.businessType, options.businessTypes)) return false;
      if (!matchesSelections(lead.targetRegion, options.targetRegions)) return false;
      if (!matchesSelections(lead.interestedIn, options.interests)) return false;
      if (cutoff) {
        var date = parseLeadDate(lead.emailDate);
        if (!date || date.getTime() < cutoff) return false;
      }
      if (fromDate || toDate) {
        var customDate = parseLeadDate(lead.emailDate);
        if (!customDate) return false;
        var customTime = customDate.getTime();
        if (fromDate && customTime < fromDate) return false;
        if (toDate && customTime > toDate) return false;
      }
      return true;
    });
  }

  function dateBoundary(value, endOfDay) {
    var match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return 0;
    var date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    if (Number.isNaN(date.getTime())) return 0;
    if (endOfDay) date.setHours(23, 59, 59, 999);
    return date.getTime();
  }

  function sortLeads(leads, sort) {
    sort = sort || {};
    var field = sort.field === "companyName" ? "companyName" : "emailDate";
    var direction = sort.direction === "asc" ? 1 : -1;
    return (Array.isArray(leads) ? leads : []).slice().sort(function (left, right) {
      var leftValue = field === "emailDate" ? dateValue(left && left.emailDate) : normalize(left && left.companyName);
      var rightValue = field === "emailDate" ? dateValue(right && right.emailDate) : normalize(right && right.companyName);
      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return (Number(left && left.rowNumber) - Number(right && right.rowNumber)) * direction;
    });
  }

  function dateValue(value) {
    var parsed = parseLeadDate(value);
    return parsed ? parsed.getTime() : 0;
  }

  function filterAndSort(leads, options) {
    return sortLeads(filterLeads(leads, options), options && options.sort);
  }

  function facetValues(leads, field) {
    var values = new Map();
    (Array.isArray(leads) ? leads : []).forEach(function (lead) {
      splitValues(lead && lead[field]).forEach(function (value) {
        var key = normalize(value);
        if (key && !values.has(key)) values.set(key, value);
      });
    });
    return Array.from(values.values()).sort(function (left, right) { return left.localeCompare(right); });
  }

  return {
    canonicalInterestValue: canonicalInterestValue,
    canonicalInterests: canonicalInterests,
    facetValues: facetValues,
    filterAndSort: filterAndSort,
    filterLeads: filterLeads,
    isComplete: isComplete,
    isLifecycleTracked: isLifecycleTracked,
    interestOptions: INTEREST_OPTIONS.slice(),
    parseLeadDate: parseLeadDate,
    sortLeads: sortLeads,
    splitValues: splitValues,
    statusLabel: statusLabel
  };
}));
