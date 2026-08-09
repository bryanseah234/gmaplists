const CAPTURE_MESSAGE_TYPE = "GMAPLIST_EXTENSION_CAPTURE";
const APP_PORT_NAME = "gmaplists-app";
const RUNTIME_DATA_TYPE = "GMAPLIST_EXTENSION_DATA";
const RUNTIME_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";
const RUNTIME_LOG_TYPE = "GMAPLIST_EXTENSION_LOG";
const RUNTIME_LOGS_TYPE = "GMAPLIST_EXTENSION_LOGS";
const LATEST_PAYLOAD_KEY = "gmaplistsLatestPayload";
const LATEST_STATUS_KEY = "gmaplistsLatestStatus";
const LAST_REDIRECT_KEY = "gmaplistsLastRedirect";
const DEBUG_LOGS_KEY = "gmaplistsDebugLogs";
const MAX_DEBUG_LOGS = 200;
const LIST_ENDPOINT = "/maps/preview/entitylist/getlist";
const ACTIVE_PAGE_DELAY_MS = 350;
const ACTIVE_MAX_PAGES = 200;
const RECENT_EXTRACTION_TTL_MS = 60000;
const CONTRIBUTOR_INDEX = 12;
const EXTENSION_VERSION = "0.1.11";

const appPorts = new Set();
let backgroundExtractionPromise = null;
let backgroundExtractionStartedFrom = "";
let backgroundExtractionStartedKey = "";
let lastCompletedExtractionKey = "";
let lastCompletedExtractionAt = 0;

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

function stripContributorProfilesFromGetlist(data) {
  if (!Array.isArray(data)) return data;
  const cloned = structuredClone(data);
  const places = Array.isArray(cloned?.[0]?.[8]) ? cloned[0][8] : [];

  for (const place of places) {
    if (Array.isArray(place) && place.length > CONTRIBUTOR_INDEX) {
      place[CONTRIBUTOR_INDEX] = null;
    }
  }

  return cloned;
}

function assertContributorProfilesStrippedFromGetlist(data) {
  const places = Array.isArray(data?.[0]?.[8]) ? data[0][8] : [];
  const leakingIndex = places.findIndex((place) =>
    Array.isArray(place) && place.length > CONTRIBUTOR_INDEX && place[CONTRIBUTOR_INDEX] != null
  );

  if (leakingIndex >= 0) {
    throw new Error(`Contributor profile data was not stripped from getlist place index ${leakingIndex}.`);
  }
}

function sanitizePayload(payload) {
  if (!payload?.data) return payload;
  const sanitized = {
    ...payload,
    data: stripContributorProfilesFromGetlist(payload.data),
  };
  assertContributorProfilesStrippedFromGetlist(sanitized.data);
  return sanitized;
}

function broadcastToApp(payload) {
  broadcastToApps({ type: RUNTIME_DATA_TYPE, payload });
}

function clearLatestPayload() {
  chrome.storage.local.remove(LATEST_PAYLOAD_KEY);
}

function broadcastStatus(status, message, diagnostics) {
  const payload = {
    type: RUNTIME_STATUS_TYPE,
    status,
    message,
    diagnostics: serializeDetails({ ...(diagnostics || {}), extensionVersion: EXTENSION_VERSION }),
    capturedAt: Date.now(),
  };

  chrome.storage.local.set({ [LATEST_STATUS_KEY]: payload }, () => {
    broadcastToApps(payload);
  });
}

function stripAntiXssi(value) {
  return value.replace(/^\)\]\}'\n?/, "");
}

