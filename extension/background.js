const CAPTURE_MESSAGE_TYPE = "GMAPLIST_EXTENSION_CAPTURE";
const APP_PORT_NAME = "gmaplists-app";
const RUNTIME_DATA_TYPE = "GMAPLIST_EXTENSION_DATA";
const RUNTIME_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";
const LATEST_PAYLOAD_KEY = "gmaplistsLatestPayload";
const LAST_REDIRECT_KEY = "gmaplistsLastRedirect";

const appPorts = new Set();

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
  for (const port of appPorts) {
    try {
      port.postMessage({ type: RUNTIME_DATA_TYPE, payload });
    } catch {
      appPorts.delete(port);
    }
  }
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

    console.info("[GMapLists] stored short URL redirect", { listId, redirectUrl });
  },
  {
    urls: ["*://maps.app.goo.gl/*"],
  }
);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== APP_PORT_NAME) return;

  appPorts.add(port);

  port.onDisconnect.addListener(() => {
    appPorts.delete(port);
  });

  port.onMessage.addListener((message) => {
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
  if (message?.type !== CAPTURE_MESSAGE_TYPE || !message.payload?.data) {
    return false;
  }

  chrome.storage.local.set({ [LATEST_PAYLOAD_KEY]: message.payload }, () => {
    console.info("[GMapLists] stored captured payload", message.payload.diagnostics);
    broadcastToApp(message.payload);
    sendResponse({ ok: true });
  });

  return true;
});
