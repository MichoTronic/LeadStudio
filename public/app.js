import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-functions.js";
import { firebaseConfig, leadStudioConfig } from "./config.js";

const backendApp = initializeApp(firebaseConfig, "lead-studio-backend");
const backendFunctions = getFunctions(backendApp, leadStudioConfig.functionRegion);
const action = httpsCallable(
  backendFunctions,
  leadStudioConfig.functionName
);
const writeAcceptanceAction = httpsCallable(
  backendFunctions,
  leadStudioConfig.writeAcceptanceFunctionName
);
const manualJiraAction = httpsCallable(
  backendFunctions,
  leadStudioConfig.manualJiraFunctionName
);
const previewDeployment = window.location.hostname.includes("--");
const authConfig = {
  clientId: previewDeployment ? "lead-studio-v4-test" : "lead-studio-v4",
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
  started: false,
  busy: false
};

const nodes = {
  authMessage: document.getElementById("auth-message"),
  authSignIn: document.getElementById("auth-signin-button"),
  authSignOut: document.getElementById("auth-signout-button"),
  topbarSignOut: document.getElementById("topbar-signout-button"),
  viewer: document.getElementById("viewer-label"),
  legacy: document.getElementById("legacy-link"),
  refresh: document.getElementById("refresh-button"),
  search: document.getElementById("search-input"),
  status: document.getElementById("status-filter"),
  onboarding: document.getElementById("onboarding-filter"),
  date: document.getElementById("date-filter"),
  clear: document.getElementById("clear-filters"),
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
nodes.date.addEventListener("change", applyFilters);
nodes.clear.addEventListener("click", clearFilters);
nodes.exportCsv.addEventListener("click", () => exportVisible("csv"));
nodes.exportXlsx.addEventListener("click", () => exportVisible("xlsx"));
nodes.dialogClose.addEventListener("click", () => nodes.dialog.close());
nodes.dialog.addEventListener("click", (event) => {
  if (event.target === nodes.dialog) nodes.dialog.close();
});
document.addEventListener("click", (event) => {
  if (nodes.exportMenu.open && !nodes.exportMenu.contains(event.target)) nodes.exportMenu.open = false;
});
nodes.legacy.href = leadStudioConfig.legacyUrl;
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
    refreshDryRun: () => callAction("refreshDryRun"),
    notesWriteAcceptance: runNotesWriteAcceptance,
    manualJiraRoundTrip: runManualJiraRoundTrip
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
    state.leads = Array.isArray(payload.leads) ? payload.leads : [];
    nodes.viewer.textContent = formatViewer(payload.authorization);
    populateStatusFilter();
    renderMetrics();
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

async function callAction(actionName) {
  const studioAuthToken = await state.authClient.refreshToken();
  if (!studioAuthToken) throw new Error("Timeless Studio authorization expired.");
  return action({ action: actionName, studioAuthToken });
}

async function runNotesWriteAcceptance(idempotencyKey = crypto.randomUUID().replaceAll("-", "")) {
  const studioAuthToken = await state.authClient.refreshToken();
  if (!studioAuthToken) throw new Error("Timeless Studio authorization expired.");
  const prepared = await writeAcceptanceAction({ action: "prepareNotesRoundTrip", studioAuthToken });
  return writeAcceptanceAction({
    action: "executeNotesRoundTrip",
    studioAuthToken,
    idempotencyKey,
    expectedVersion: prepared.data.acceptance.rowVersion
  });
}

async function runManualJiraRoundTrip(idempotencyKey = crypto.randomUUID().replaceAll("-", "")) {
  const studioAuthToken = await state.authClient.refreshToken();
  if (!studioAuthToken) throw new Error("Timeless Studio authorization expired.");
  const prepared = await manualJiraAction({ action: "prepareAcceptance", studioAuthToken });
  return manualJiraAction({
    action: "executeAcceptance",
    studioAuthToken,
    idempotencyKey,
    expectedVersion: prepared.data.manualJira.rowVersion
  });
}

function applyFilters() {
  const query = normalize(nodes.search.value);
  const status = normalize(nodes.status.value);
  const onboarding = nodes.onboarding.value;
  const days = Number(nodes.date.value || 0);
  const cutoff = days ? Date.now() - days * 86400000 : 0;

  state.visible = state.leads.filter((lead) => {
    const searchable = normalize([
      lead.name, lead.lastName, lead.contactEmail, lead.companyName,
      lead.businessType, lead.interestedIn, lead.targetRegion,
      lead.leadStatus, lead.jiraStatus, lead.jiraIssueKey
    ].join(" "));
    if (query && !searchable.includes(query)) return false;
    if (status && normalize(statusLabel(lead)) !== status) return false;
    const complete = isComplete(lead.onboardingComplete);
    if (onboarding === "complete" && !complete) return false;
    if (onboarding === "pending" && complete) return false;
    if (cutoff) {
      const date = parseLeadDate(lead.emailDate);
      if (!date || date.getTime() < cutoff) return false;
    }
    return true;
  });
  renderRows();
}

function populateStatusFilter() {
  const selected = nodes.status.value;
  const statuses = [...new Set(state.leads.map(statusLabel).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  nodes.status.replaceChildren(new Option("All statuses", ""));
  statuses.forEach((status) => nodes.status.add(new Option(status, normalize(status))));
  nodes.status.value = selected;
}

function renderMetrics() {
  const buckets = state.leads.map((lead) => statusLabel(lead));
  nodes.metricNew.textContent = String(state.leads.filter((lead, index) => buckets[index] === "Lead" && isLifecycleTracked(lead)).length);
  nodes.metricQualified.textContent = String(buckets.filter((status) => status === "Qualified Leads").length);
  nodes.metricActive.textContent = String(buckets.filter((status) => status === "Active").length);
  nodes.metricInactive.textContent = String(buckets.filter((status) => status === "Not Active").length);
  nodes.metricOnboarded.textContent = String(state.leads.filter((lead) => isComplete(lead.onboardingComplete)).length);
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
  window.lucide?.createIcons();
}

function renderTableRow(lead) {
  const row = document.createElement("tr");
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
  nodes.dialogContent.replaceChildren(...details.map(([label, value, url]) => detailNode(label, value, url)));
  if (leadStudioConfig.manualJiraEnabled) nodes.dialogContent.append(buildManualJiraEditor(lead));
  nodes.dialog.showModal();
}

function buildManualJiraEditor(lead) {
  const form = document.createElement("form");
  form.className = "manual-jira-form";
  const label = document.createElement("label");
  label.textContent = "Jira issue key";
  const input = document.createElement("input");
  input.name = "issueKey";
  input.required = true;
  input.placeholder = "SF-127";
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

function clearFilters() {
  nodes.search.value = "";
  nodes.status.value = "";
  nodes.onboarding.value = "";
  nodes.date.value = "";
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
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:"; } catch (_) { return false; }
}
function parseLeadDate(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = String(value).match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!match) return null;
  const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  return Number.isNaN(date.getTime()) ? null : date;
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