function parseMapsResponseText(text) {
  if (typeof text !== "string" || !text.trim()) return null;

  try {
    return JSON.parse(stripAntiXssi(text));
  } catch {
    return null;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildListPageUrl(baseUrl, cursor) {
  const pbMatch = baseUrl.match(/([?&]pb=)([^&]+)/);
  if (!pbMatch) return baseUrl;

  let pb = decodeURIComponent(pbMatch[2]);
  pb = pb.replace(/!4i\d+/, "!4i500").replace(/!5B[^!]*/g, "");

  if (cursor) {
    const safeCursor = cursor.split("+").join("-").split("/").join("_").split("=").join("");
    pb = pb.replace("!4i500", `!4i500!5B${safeCursor}`);
  }

  return baseUrl.replace(pbMatch[0], `${pbMatch[1]}${encodeURIComponent(pb)}`);
}

function summarizeUrl(url) {
  try {
    const parsed = new URL(url);
    const pb = parsed.searchParams.get("pb") || "";
    return {
      origin: parsed.origin,
      path: parsed.pathname,
      hasPb: Boolean(pb),
      pbLength: pb.length,
      listId: extractListId(url),
    };
  } catch {
    return { url: String(url).slice(0, 160) };
  }
}

function getExtractionKey(url) {
  return extractListId(url) || buildListPageUrl(url, null);
}

function extractValidPlaces(data) {
  const raw = Array.isArray(data?.[0]?.[8]) ? data[0][8] : [];
  return raw.filter((place) =>
    Array.isArray(place) && typeof place[2] === "string" && place[2].length > 0
  );
}

function getListTotal(data, currentCount) {
  return typeof data?.[0]?.[12] === "number" && data[0][12] > 0 ? data[0][12] : currentCount;
}

function getNextCursor(data) {
  const cursor = data?.[1];
  if (typeof cursor === "string" && cursor.length > 8) return cursor;
  if (Array.isArray(cursor) && typeof cursor[0] === "string" && cursor[0].length > 8) return cursor[0];
  return null;
}

function signedIntToHex(value) {
  try {
    let numeric = BigInt(value);
    if (numeric < 0n) numeric += 1n << 64n;
    return `0x${numeric.toString(16)}`;
  } catch {
    return "";
  }
}

function hexIdFromListPlace(place) {
  const ids = place?.[1]?.[6];
  if (!Array.isArray(ids) || ids.length < 2) return undefined;

  const hi = signedIntToHex(ids[0]);
  const lo = signedIntToHex(ids[1]);
  return hi && lo ? `${hi}:${lo}` : undefined;
}

function buildFallbackMeta(place) {
  return {
    __lat: place?.[1]?.[5]?.[2] ?? null,
    __lng: place?.[1]?.[5]?.[3] ?? null,
    __address: place?.[1]?.[4] || place?.[1]?.[2] || null,
    __hexId: hexIdFromListPlace(place) || null,
  };
}

async function fetchMapsJson(url) {
  const response = await fetch(url, { credentials: "include" });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 120)}`);
  }

  const parsed = parseMapsResponseText(text);
  if (!parsed) {
    throw new Error(`Failed to parse Google Maps JSON response: ${text.slice(0, 120)}`);
  }

  return parsed;
}

async function fetchAllListPlaces(getlistUrl) {
  const allPlaces = [];
  let firstData = null;
  let nextUrl = buildListPageUrl(getlistUrl, null);
  let total = 0;
  const seenCursors = new Set();

  for (let page = 1; page <= ACTIVE_MAX_PAGES; page += 1) {
    addDebugLog("info", "Background list fetch", { page, fetched: allPlaces.length });
    broadcastStatus("loading", `Fetching Google Maps list page ${page}...`, {
      mode: "background-getlist",
      page,
      fetched: allPlaces.length,
    });
    const parsed = await fetchMapsJson(nextUrl);

    if (page === 1) firstData = parsed;

    const validPlaces = extractValidPlaces(parsed);
    allPlaces.push(...validPlaces);
    total = getListTotal(parsed, allPlaces.length);
    broadcastStatus(
      "loading",
      total > allPlaces.length
        ? `Imported ${allPlaces.length} of ${total} places...`
        : `Imported ${allPlaces.length} places...`,
      {
        mode: "background-getlist",
        page,
        fetched: allPlaces.length,
        total,
      }
    );

    const cursor = getNextCursor(parsed);
    if (!cursor || allPlaces.length >= total || seenCursors.has(cursor)) break;

    seenCursors.add(cursor);
    nextUrl = buildListPageUrl(getlistUrl, cursor);
    await delay(ACTIVE_PAGE_DELAY_MS);
  }

  if (firstData?.[0]) firstData[0][8] = allPlaces;
  return { firstData, allPlaces, total };
}

function storeAndBroadcastPayload(payload) {
  const sanitized = sanitizePayload(payload);
  chrome.storage.local.set({ [LATEST_PAYLOAD_KEY]: sanitized }, () => {
    addDebugLog("info", "Stored captured payload", sanitized.diagnostics);
    broadcastToApp(sanitized);
  });
}

async function runBackgroundExtraction(getlistUrl) {
  try {
    clearLatestPayload();
    addDebugLog("info", "Background extraction started", summarizeUrl(getlistUrl));
    broadcastStatus("loading", "Google Maps list detected. Extracting places...", summarizeUrl(getlistUrl));
    const { firstData, allPlaces, total } = await fetchAllListPlaces(getlistUrl);

    if (!firstData || allPlaces.length === 0) {
      addDebugLog("warn", "Background extraction found no places");
      broadcastStatus("no_places", "Google Maps list detected, but no places were returned.");
      return;
    }

    const payload = {
      type: "GMAPLIST_DATA",
      source: "gmaplists-extension-background",
      pageUrl: getlistUrl,
      capturedAt: Date.now(),
      data: firstData,
      meta: allPlaces.map(buildFallbackMeta),
      diagnostics: {
        mode: "background-getlist",
        fullExtraction: true,
        placeCount: allPlaces.length,
        total,
        metaCount: allPlaces.length,
        source: "webRequest-observed-getlist",
        extensionVersion: EXTENSION_VERSION,
      },
    };

    storeAndBroadcastPayload(payload);
    lastCompletedExtractionKey = getExtractionKey(getlistUrl);
    lastCompletedExtractionAt = Date.now();
    broadcastStatus("payload", `Extracted ${allPlaces.length} Google Maps places.`, payload.diagnostics);
  } catch (error) {
    addDebugLog("error", "Background extraction failed", {
      error: error instanceof Error ? error.message : String(error),
      getlist: summarizeUrl(getlistUrl),
    });
    broadcastStatus("error", "Google Maps extraction failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function scheduleBackgroundExtraction(getlistUrl) {
  const normalizedUrl = buildListPageUrl(getlistUrl, null);
  const extractionKey = getExtractionKey(normalizedUrl);
  const recentlyCompleted = (
    extractionKey === lastCompletedExtractionKey &&
    Date.now() - lastCompletedExtractionAt < RECENT_EXTRACTION_TTL_MS
  );

  if (recentlyCompleted) {
    addDebugLog("info", "Skipping recently extracted list", {
      extractionKey,
      ttlMs: RECENT_EXTRACTION_TTL_MS,
    });
    broadcastStatus("payload", "This list was already extracted recently.", {
      extractionKey,
      ttlMs: RECENT_EXTRACTION_TTL_MS,
    });
    return;
  }

  if (backgroundExtractionPromise && extractionKey === backgroundExtractionStartedKey) return;

  backgroundExtractionStartedFrom = normalizedUrl;
  backgroundExtractionStartedKey = extractionKey;
  backgroundExtractionPromise = runBackgroundExtraction(normalizedUrl).finally(() => {
    backgroundExtractionPromise = null;
  });
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

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.initiator === `chrome-extension://${chrome.runtime.id}`) return;

    addDebugLog("info", "Observed getlist request", summarizeUrl(details.url));
    broadcastStatus("loading", "Google Maps list request observed. Starting extraction...", summarizeUrl(details.url));
    scheduleBackgroundExtraction(details.url);
  },
  {
    urls: [
      "*://www.google.com/maps/preview/entitylist/getlist*",
      "*://maps.google.com/maps/preview/entitylist/getlist*",
    ],
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

    chrome.storage.local.get([LATEST_PAYLOAD_KEY, LATEST_STATUS_KEY], (stored) => {
      const payload = stored[LATEST_PAYLOAD_KEY];
      if (payload) {
        port.postMessage({ type: RUNTIME_DATA_TYPE, payload });
      } else {
        port.postMessage(stored[LATEST_STATUS_KEY] || {
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
  if (message?.type === "GMAPLIST_GET_EXTENSION_STATE") {
    chrome.storage.local.get(
      [LATEST_STATUS_KEY, DEBUG_LOGS_KEY, LATEST_PAYLOAD_KEY, LAST_REDIRECT_KEY],
      (stored) => {
        sendResponse({
          ok: true,
          status: stored[LATEST_STATUS_KEY] || null,
          logs: Array.isArray(stored[DEBUG_LOGS_KEY]) ? stored[DEBUG_LOGS_KEY] : [],
          payload: stored[LATEST_PAYLOAD_KEY] || null,
          redirect: stored[LAST_REDIRECT_KEY] || null,
        });
      }
    );
    return true;
  }

  if (message?.type === "GMAPLIST_CLEAR_DEBUG_LOGS") {
    chrome.storage.local.set({ [DEBUG_LOGS_KEY]: [] }, () => {
      addDebugLog("info", "Extension logs cleared");
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "GMAPLIST_OPEN_MAPS_URL" && typeof message.url === "string") {
    try {
      const url = new URL(message.url);
      const host = url.hostname.replace(/^www\./, "").toLowerCase();
      const allowed = (
        host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "maps.app.goo.gl"
      );

      if (!allowed) {
        sendResponse({ ok: false, error: "Paste a Google Maps or maps.app.goo.gl URL." });
        return false;
      }

      chrome.tabs.create({ url: url.href, active: true }, (tab) => {
        if (tab?.windowId != null) chrome.windows.update(tab.windowId, { focused: true });
        clearLatestPayload();
        addDebugLog("info", "Opened Maps tab from extension popup", { url: url.href });
        broadcastStatus("loading", "Opened Google Maps list tab. Waiting for list request...", { url: url.href });
        sendResponse({ ok: true });
      });
      return true;
    } catch {
      sendResponse({ ok: false, error: "Paste a valid Google Maps URL." });
      return false;
    }
  }

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

  const sanitized = sanitizePayload(message.payload);
  chrome.storage.local.set({ [LATEST_PAYLOAD_KEY]: sanitized }, () => {
    addDebugLog("info", "Stored captured payload", sanitized.diagnostics);
    console.info("[GMapLists] stored captured payload", sanitized.diagnostics);
    broadcastToApp(sanitized);
    sendResponse({ ok: true });
  });

  return true;
});
