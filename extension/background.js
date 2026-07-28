const CAPTURE_MESSAGE_TYPE = "GMAPLIST_EXTENSION_CAPTURE";
const APP_PORT_NAME = "gmaplists-app";
const RUNTIME_DATA_TYPE = "GMAPLIST_EXTENSION_DATA";
const RUNTIME_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";
const RUNTIME_LOG_TYPE = "GMAPLIST_EXTENSION_LOG";
const RUNTIME_LOGS_TYPE = "GMAPLIST_EXTENSION_LOGS";
const LATEST_PAYLOAD_KEY = "gmaplistsLatestPayload";
const LAST_REDIRECT_KEY = "gmaplistsLastRedirect";
const DEBUG_LOGS_KEY = "gmaplistsDebugLogs";
const MAX_DEBUG_LOGS = 200;

const appPorts = new Set();

function serializeDetails(details) {
  if (details == null) return undefined;

  try {
    return JSON.parse(JSON.stringify(details));
  } catch {
    return String(details);
  }
}

function broadcastToApps(message) {
  for (const port of appPorts) {
    try {
      port.postMessage(message);
    } catch {
      appPorts.delete(port);
    }
  }
}

function addDebugLog(level, message, details) {
  const entry = {
    level,
    message,
    details: serializeDetails(details),
    capturedAt: Date.now(),
  };

  chrome.storage.local.get(DEBUG_LOGS_KEY, (stored) => {
    const existing = Array.isArray(stored[DEBUG_LOGS_KEY]) ? stored[DEBUG_LOGS_KEY] : [];
    const logs = existing.concat(entry).slice(-MAX_DEBUG_LOGS);
    chrome.storage.local.set({ [DEBUG_LOGS_KEY]: logs }, () => {
      broadcastToApps({ type: RUNTIME_LOG_TYPE, entry });
    });
  });
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function extractListId(url) {
  const decodedUrl = safeDecode(url);
  const patterns = [
    /\/maps\/list\/([^/?#]+)/,
    /\/maps\/placelists\/list\/([^/?#]+)/,
    /\/local\/userlists\/list\/([^/?#]+)/,
    /!11m2!2s([^!?#&]+)!3e3/,
    /!2s([^!?#&]+)!3e3/,
  ];

  for (const pattern of patterns) {
    const match = decodedUrl.match(pattern);
    if (match?.[1]) return safeDecode(match[1]);
  }

  return null;
}

function broadcastToApp(payload) {
  broadcastToApps({ type: RUNTIME_DATA_TYPE, payload });
}

chrome.webRequest.onBeforeRedirect.addListener(
  (details) => {
    const redirectUrl = details.redirectUrl || "";
    if (!/^https:\/\/(www\.google\.com\/maps\/|maps\.google\.com\/)/.test(redirectUrl)) return;

    const listId = extractListId(redirectUrl);
    if (!listId) return;

    chrome.storage.local.set({
      [LAST_REDIRECT_KEY]: {
        listId,
        shortUrl: details.url,
        redirectUrl,
        capturedAt: Date.now(),
      },
    });

    addDebugLog("info", "Stored short URL redirect", { listId, redirectUrl });
    console.info("[GMapLists] stored short URL redirect", { listId, redirectUrl });
  },
  {
    urls: ["*://maps.app.goo.gl/*"],
  }
);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== APP_PORT_NAME) return;

  appPorts.add(port);
  addDebugLog("info", "App bridge connected", { portCount: appPorts.size });

  port.onDisconnect.addListener(() => {
    appPorts.delete(port);
    addDebugLog("info", "App bridge disconnected", { portCount: appPorts.size });
  });

  port.onMessage.addListener((message) => {
    if (message?.type === "GMAPLIST_GET_DEBUG_LOGS") {
      chrome.storage.local.get(DEBUG_LOGS_KEY, (stored) => {
        port.postMessage({
          type: RUNTIME_LOGS_TYPE,
          logs: Array.isArray(stored[DEBUG_LOGS_KEY]) ? stored[DEBUG_LOGS_KEY] : [],
        });
      });
      return;
    }

    if (message?.type !== "GMAPLIST_GET_LATEST_PAYLOAD") return;

    chrome.storage.local.get(LATEST_PAYLOAD_KEY, (stored) => {
      const payload = stored[LATEST_PAYLOAD_KEY];
      if (payload) {
        port.postMessage({ type: RUNTIME_DATA_TYPE, payload });
      } else {
        port.postMessage({
          type: RUNTIME_STATUS_TYPE,
          status: "no_payload",
          message: "Extension connected; no Maps payload captured yet.",
          capturedAt: Date.now(),
        });
      }
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === RUNTIME_LOG_TYPE && message.entry) {
    addDebugLog(
      message.entry.level || "info",
      message.entry.message || "Extension log",
      message.entry.details
    );
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type !== CAPTURE_MESSAGE_TYPE || !message.payload?.data) {
    return false;
  }

  chrome.storage.local.set({ [LATEST_PAYLOAD_KEY]: message.payload }, () => {
    addDebugLog("info", "Stored captured payload", message.payload.diagnostics);
    console.info("[GMapLists] stored captured payload", message.payload.diagnostics);
    broadcastToApp(message.payload);
    sendResponse({ ok: true });
  });

  return true;
});
