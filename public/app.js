import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import { firebaseConfig, leadStudioConfig } from "./config.js?v=4.0.22";

const backendApp = initializeApp(firebaseConfig, "lead-studio-backend");
const backendFunctions = getFunctions(backendApp, leadStudioConfig.functionRegion);
const action = httpsCallable(
  backendFunctions,
  leadStudioConfig.functionName
);
const manualJiraAction = httpsCallable(
  backendFunctions,
  leadStudioConfig.manualJiraFunctionName
);
const authConfig = {
  clientId: "lead-studio-v4",
  studioId: "lead-studio",
  requiredScope: "read",
  authorizeUrl: "https://timeless-studio-auth.firebaseapp.com/authorize",
  redeemUrl: "https://europe-west1-timeless-studio-auth.cloudfunctions.net/redeemStudioAuthorizationCode",
  redirectUri: `${window.location.origin}/auth/callback`,
  verifierUrl: "https://europe-west1-timeless-studio-auth.cloudfunctions.net/verifyStudioAccess",
  authPopupUrl: "https://timeless-studio-auth.web.app/auth-popup.html",
  autoRedirect: true
};
const STATUS_MAP = Object.freeze({
  "01 new lead": "Lead",
  "02 qualified lead": "Qualified Leads",
  "06 active": "Active",
  "07 inactive": "Not Active",
  "08 customer archive": "Not Active"
});

const state = {
  authClient: null,
  authState: null,
  leads: [],
  visible: [],
  filters: {
    businessTypes: [],
    targetRegions: [],
    interests: []
  },
  sort: {
    field: "emailDate",
    direction: "desc"
  },
  started: false,
  busy: false,
  dialogRequestId: 0
};

const nodes = {
  authMessage: document.getElementById("auth-message"),
  authSignIn: document.getElementById("auth-signin-button"),
  authSignOut: document.getElementById("auth-signout-button"),
  topbarSignOut: document.getElementById("topbar-signout-button"),
  viewer: document.getElementById("viewer-label"),
  refresh: document.getElementById("refresh-button"),
  search: document.getElementById("search-input"),
  status: document.getElementById("status-filter"),
  onboarding: document.getElementById("onboarding-filter"),
  date: document.getElementById("date-filter"),
  dateFrom: document.getElementById("date-from-input"),
  dateTo: document.getElementById("date-to-input"),
  clear: document.getElementById("clear-filters"),
  businessOptions: document.getElementById("business-filter-options"),
  businessSummary: document.getElementById("business-filter-summary"),
  regionOptions: document.getElementById("region-filter-options"),
  regionSummary: document.getElementById("region-filter-summary"),
  interestOptions: document.getElementById("interest-filter-options"),
  interestSummary: document.getElementById("interest-filter-summary"),
  filterMenus: [...document.querySelectorAll(".filter-menu")],
  sortButtons: [...document.querySelectorAll("[data-sort-field]")],
  metricButtons: [...document.querySelectorAll("[data-metric-filter]")],
  exportMenu: document.getElementById("export-menu"),
  exportCsv: document.getElementById("export-csv-button"),
  exportXlsx: document.getElementById("export-xlsx-button"),
  count: document.getElementById("result-count"),
  table: document.getElementById("desktop-table"),
  tableBody: document.getElementById("lead-table-body"),
  mobileList: document.getElementById("mobile-list"),
  loading: document.getElementById("loading-state"),
  empty: document.getElementById("empty-state"),
  error: document.getElementById("error-banner"),
  metricAll: document.getElementById("metric-all"),
  metricNew: document.getElementById("metric-new"),
  metricQualified: document.getElementById("metric-qualified"),
  metricActive: document.getElementById("metric-active"),
  metricInactive: document.getElementById("metric-inactive"),
  metricOnboarded: document.getElementById("metric-onboarded"),
  dialog: document.getElementById("lead-dialog"),
  dialogTitle: document.getElementById("dialog-title"),
  dialogContent: document.getElementById("dialog-content"),
  dialogClose: document.getElementById("dialog-close")
};

