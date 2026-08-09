const form = document.getElementById("open-form");
const input = document.getElementById("maps-url");
const button = document.getElementById("open-button");
const statusPill = document.getElementById("status-pill");
const statusTitle = document.getElementById("status-title");
const statusMessage = document.getElementById("status-message");
const statusSummary = document.getElementById("status-summary");
const logsContainer = document.getElementById("logs");
const logCount = document.getElementById("log-count");
const refreshButton = document.getElementById("refresh-button");
const clearButton = document.getElementById("clear-button");

function isMapsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host === "google.com" || host.endsWith(".google.com") || host === "maps.app.goo.gl";
  } catch {
    return false;
  }
}

function stringifyDetails(details) {
  if (!details) return "";

  try {
    return ` ${JSON.stringify(details)}`;
  } catch {
    return ` ${String(details)}`;
  }
}

function formatLog(log) {
  const time = log?.capturedAt ? new Date(log.capturedAt).toLocaleTimeString() : "";
  const level = log?.level || "info";
  const message = log?.message || "Extension log";
  return `[${time}] ${level} ${message}${stringifyDetails(log?.details)}`;
}

function getDiagnosticSummary(diagnostics) {
  if (!diagnostics || typeof diagnostics !== "object" || Array.isArray(diagnostics)) return "";

  const parts = [];
  if (typeof diagnostics.page === "number") parts.push(`page ${diagnostics.page}`);
  if (typeof diagnostics.fetched === "number") parts.push(`${diagnostics.fetched} fetched`);
  if (typeof diagnostics.placeCount === "number") parts.push(`${diagnostics.placeCount} places`);
  if (typeof diagnostics.uniqueFeatureIdCount === "number") parts.push(`${diagnostics.uniqueFeatureIdCount} unique`);
  if (typeof diagnostics.duplicateFeatureIdCount === "number" && diagnostics.duplicateFeatureIdCount > 0) parts.push(`${diagnostics.duplicateFeatureIdCount} duplicates`);
  if (typeof diagnostics.total === "number") parts.push(`${diagnostics.total} total`);
  if (typeof diagnostics.pbLength === "number") parts.push(`pb ${diagnostics.pbLength}`);
  if (typeof diagnostics.listId === "string") parts.push(`list ${diagnostics.listId.slice(0, 8)}...`);

  return parts.join(" · ");
}

function getStatusTitle(status) {
  if (status === "loading") return "Importing";
  if (status === "payload") return "Ready";
  if (status === "error") return "Error";
  if (status === "no_places") return "No Places";
  if (status === "no_payload") return "Waiting";
  if (status === "connected") return "Connected";
  if (status === "reconnecting") return "Reconnecting";
  return "Idle";
}

function renderStatus(status) {
  const state = status?.status || "idle";
  statusPill.className = `status-pill ${state}`;
  statusTitle.textContent = getStatusTitle(state);
  statusMessage.textContent = status?.message || "Paste a Google Maps list URL to start.";
  statusSummary.textContent = getDiagnosticSummary(status?.diagnostics);
}

function renderLogs(logs) {
  const safeLogs = Array.isArray(logs) ? logs : [];
  logCount.textContent = `${safeLogs.length} log${safeLogs.length === 1 ? "" : "s"}`;

  if (safeLogs.length === 0) {
    logsContainer.innerHTML = '<div class="empty">No logs yet.</div>';
    return;
  }

  logsContainer.textContent = "";
  safeLogs.slice(-40).reverse().forEach((log) => {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    entry.textContent = formatLog(log);
    logsContainer.appendChild(entry);
  });
}

function refreshState() {
  chrome.runtime.sendMessage({ type: "GMAPLIST_GET_EXTENSION_STATE" }, (response) => {
    if (chrome.runtime.lastError) {
      renderStatus({
        status: "error",
        message: chrome.runtime.lastError.message,
      });
      return;
    }

    renderStatus(response?.status);
    renderLogs(response?.logs);
  });
}

function showLocalStatus(status, message, diagnostics) {
  renderStatus({
    status,
    message,
    diagnostics,
    capturedAt: Date.now(),
  });
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = input.value.trim();
  if (!url) {
    showLocalStatus("error", "Paste a Google Maps list URL first.");
    return;
  }

  if (!isMapsUrl(url)) {
    showLocalStatus("error", "Paste a google.com/maps or maps.app.goo.gl URL.");
    return;
  }

  button.disabled = true;
  showLocalStatus("loading", "Opening focused Maps tab...", { url });

  chrome.runtime.sendMessage({ type: "GMAPLIST_OPEN_MAPS_URL", url }, (response) => {
    const error = chrome.runtime.lastError?.message || response?.error;
    button.disabled = false;

    if (error || !response?.ok) {
      showLocalStatus("error", error || "Could not open that Maps URL.", { url });
      return;
    }

    showLocalStatus("loading", "Opened Maps. Waiting for Google list request...", { url });
    window.setTimeout(refreshState, 300);
  });
});

refreshButton.addEventListener("click", refreshState);

clearButton.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "GMAPLIST_CLEAR_DEBUG_LOGS" }, () => {
    window.setTimeout(refreshState, 150);
  });
});

refreshState();
window.setInterval(refreshState, 1000);