nodes.authSignIn.addEventListener("click", () => state.authClient?.signIn());
nodes.authSignOut.addEventListener("click", signOut);
nodes.topbarSignOut.addEventListener("click", signOut);
nodes.refresh.addEventListener("click", loadLeads);
nodes.search.addEventListener("input", applyFilters);
nodes.status.addEventListener("change", applyFilters);
nodes.onboarding.addEventListener("change", applyFilters);
nodes.date.addEventListener("change", handleDatePresetChange);
nodes.dateFrom.addEventListener("change", handleCustomDateChange);
nodes.dateTo.addEventListener("change", handleCustomDateChange);
nodes.clear.addEventListener("click", clearFilters);
nodes.businessOptions.addEventListener("change", handleFacetChange);
nodes.regionOptions.addEventListener("change", handleFacetChange);
nodes.interestOptions.addEventListener("change", handleFacetChange);
nodes.sortButtons.forEach((button) => button.addEventListener("click", () => toggleSort(button.dataset.sortField)));
nodes.metricButtons.forEach((button) => button.addEventListener("click", () => applyMetricFilter(button.dataset.metricFilter)));
nodes.exportCsv.addEventListener("click", () => exportVisible("csv"));
nodes.exportXlsx.addEventListener("click", () => exportVisible("xlsx"));
nodes.dialogClose.addEventListener("click", closeContactDialog);
nodes.dialog.addEventListener("click", (event) => {
  if (event.target === nodes.dialog) closeContactDialog();
});
nodes.dialog.addEventListener("close", () => { state.dialogRequestId += 1; });
document.addEventListener("click", (event) => {
  if (nodes.exportMenu.open && !nodes.exportMenu.contains(event.target)) nodes.exportMenu.open = false;
  nodes.filterMenus.forEach((menu) => {
    if (menu.open && !menu.contains(event.target)) menu.open = false;
  });
});
Object.defineProperty(window, "__leadStudioDiagnostics", {
  value: Object.freeze({
    gmailProbe: () => callAction("gmailProbe"),
    gmailLeadParity: () => callAction("gmailLeadParity"),
    gmailDeepLeadParity: () => callAction("gmailDeepLeadParity"),
    gmailOnboardingParity: () => callAction("gmailOnboardingParity"),
    onboardingSheetProbe: () => callAction("onboardingSheetProbe"),
    onboardingSheetParity: () => callAction("onboardingSheetParity"),
    jiraProbe: () => callAction("jiraProbe"),
    jiraStatusParity: () => callAction("jiraStatusParity"),
    jiraDiscoveryParity: () => callAction("jiraDiscoveryParity"),
    jiraDirectLookupParity: () => callAction("jiraDirectLookupParity"),
    refreshDryRun: () => callAction("refreshDryRun")
  }),
  configurable: false,
  enumerable: false,
  writable: false
});
window.lucide?.createIcons();
startStudioAuth();

function startStudioAuth() {
  if (!window.TimelessStudioAuth?.createSsoBrokerClient) {
    setAuthMessage("Unable to load Timeless Studio authorization. Refresh and try again.");
    return;
  }
  state.authClient = window.TimelessStudioAuth.createSsoBrokerClient(authConfig);
  state.authClient.subscribe(handleAuthState);
  state.authClient.start();
}

function handleAuthState(nextState) {
  state.authState = nextState || {};
  if (state.authState.status === "checking") {
    setAuthMessage("Verifying access...");
    return;
  }
  cleanCallbackPath();
  if (state.authState.status === "authorized") {
    document.body.classList.remove("auth-locked");
    nodes.authSignOut.classList.remove("hidden");
    setAuthMessage("Access verified.");
    if (!state.started) loadLeads();
    return;
  }
  state.started = false;
  document.body.classList.add("auth-locked");
  nodes.authSignOut.classList.toggle("hidden", state.authState.status === "signed-out");
  if (state.authState.status === "denied") {
    setAuthMessage(state.authState.authorization?.message || "This account is not allowed.");
  } else if (state.authState.status === "error") {
    setAuthMessage(errorMessage(state.authState.error, "Authorization failed."));
  } else {
    setAuthMessage("Authorize with an approved Google account.");
  }
}

function cleanCallbackPath() {
  if (!window.location.hash && window.location.pathname === "/auth/callback") {
    window.history.replaceState({}, document.title, "/");
  }
}

async function loadLeads() {
  state.started = true;
  setBusy(true);
  showError("");
  try {
    const response = await callAction("bootstrap");
    const payload = response.data || {};
    state.leads = (Array.isArray(payload.leads) ? payload.leads : []).map(function (lead) {
      return {
        ...lead,
        interestedIn: window.LeadStudioList.canonicalInterestValue(lead.interestedIn),
        jiraIssueUrl: canonicalJiraUrl(lead.jiraIssueKey, lead.jiraIssueUrl)
      };
    });
    nodes.viewer.textContent = formatViewer(payload.authorization);
    populateStatusFilter();
    populateFacetFilters();
    applyFilters();
  } catch (error) {
    state.started = false;
    state.leads = [];
    state.visible = [];
    renderRows();
    showError(errorMessage(error, "Unable to load Lead Studio data."));
  } finally {
    setBusy(false);
  }
}

async function callAction(actionName, payload = {}) {
  const studioAuthToken = await state.authClient.refreshToken();
  if (!studioAuthToken) throw new Error("Timeless Studio authorization expired.");
  return action({ ...payload, action: actionName, studioAuthToken });
}

function applyFilters() {
  state.visible = window.LeadStudioList.filterAndSort(state.leads, currentFilterOptions());
  renderMetrics();
  renderRows();
}

function currentFilterOptions(overrides = {}) {
  return {
    query: nodes.search.value,
    status: nodes.status.value,
    onboarding: nodes.onboarding.value,
    days: nodes.date.value,
    fromDate: nodes.dateFrom.value,
    toDate: nodes.dateTo.value,
    businessTypes: state.filters.businessTypes,
    targetRegions: state.filters.targetRegions,
    interests: state.filters.interests,
    statusMap: STATUS_MAP,
    sort: state.sort,
    ...overrides
  };
}

function populateStatusFilter() {
  const selected = nodes.status.value;
  const statuses = [...new Set(state.leads.map(statusLabel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  nodes.status.replaceChildren(new Option("All statuses", ""));
  statuses.forEach((status) => nodes.status.add(new Option(status === "Lead" ? "New lead" : status, normalize(status))));
  nodes.status.value = selected;
}

function populateFacetFilters() {
  renderFacetOptions(nodes.businessOptions, window.LeadStudioList.facetValues(state.leads, "businessType"), "businessTypes");
  renderFacetOptions(nodes.regionOptions, window.LeadStudioList.facetValues(state.leads, "targetRegion"), "targetRegions");
  renderFacetOptions(nodes.interestOptions, window.LeadStudioList.interestOptions, "interests");
  syncFacetSummaries();
}

function renderFacetOptions(container, values, filterName) {
  const selected = new Set(state.filters[filterName].map(normalize));
  state.filters[filterName] = state.filters[filterName].filter((value) => values.some((option) => normalize(option) === normalize(value)));
  container.replaceChildren(...values.map((value) => {
    const label = document.createElement("label");
    label.className = "filter-option";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.dataset.filter = filterName;
    input.checked = selected.has(normalize(value));
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    return label;
  }));
}

function handleFacetChange(event) {
  const filterName = event.target?.dataset?.filter;
  if (!filterName || !Object.hasOwn(state.filters, filterName)) return;
  state.filters[filterName] = [...document.querySelectorAll(`input[data-filter="${filterName}"]:checked`)].map((input) => input.value);
  syncFacetSummaries();
  applyFilters();
}

function syncFacetSummaries() {
  nodes.businessSummary.textContent = facetSummary("Business type", state.filters.businessTypes);
  nodes.regionSummary.textContent = facetSummary("Target region", state.filters.targetRegions);
  nodes.interestSummary.textContent = facetSummary("Interested in", state.filters.interests);
}

function facetSummary(label, values) {
  return values.length ? `${label} (${values.length})` : label;
}

function renderMetrics() {
  const metricLeads = window.LeadStudioList.filterLeads(state.leads, currentFilterOptions({ status: "", onboarding: "" }));
  const buckets = metricLeads.map((lead) => statusLabel(lead));
  nodes.metricAll.textContent = String(metricLeads.length);
  nodes.metricNew.textContent = String(metricLeads.filter((lead, index) => buckets[index] === "Lead" && isLifecycleTracked(lead)).length);
  nodes.metricQualified.textContent = String(buckets.filter((status) => status === "Qualified Leads").length);
  nodes.metricActive.textContent = String(buckets.filter((status) => status === "Active").length);
  nodes.metricInactive.textContent = String(buckets.filter((status) => status === "Not Active").length);
  nodes.metricOnboarded.textContent = String(metricLeads.filter((lead) => isComplete(lead.onboardingComplete)).length);
  syncMetricState();
}

function applyMetricFilter(filter) {
  if (filter === "onboarded") {
    nodes.status.value = "";
    nodes.onboarding.value = "complete";
  } else {
    nodes.status.value = filter || "";
    nodes.onboarding.value = "";
  }
  applyFilters();
}

function syncMetricState() {
  const active = nodes.onboarding.value === "complete" && !nodes.status.value
    ? "onboarded"
    : nodes.status.value || (nodes.onboarding.value ? "__filtered" : "");
  nodes.metricButtons.forEach((button) => {
    const selected = button.dataset.metricFilter === active;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function toggleSort(field) {
  if (state.sort.field === field) state.sort.direction = state.sort.direction === "asc" ? "desc" : "asc";
  else {
    state.sort.field = field;
    state.sort.direction = field === "emailDate" ? "desc" : "asc";
  }
  applyFilters();
}

function syncSortState() {
  nodes.sortButtons.forEach((button) => {
    const field = button.dataset.sortField;
    const selected = field === state.sort.field;
    const header = button.closest("th");
    header.setAttribute("aria-sort", selected ? (state.sort.direction === "asc" ? "ascending" : "descending") : "none");
    const icon = document.createElement("i");
    icon.setAttribute("data-lucide", selected ? (state.sort.direction === "asc" ? "arrow-up" : "arrow-down") : "arrow-up-down");
    button.querySelector("i, svg")?.replaceWith(icon);
    button.classList.toggle("is-active", selected);
  });
}

function renderRows() {
  const count = state.visible.length;
  nodes.count.textContent = `${count} contact${count === 1 ? "" : "s"}`;
  nodes.tableBody.replaceChildren(...state.visible.map(renderTableRow));
  nodes.mobileList.replaceChildren(...state.visible.map(renderLeadCard));
  const hasRows = count > 0;
  nodes.table.hidden = !hasRows || state.busy;
  nodes.mobileList.hidden = !hasRows || state.busy;
  nodes.empty.hidden = hasRows || state.busy;
  syncSortState();
  window.lucide?.createIcons();
}

function renderTableRow(lead) {
  const row = document.createElement("tr");
  row.className = "lead-row";
  row.tabIndex = 0;
  row.append(
    cell(lead.emailDate || "-"),
    contactCell(lead),
    cell(lead.companyName || "-"),
    cell(lead.targetRegion || "-"),
    cell(lead.interestedIn || "-"),
    statusCell(statusLabel(lead)),
    jiraCell(lead),
    statusCell(isComplete(lead.onboardingComplete) ? "Complete" : "Pending", isComplete(lead.onboardingComplete) ? "success" : ""),
    detailButtonCell(lead)
  );
  row.addEventListener("click", (event) => {
    if (!event.target.closest("a, button")) openDetails(lead);
  });
  row.addEventListener("keydown", (event) => {
    if (event.target.closest("a, button")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDetails(lead);
    }
  });
  return row;
}

function renderLeadCard(lead) {
  const card = document.createElement("article");
  card.className = "lead-card";
  card.tabIndex = 0;
  card.innerHTML = `
    <div class="lead-card-top">
      <div><h2>${escapeHtml(fullName(lead) || lead.contactEmail || "Contact")}</h2><p>${escapeHtml(lead.companyName || lead.contactEmail || "-")}</p></div>
      ${statusMarkup(statusLabel(lead))}
    </div>
    <div class="lead-card-meta">
      <div><span>Date</span><strong>${escapeHtml(lead.emailDate || "-")}</strong></div>
      <div><span>Region</span><strong>${escapeHtml(lead.targetRegion || "-")}</strong></div>
      <div><span>Interest</span><strong>${escapeHtml(lead.interestedIn || "-")}</strong></div>
      <div><span>Onboarding</span><strong>${isComplete(lead.onboardingComplete) ? "Complete" : "Pending"}</strong></div>
    </div>`;
  card.addEventListener("click", () => openDetails(lead));
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openDetails(lead); }
  });
  return card;
}

function cell(value) {
  const td = document.createElement("td");
  td.textContent = value;
  return td;
}

function contactCell(lead) {
  const td = document.createElement("td");
  const name = document.createElement("span");
  const email = document.createElement("span");
  name.className = "contact-name";
  email.className = "contact-email";
  name.textContent = fullName(lead) || "Contact";
  email.textContent = lead.contactEmail || "-";
  td.append(name, email);
  return td;
}

function statusCell(value, type = "") {
  const td = document.createElement("td");
  const pill = document.createElement("span");
  pill.className = `status-pill${type ? ` is-${type}` : statusClass(value)}`;
  pill.textContent = value || "Unassigned";
  td.append(pill);
  return td;
}

function jiraCell(lead) {
  const td = document.createElement("td");
  if (safeHttpUrl(lead.jiraIssueUrl) && lead.jiraIssueKey) {
    const link = document.createElement("a");
    link.className = "jira-link";
    link.href = lead.jiraIssueUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = lead.jiraIssueKey;
    td.append(link);
  } else {
    td.textContent = lead.jiraIssueKey || "-";
  }
  return td;
}

function detailButtonCell(lead) {
  const td = document.createElement("td");
  const button = document.createElement("button");
  const status = document.createElement("p");
  button.type = "button";
  button.className = "icon-button row-button";
  button.title = "View contact";
  button.setAttribute("aria-label", "View contact");
  button.innerHTML = '<i data-lucide="chevron-right"></i>';
  button.addEventListener("click", () => openDetails(lead));
  td.append(button);
  return td;
}

function openDetails(lead) {
  const requestId = ++state.dialogRequestId;
  nodes.dialogTitle.textContent = fullName(lead) || lead.companyName || "Contact";
  const details = [
    ["Email", lead.contactEmail], ["Company", lead.companyName],
    ["Business type", lead.businessType], ["Interest", lead.interestedIn],
    ["Region", lead.targetRegion], ["Language", lead.language],
    ["Lead status", statusLabel(lead)], ["Jira status", lead.jiraStatus],
    ["Jira issue", lead.jiraIssueKey, lead.jiraIssueUrl],
    ["Onboarding", isComplete(lead.onboardingComplete) ? "Complete" : "Pending"],
    ["Onboarding sent", lead.onboardingSentAt || lead.onboardingSent],
    ["Submitted", lead.onboardingSubmittedAt], ["Last checked", lead.lastChecked]
  ];

  const tabs = buildDialogTabs();
  const layout = document.createElement("div");
  layout.className = "dialog-layout";

  const detailsPanel = document.createElement("section");
  detailsPanel.id = "contact-details-panel";
  detailsPanel.className = "dialog-panel contact-panel is-active";
  detailsPanel.dataset.dialogPanel = "details";
  detailsPanel.setAttribute("role", "tabpanel");
  detailsPanel.setAttribute("aria-labelledby", "contact-details-tab");
  const detailsGrid = document.createElement("div");
  detailsGrid.className = "contact-details-grid";
  detailsGrid.append(...details.map(([label, value, url]) => detailNode(label, value, url)));
  detailsGrid.append(detailTextNode("Inquiry", lead.inquiry));
  detailsPanel.append(detailsGrid);
  if (leadStudioConfig.manualJiraEnabled) detailsPanel.append(buildManualJiraEditor(lead));

  const activityPanel = document.createElement("section");
  activityPanel.id = "contact-conversation-panel";
  activityPanel.className = "dialog-panel activity-panel";
  activityPanel.dataset.dialogPanel = "conversation";
  activityPanel.setAttribute("role", "tabpanel");
  activityPanel.setAttribute("aria-labelledby", "contact-conversation-tab");
  renderActivityLoading(activityPanel);

  layout.append(detailsPanel, activityPanel);
  nodes.dialogContent.replaceChildren(tabs, layout);
  nodes.dialog.showModal();
  window.lucide?.createIcons();
  loadContactActivity(lead, requestId, activityPanel);
}

function closeContactDialog() {
  if (nodes.dialog.open) nodes.dialog.close();
}

function buildDialogTabs() {
  const tabs = document.createElement("div");
  tabs.className = "dialog-tabs";
  tabs.setAttribute("role", "tablist");
  [["details", "Details"], ["conversation", "Conversation"]].forEach(([key, label], index) => {
    const button = document.createElement("button");
    button.id = `contact-${key}-tab`;
    button.type = "button";
    button.className = `dialog-tab${index === 0 ? " is-active" : ""}`;
    button.dataset.dialogTab = key;
    button.setAttribute("role", "tab");
    button.setAttribute("aria-controls", `contact-${key}-panel`);
    button.setAttribute("aria-selected", String(index === 0));
    button.tabIndex = index === 0 ? 0 : -1;
    button.textContent = label;
    button.addEventListener("click", () => setDialogTab(key));
    tabs.append(button);
  });
  return tabs;
}

function setDialogTab(activeKey) {
  nodes.dialogContent.querySelectorAll("[data-dialog-tab]").forEach((tab) => {
    const active = tab.dataset.dialogTab === activeKey;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  nodes.dialogContent.querySelectorAll("[data-dialog-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.dialogPanel === activeKey);
  });
}

async function loadContactActivity(lead, requestId, panel) {
  renderActivityLoading(panel);
  try {
    const response = await callAction("contactActivity", { rowNumber: lead.rowNumber });
    if (requestId !== state.dialogRequestId || !nodes.dialog.open) return;
    renderContactActivity(panel, response.data?.contactActivity || {});
  } catch (error) {
    if (requestId !== state.dialogRequestId || !nodes.dialog.open) return;
    renderActivityError(panel, errorMessage(error, "Unable to load the Gmail conversation."), () => {
      loadContactActivity(lead, requestId, panel);
    });
  }
  window.lucide?.createIcons();
}

function renderActivityLoading(panel) {
  const stateNode = document.createElement("div");
  stateNode.className = "activity-state";
  const spinner = document.createElement("span");
  spinner.className = "spinner";
  spinner.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = "Loading conversation";
  stateNode.append(spinner, label);
  panel.replaceChildren(stateNode);
}

function renderActivityError(panel, message, retry) {
  const stateNode = document.createElement("div");
  stateNode.className = "activity-state is-error";
  const label = document.createElement("p");
  label.textContent = message;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "button button-secondary";
  button.innerHTML = '<i data-lucide="refresh-cw"></i><span>Retry</span>';
  button.addEventListener("click", retry);
  stateNode.append(label, button);
  panel.replaceChildren(stateNode);
}

function renderContactActivity(panel, activity) {
  const conversations = Array.isArray(activity.conversations) ? activity.conversations : [];
  const header = document.createElement("div");
  header.className = "activity-header";
  const heading = document.createElement("div");
  const eyebrow = document.createElement("span");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Gmail activity";
  const title = document.createElement("h3");
  title.textContent = "Conversation";
  const summary = document.createElement("p");
  summary.textContent = `${Number(activity.messageCount) || 0} messages across ${Number(activity.conversationCount) || 0} conversations`;
  heading.append(eyebrow, title, summary);
  header.append(heading);

  if (!conversations.length) {
    const empty = document.createElement("div");
    empty.className = "activity-state";
    empty.textContent = "No related Gmail conversation was found for this contact.";
    panel.replaceChildren(header, empty);
    return;
  }

  const list = document.createElement("div");
  list.className = "conversation-list";
  conversations.forEach((conversation, conversationIndex) => {
    list.append(buildConversation(conversation, conversationIndex));
  });
  panel.replaceChildren(header, list);

  if (activity.truncated) {
    const notice = document.createElement("p");
    notice.className = "activity-limit-note";
    notice.textContent = "Showing the most recent matching Gmail activity.";
    panel.append(notice);
  }
}

function buildConversation(conversation, conversationIndex) {
  const group = document.createElement("details");
  group.className = "conversation-group";
  group.open = conversationIndex === 0;
  const summary = document.createElement("summary");
  const copy = document.createElement("span");
  copy.className = "conversation-summary-copy";
  const label = document.createElement("span");
  label.className = `conversation-kind is-${["original", "onboarding"].includes(conversation.kind) ? conversation.kind : "related"}`;
  label.textContent = conversation.label || "Related email";
  const subject = document.createElement("strong");
  subject.textContent = conversation.subject || "Email conversation";
  const meta = document.createElement("span");
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  meta.textContent = `${formatActivityDate(conversation.latestAt)} | ${messages.length} message${messages.length === 1 ? "" : "s"}`;
  copy.append(label, subject, meta);
  const icon = document.createElement("i");
  icon.dataset.lucide = "chevron-down";
  summary.append(copy, icon);
  group.append(summary);

  const messageList = document.createElement("div");
  messageList.className = "message-list";
  messages.forEach((message, messageIndex) => {
    messageList.append(buildActivityMessage(message, conversationIndex === 0 && messageIndex === 0));
  });
  group.append(messageList);
  return group;
}

function buildActivityMessage(message, expanded) {
  const item = document.createElement("details");
  item.className = `message-item is-${activityDirection(message.direction)}`;
  item.open = expanded;
  const summary = document.createElement("summary");
  const direction = document.createElement("span");
  direction.className = "message-direction";
  const icon = document.createElement("i");
  icon.dataset.lucide = activityDirectionIcon(message.direction);
  const label = document.createElement("strong");
  label.textContent = message.directionLabel || "Related";
  direction.append(icon, label);
  const date = document.createElement("time");
  date.dateTime = message.date || "";
  date.textContent = formatActivityDate(message.date);
  const subject = document.createElement("strong");
  subject.className = "message-subject";
  subject.textContent = message.subject || "(no subject)";
  const excerpt = document.createElement("span");
  excerpt.className = "message-excerpt";
  excerpt.textContent = message.excerpt || "No plain-text content available.";
  direction.append(date);
  summary.append(direction, subject, excerpt);

  const body = document.createElement("div");
  body.className = "message-content";
  const metadata = document.createElement("dl");
  metadata.className = "message-metadata";
  [["From", message.from], ["To", message.to], ["Cc", message.cc], ["Bcc", message.bcc]].forEach(([term, value]) => {
    if (!value) return;
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = value;
    metadata.append(dt, dd);
  });
  const text = document.createElement("pre");
  text.className = "message-body";
  text.textContent = message.text || "No plain-text content available.";
  body.append(metadata, text);
  if (message.bodyTruncated) {
    const note = document.createElement("p");
    note.className = "activity-limit-note";
    note.textContent = "This message is longer than the activity preview.";
    body.append(note);
  }
  item.append(summary, body);
  return item;
}

function activityDirection(value) {
  return ["incoming", "outgoing", "forwarded"].includes(value) ? value : "related";
}

function activityDirectionIcon(value) {
  if (value === "incoming") return "arrow-down-left";
  if (value === "outgoing") return "arrow-up-right";
  if (value === "forwarded") return "forward";
  return "mail";
}

function formatActivityDate(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function buildManualJiraEditor(lead) {
  const form = document.createElement("form");
  form.className = "manual-jira-form";
  const label = document.createElement("label");
  label.textContent = "Jira issue key or URL";
  const input = document.createElement("input");
  input.name = "issueKey";
  input.required = true;
  input.placeholder = "SF-127 or https://jira.at.semper7.net/browse/SF-127";
  input.value = lead.jiraIssueKey || "";
  const button = document.createElement("button");
  button.type = "submit";
  button.className = "button button-primary";
  button.textContent = "Save Jira link";
  const status = document.createElement("p");
  status.className = "manual-jira-status";
  status.setAttribute("aria-live", "polite");
  label.append(input);
  form.append(label, button, status);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = "";
    try {
      await saveManualJiraLink(lead.rowNumber, input.value);
      nodes.dialog.close();
      await loadLeads();
    } catch (error) {
      status.textContent = errorMessage(error, "Unable to save the Jira link.");
      button.disabled = false;
    }
  });
  return form;
}

async function saveManualJiraLink(rowNumber, issueKey) {
  const studioAuthToken = await state.authClient.refreshToken();
  if (!studioAuthToken) throw new Error("Timeless Studio authorization expired.");
  const prepared = await manualJiraAction({
    action: "prepareManualJiraLink",
    studioAuthToken,
    rowNumber
  });
  return manualJiraAction({
    action: "saveManualJiraLink",
    studioAuthToken,
    rowNumber,
    issueKey,
    idempotencyKey: crypto.randomUUID().replaceAll("-", ""),
    expectedVersion: prepared.data.manualJira.rowVersion
  });
}

function detailNode(label, value, url) {
  const item = document.createElement("div");
  item.className = "detail";
  const caption = document.createElement("span");
  caption.textContent = label;
  const content = safeHttpUrl(url) ? document.createElement("a") : document.createElement("strong");
  content.textContent = value || "-";
  if (content instanceof HTMLAnchorElement) { content.href = url; content.target = "_blank"; content.rel = "noopener"; }
  item.append(caption, content);
  return item;
}

function detailTextNode(label, value) {
  const item = detailNode(label, value);
  item.classList.add("detail-wide");
  return item;
}

function clearFilters() {
  nodes.search.value = "";
  nodes.status.value = "";
  nodes.onboarding.value = "";
  nodes.date.value = "";
  nodes.dateFrom.value = "";
  nodes.dateTo.value = "";
  Object.keys(state.filters).forEach((key) => { state.filters[key] = []; });
  document.querySelectorAll(".filter-options input:checked").forEach((input) => { input.checked = false; });
  syncFacetSummaries();
  applyFilters();
}

function handleDatePresetChange() {
  if (nodes.date.value) {
    nodes.dateFrom.value = "";
    nodes.dateTo.value = "";
  }
  applyFilters();
}

function handleCustomDateChange() {
  if (nodes.dateFrom.value || nodes.dateTo.value) nodes.date.value = "";
  applyFilters();
}

function exportVisible(format) {
  const exporter = window.LeadStudioExport;
  if (!exporter || !state.visible.length) return;
  const exported = exporter.buildExportRows(state.visible);
  const blob = format === "xlsx"
    ? exporter.createXlsxBlob(exported.headers, exported.rows)
    : exporter.createCsvBlob(exported.headers, exported.rows);
  const filename = exporter.buildExportFilename(
    format,
    nodes.status.value ? nodes.status.selectedOptions[0]?.textContent : ""
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  nodes.exportMenu.open = false;
}

function setBusy(busy) {
  state.busy = busy;
  nodes.refresh.disabled = busy;
  nodes.refresh.classList.toggle("is-busy", busy);
  nodes.loading.hidden = !busy;
  if (!busy) renderRows();
}

function signOut() {
  state.started = false;
  state.authClient?.signOut();
}

function showError(message) {
  nodes.error.textContent = message;
  nodes.error.hidden = !message;
}

function setAuthMessage(message) { nodes.authMessage.textContent = message; }
function fullName(lead) { return [lead.name, lead.lastName].filter(Boolean).join(" "); }
function statusLabel(lead) { return lead.leadStatus || STATUS_MAP[normalize(lead.jiraStatus)] || "Lead"; }
function normalize(value) { return String(value || "").trim().toLowerCase(); }
function isComplete(value) { return ["y", "yes", "true", "complete", "completed"].includes(normalize(value)); }
function isLifecycleTracked(lead) { return Boolean(normalize(lead.jiraStatus) || normalize(lead.jiraIssueKey) || isComplete(lead.onboardingComplete)); }
function statusClass(value) {
  const status = normalize(value);
  if (["won", "complete", "completed", "qualified"].some((term) => status.includes(term))) return " is-success";
  if (["progress", "contacted", "review"].some((term) => status.includes(term))) return " is-info";
  return "";
}
function statusMarkup(value) { return `<span class="status-pill${statusClass(value)}">${escapeHtml(value || "Unassigned")}</span>`; }
function safeHttpUrl(value) {
  if (!value) return false;
  try { return new URL(value).protocol === "https:"; } catch (_) { return false; }
}

function canonicalJiraUrl(issueKey, fallback) {
  const key = String(issueKey || "").trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) return fallback || "";
  return `${leadStudioConfig.jiraBrowserBaseUrl}/browse/${key}`;
}
function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
function formatViewer(authorization) {
  const email = String(authorization?.email || "Authorized user");
  const role = String(authorization?.role || "");
  return role ? `${email} (${role})` : email;
}
function errorMessage(error, fallback) { return String(error?.message || fallback).replace(/^Firebase:\s*/i, ""); }
