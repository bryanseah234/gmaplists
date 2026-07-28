(() => {
  const INTERNAL_MESSAGE_TYPE = "GMAPLIST_EXTENSION_CAPTURE";
  const PUBLIC_MESSAGE_TYPE = "GMAPLIST_DATA";
  const CAPTURE_EVENT = "gmaplists:capture";
  const POLL_INTERVAL_MS = 500;
  const MAX_POLL_MS = 15000;
  const RESCAN_INTERVAL_MS = 3000;
  const MAX_RESCAN_MS = 120000;
  const LIST_ENDPOINT = "/maps/preview/entitylist/getlist";
  const PLACE_ENDPOINT = "/maps/preview/place";
  const ACTIVE_PAGE_DELAY_MS = 350;
  const ACTIVE_ENRICH_BATCH_SIZE = 20;
  const ACTIVE_MAX_PAGES = 200;

  let lastFingerprint = "";
  let activeExtractionPromise = null;
  let activeExtractionStartedFrom = "";
  let pendingRichExtractionUrl = "";
  let nativeFetch = typeof window.fetch === "function" ? window.fetch.bind(window) : null;
  let lastPlacePbTemplate = "";
  const networkPayloads = [];

  function stripAntiXssi(value) {
    return value.replace(/^\)\]\}'\n?/, "");
  }

  function parsePrefixedJson(value) {
    if (typeof value !== "string" || !value.startsWith(")]}'")) return null;

    try {
      return JSON.parse(stripAntiXssi(value));
    } catch {
      return null;
    }
  }

  function parseMapsResponseText(text) {
    if (typeof text !== "string" || !text.trim()) return null;

    try {
      return JSON.parse(stripAntiXssi(text));
    } catch {
      return null;
    }
  }

  function normalizeUrl(input) {
    try {
      if (typeof input === "string") return new URL(input, window.location.href).href;
      if (input instanceof Request) return input.url;
      if (input instanceof URL) return input.href;
    } catch {
      return "";
    }

    return "";
  }

  function shouldCaptureUrl(url) {
    return url.includes(LIST_ENDPOINT) || url.includes(PLACE_ENDPOINT);
  }

  function getPbFromUrl(url) {
    try {
      return decodeURIComponent(new URL(url, window.location.href).searchParams.get("pb") || "");
    } catch {
      return "";
    }
  }

  function rememberNetworkPayload(url, text, source) {
    const parsed = parseMapsResponseText(text);
    if (!parsed) {
      console.warn("[GMapLists] failed to parse Maps response", { source, url });
      return;
    }

    let capturedPlaceTemplate = false;

    networkPayloads.push({
      path: ["network", source, networkPayloads.length],
      parsed,
      url,
    });

    if (networkPayloads.length > 80) networkPayloads.shift();

    console.info("[GMapLists] captured Maps response", {
      source,
      endpoint: url.includes(LIST_ENDPOINT) ? "entitylist/getlist" : "preview/place",
      networkPayloadCount: networkPayloads.length,
    });

    if (url.includes(PLACE_ENDPOINT)) {
      const pb = getPbFromUrl(url);
      if (pb) {
        lastPlacePbTemplate = pb;
        capturedPlaceTemplate = true;
      }
    }

    if (url.includes(LIST_ENDPOINT)) {
      scheduleActiveExtraction(url);
    } else if (url.includes(PLACE_ENDPOINT)) {
      const getlistUrl = findGetlistUrlFromPerformance();
      if (getlistUrl) scheduleActiveExtraction(getlistUrl, capturedPlaceTemplate);
    }

    tryCapture();
  }

  function patchFetch() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function" || originalFetch.__gmaplistsPatched) return;
    nativeFetch = originalFetch.bind(window);

    const patchedFetch = function patchedFetch(input, init) {
      const url = normalizeUrl(input);

      return originalFetch.apply(this, arguments).then((response) => {
        if (shouldCaptureUrl(url)) {
          response.clone().text().then((text) => {
            rememberNetworkPayload(url, text, "fetch");
          }).catch((error) => {
            console.warn("[GMapLists] failed reading fetch response", { url, error });
          });
        }

        return response;
      });
    };

    patchedFetch.__gmaplistsPatched = true;
    window.fetch = patchedFetch;
  }

  function patchXhr() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    if (originalOpen.__gmaplistsPatched || originalSend.__gmaplistsPatched) return;

    XMLHttpRequest.prototype.open = function patchedOpen(method, url) {
      this.__gmaplistsUrl = normalizeUrl(url);
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.open.__gmaplistsPatched = true;

    XMLHttpRequest.prototype.send = function patchedSend() {
      if (shouldCaptureUrl(this.__gmaplistsUrl || "")) {
        this.addEventListener("loadend", () => {
          try {
            if (this.responseType && this.responseType !== "text") return;
            rememberNetworkPayload(this.__gmaplistsUrl, this.responseText, "xhr");
          } catch (error) {
            console.warn("[GMapLists] failed reading XHR response", {
              url: this.__gmaplistsUrl,
              error,
            });
          }
        });
      }

      return originalSend.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send.__gmaplistsPatched = true;
  }

  function walk(value, visitor, seen = new WeakSet(), path = []) {
    visitor(value, path);

    if (!value || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      value.forEach((item, index) => walk(item, visitor, seen, path.concat(index)));
      return;
    }

    Object.entries(value).forEach(([key, item]) => walk(item, visitor, seen, path.concat(key)));
  }

  function findFirst(value, predicate) {
    let result;
    walk(value, (item) => {
      if (result === undefined && predicate(item)) result = item;
    });
    return result;
  }

  function isLat(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
  }

  function isLng(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
  }

  function findCoordinates(value) {
    const pair = findFirst(value, (item) =>
      Array.isArray(item) && isLat(item[2]) && isLng(item[3])
    );
    return Array.isArray(pair) ? { lat: pair[2], lng: pair[3] } : {};
  }

  function isExternalWebsite(value) {
    if (typeof value !== "string" || !/^https?:\/\//i.test(value.trim())) return false;

    try {
      const host = new URL(value).hostname.replace(/^www\./, "").toLowerCase();
      return !(
        host === "google.com" ||
        host.endsWith(".google.com") ||
        host === "gstatic.com" ||
        host.endsWith(".gstatic.com") ||
        host === "googleusercontent.com" ||
        host.endsWith(".googleusercontent.com")
      );
    } catch {
      return false;
    }
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

  function extractListIdFromUrl(url) {
    const candidates = [
      /\/maps\/list\/([^/?#]+)/,
      /\/maps\/placelists\/list\/([^/?#]+)/,
      /\/local\/userlists\/list\/([^/?#]+)/,
      /!11m2!2s([^!?#&]+)!3e3/,
      /!2s([^!?#&]+)!3e3/,
    ];

    for (const pattern of candidates) {
      const match = url.match(pattern);
      if (match?.[1]) return decodeURIComponent(match[1]);
    }

    return undefined;
  }

  function looksLikeListPayload(parsed) {
    return Array.isArray(parsed?.[0]?.[8]);
  }

  function getDetailRoot(parsed) {
    if (Array.isArray(parsed?.[6])) return parsed[6];
    return Array.isArray(parsed) ? parsed : null;
  }

  function looksLikePlaceDetailPayload(parsed) {
    const root = getDetailRoot(parsed);
    return Boolean(root && (typeof root[11] === "string" || typeof root[10] === "string" || findFirst(root, isExternalWebsite)));
  }

  function cleanObject(value) {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
    );
  }

  function extractDetailMeta(parsed) {
    const root = getDetailRoot(parsed);
    if (!root) return {};

    const coordinates = findCoordinates(root);
    const status = findFirst(root, (value) =>
      typeof value === "string" &&
      /^(CLOSED|OPERATIONAL|CLOSED_TEMPORARILY|CLOSED_PERMANENTLY|PERMANENTLY_CLOSED|TEMPORARILY_CLOSED)$/i.test(value)
    );

    return cleanObject({
      __price: root?.[4]?.[2],
      __rating: typeof root?.[4]?.[7] === "number" ? root[4][7] : undefined,
      __reviews: typeof root?.[4]?.[8] === "number" ? root[4][8] : undefined,
      __type: Array.isArray(root?.[13]) ? root[13].find((item) => typeof item === "string") : undefined,
      __gcid: findFirst(root, (value) => typeof value === "string" && value.startsWith("gcid:")),
      __hexId: typeof root?.[10] === "string" && /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(root[10])
        ? root[10]
        : findFirst(root, (value) => typeof value === "string" && /^0x[0-9a-f]+:0x[0-9a-f]+$/i.test(value)),
      __placeId: findFirst(root, (value) => typeof value === "string" && /^ChIJ/.test(value)),
      __phone: findFirst(root, (value) => typeof value === "string" && /\+\d{1,3}\s\d+/.test(value.replace(/\s+/g, " "))),
      __website: findFirst(root, isExternalWebsite),
      __lat: typeof root?.[9]?.[2] === "number" ? root[9][2] : coordinates.lat,
      __lng: typeof root?.[9]?.[3] === "number" ? root[9][3] : coordinates.lng,
      __address: typeof root?.[39] === "string" ? root[39] : typeof root?.[18] === "string" ? root[18] : undefined,
      __businessStatus: status,
    });
  }

  function extractParsedPayloads() {
    const state = window.APP_INITIALIZATION_STATE?.[3];
    const payloads = [];

    if (!state) return payloads;

    walk(state, (value, path) => {
      const parsed = parsePrefixedJson(value);
      if (parsed) payloads.push({ path, parsed });
    });

    return payloads;
  }

  function getParsedPayloads() {
    const seen = new Set();
    return extractParsedPayloads().concat(networkPayloads).filter(({ parsed, url, path }) => {
      const key = `${url || ""}:${path.join(".")}:${Array.isArray(parsed?.[0]?.[8]) ? parsed[0][8].length : ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
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

  function findGetlistUrlFromPerformance() {
    return performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => typeof name === "string" && name.includes(LIST_ENDPOINT));
  }

  function getPlacePbTemplate() {
    if (lastPlacePbTemplate) return lastPlacePbTemplate;

    const entries = performance.getEntriesByType("resource");

    for (const entry of entries) {
      if (!entry.name.includes(PLACE_ENDPOINT)) continue;

      const pb = getPbFromUrl(entry.name);
      if (pb) return pb;
    }

    return null;
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

  function extractIconSlug(parsed, rawText) {
    const candidate = typeof parsed?.[29] === "string" ? parsed[29] : rawText;
    const match = candidate.match(/iamhere\/([^."\\/]+)\.png/);
    return match?.[1];
  }

  async function fetchMapsJson(url) {
    const response = await (nativeFetch || window.fetch.bind(window))(url, { credentials: "include" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const parsed = parseMapsResponseText(text);
    if (!parsed) {
      throw new Error(`Failed to parse Google Maps JSON response: ${text.slice(0, 120)}`);
    }
    return { text, parsed };
  }

  async function fetchAllListPlaces(getlistUrl) {
    const allPlaces = [];
    let firstData = null;
    let nextUrl = buildListPageUrl(getlistUrl, null);
    let total = 0;
    const seenCursors = new Set();

    for (let page = 1; page <= ACTIVE_MAX_PAGES; page++) {
      console.info("[GMapLists] active list fetch", { page, fetched: allPlaces.length });
      const { parsed } = await fetchMapsJson(nextUrl);

      if (page === 1) firstData = parsed;

      const validPlaces = extractValidPlaces(parsed);
      allPlaces.push(...validPlaces);
      total = getListTotal(parsed, allPlaces.length);

      const cursor = getNextCursor(parsed);
      if (!cursor || allPlaces.length >= total || seenCursors.has(cursor)) {
        break;
      }

      seenCursors.add(cursor);
      nextUrl = buildListPageUrl(getlistUrl, cursor);
      await delay(ACTIVE_PAGE_DELAY_MS);
    }

    if (firstData?.[0]) firstData[0][8] = allPlaces;

    return {
      firstData,
      allPlaces,
      total,
    };
  }

  function buildFallbackMeta(place) {
    return cleanObject({
      __lat: place?.[1]?.[5]?.[2],
      __lng: place?.[1]?.[5]?.[3],
      __address: place?.[1]?.[4] || place?.[1]?.[2],
      __hexId: hexIdFromListPlace(place),
    });
  }

  async function enrichPlace(place, pbTemplate) {
    const fallbackMeta = buildFallbackMeta(place);

    if (!pbTemplate || !place?.[1]?.[5]) return { place, meta: fallbackMeta };

    const hexId = fallbackMeta.__hexId;
    const lat = place[1][5][2];
    const lng = place[1][5][3];
    if (!hexId || lat == null || lng == null) return { place, meta: fallbackMeta };

    try {
      const pb = pbTemplate
        .replace(/!1s0x[^!]+/, `!1s${hexId}`)
        .replace(/!3d[\d.-]+/, `!3d${lat}`)
        .replace(/!4d[\d.-]+(?=!)/, `!4d${lng}`);
      const url = `https://www.google.com/maps/preview/place?authuser=0&hl=en&gl=sg&pb=${encodeURIComponent(pb)}`;
      const { text, parsed } = await fetchMapsJson(url);
      const detailMeta = extractDetailMeta(parsed);

      return {
        place,
        meta: cleanObject({
          ...fallbackMeta,
          ...detailMeta,
          __icon: extractIconSlug(parsed, text),
          __hexId: detailMeta.__hexId || hexId,
        }),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn("[GMapLists] place enrichment failed", {
        name: place?.[2],
        hexId,
        errorMessage,
      });
      return { place, meta: fallbackMeta };
    }
  }

  async function enrichPlaces(places, pbTemplate) {
    const enriched = [];

    for (let index = 0; index < places.length; index += ACTIVE_ENRICH_BATCH_SIZE) {
      const batch = places.slice(index, index + ACTIVE_ENRICH_BATCH_SIZE);
      console.info("[GMapLists] active place enrichment", {
        done: index,
        total: places.length,
        hasTemplate: Boolean(pbTemplate),
      });

      const results = await Promise.all(batch.map((place) => enrichPlace(place, pbTemplate)));
      enriched.push(...results);
    }

    return enriched;
  }

  function buildActivePayload(firstData, enrichedPlaces, diagnostics) {
    if (firstData?.[0]) {
      firstData[0][8] = enrichedPlaces.map((entry) => entry.place);
    }

    return {
      type: PUBLIC_MESSAGE_TYPE,
      source: "gmaplists-extension",
      pageUrl: window.location.href,
      capturedAt: Date.now(),
      data: firstData,
      meta: enrichedPlaces.map((entry) => entry.meta),
      diagnostics,
    };
  }

  function scheduleActiveExtraction(getlistUrl, rerunAfterCurrent = false) {
    if (!getlistUrl) return;

    const normalizedUrl = buildListPageUrl(getlistUrl, null);
    if (activeExtractionPromise && normalizedUrl === activeExtractionStartedFrom) {
      if (rerunAfterCurrent) pendingRichExtractionUrl = normalizedUrl;
      return;
    }

    activeExtractionStartedFrom = normalizedUrl;
    activeExtractionPromise = runActiveExtraction(normalizedUrl).finally(() => {
      activeExtractionPromise = null;
      const pendingUrl = pendingRichExtractionUrl;
      pendingRichExtractionUrl = "";
      if (pendingUrl) scheduleActiveExtraction(pendingUrl);
    });
  }

  async function runActiveExtraction(getlistUrl) {
    try {
      console.info("[GMapLists] active extraction started", { getlistUrl });
      const { firstData, allPlaces, total } = await fetchAllListPlaces(getlistUrl);
      if (!firstData || allPlaces.length === 0) {
        console.warn("[GMapLists] active extraction found no places");
        return;
      }

      const pbTemplate = getPlacePbTemplate();
      const enrichedPlaces = pbTemplate
        ? await enrichPlaces(allPlaces, pbTemplate)
        : allPlaces.map((place) => ({ place, meta: buildFallbackMeta(place) }));

      if (!pbTemplate) {
        console.info("[GMapLists] sent list-only payload; click a place in Maps once to enable rich enrichment");
      }

      const diagnostics = {
        mode: "active-list",
        fullExtraction: true,
        needsPlaceClick: !pbTemplate,
        pageUrl: window.location.href,
        placeCount: allPlaces.length,
        total,
        metaCount: enrichedPlaces.length,
        metaWithType: enrichedPlaces.filter((entry) => entry.meta.__type).length,
        metaWithGcid: enrichedPlaces.filter((entry) => entry.meta.__gcid).length,
        metaWithPlaceId: enrichedPlaces.filter((entry) => entry.meta.__placeId).length,
        metaWithWebsite: enrichedPlaces.filter((entry) => entry.meta.__website).length,
        hasPlacePbTemplate: Boolean(pbTemplate),
      };

      dispatchCapture(buildActivePayload(firstData, enrichedPlaces, diagnostics));
    } catch (error) {
      console.error("[GMapLists] active extraction failed", error);
    }
  }

  function startActiveExtractionPolling() {
    const startedAt = Date.now();
    const poll = window.setInterval(() => {
      const url = findGetlistUrlFromPerformance();
      if (url) scheduleActiveExtraction(url);

      if (url || Date.now() - startedAt > MAX_RESCAN_MS) {
        window.clearInterval(poll);
      }
    }, POLL_INTERVAL_MS);
  }

  function buildSyntheticList(detailPayloads) {
    const listId = extractListIdFromUrl(window.location.href) || "extension-app-state";
    const places = detailPayloads.map(({ parsed }, index) => {
      const root = getDetailRoot(parsed);
      const meta = extractDetailMeta(parsed);
      const name = typeof root?.[11] === "string" ? root[11] : document.title || `Google Maps Place ${index + 1}`;

      return [
        null,
        [
          null,
          null,
          meta.__address,
          null,
          meta.__address,
          [null, null, meta.__lat, meta.__lng],
        ],
        name,
        "",
      ];
    });

    return [
      [
        [[listId]],
        null,
        [null, null, window.location.href],
        null,
        document.title || "Google Maps Capture",
        null,
        null,
        null,
        places,
      ],
    ];
  }

  function buildCapture() {
    const parsedPayloads = getParsedPayloads();
    const listPayload = parsedPayloads.find(({ parsed }) => looksLikeListPayload(parsed));
    const detailPayloads = parsedPayloads.filter(({ parsed }) => looksLikePlaceDetailPayload(parsed));

    if (!listPayload && detailPayloads.length === 0) return null;

    const data = listPayload?.parsed ?? buildSyntheticList(detailPayloads);
    const detailMetaByHexId = new Map();
    const detailMeta = detailPayloads.map(({ parsed }) => extractDetailMeta(parsed));

    detailMeta.forEach((meta) => {
      if (meta.__hexId) detailMetaByHexId.set(meta.__hexId, meta);
    });

    const rawPlaces = data?.[0]?.[8] ?? [];
    const meta = rawPlaces.map((place, index) => {
      const hexId = hexIdFromListPlace(place);
      return cleanObject({
        __lat: place?.[1]?.[5]?.[2],
        __lng: place?.[1]?.[5]?.[3],
        __address: place?.[1]?.[4] || place?.[1]?.[2],
        __hexId: hexId,
        ...(hexId ? detailMetaByHexId.get(hexId) : detailMeta[index]),
      });
    });

    const diagnostics = {
      mode: listPayload ? "list" : "place-detail",
      parsedPayloadCount: parsedPayloads.length,
      networkPayloadCount: networkPayloads.length,
      detailPayloadCount: detailPayloads.length,
      placeCount: rawPlaces.length,
      metaCount: meta.length,
      metaWithType: meta.filter((item) => item.__type).length,
      metaWithGcid: meta.filter((item) => item.__gcid).length,
      metaWithPlaceId: meta.filter((item) => item.__placeId).length,
      metaWithWebsite: meta.filter((item) => item.__website).length,
      url: window.location.href,
    };

    return {
      type: PUBLIC_MESSAGE_TYPE,
      source: "gmaplists-extension",
      pageUrl: window.location.href,
      capturedAt: Date.now(),
      data,
      meta,
      diagnostics,
    };
  }

  function dispatchCapture(payload) {
    const fingerprint = JSON.stringify({
      url: payload.pageUrl,
      listId: payload.data?.[0]?.[0]?.[0],
      count: payload.data?.[0]?.[8]?.length,
      meta: payload.meta,
    });

    if (fingerprint === lastFingerprint) return false;
    lastFingerprint = fingerprint;

    console.info("[GMapLists] capture summary", payload.diagnostics);
    window.dispatchEvent(new CustomEvent(CAPTURE_EVENT, { detail: payload }));
    window.postMessage(payload, window.location.origin);
    window.postMessage({ type: INTERNAL_MESSAGE_TYPE, payload }, window.location.origin);
    return true;
  }

  function tryCapture() {
    const payload = buildCapture();
    if (!payload) return false;

    dispatchCapture(payload);
    return true;
  }

  function startPolling() {
    const startedAt = Date.now();
    const initialPoll = window.setInterval(() => {
      const captured = tryCapture();
      if (captured || Date.now() - startedAt > MAX_POLL_MS) {
        window.clearInterval(initialPoll);
      }
    }, POLL_INTERVAL_MS);

    const rescanStartedAt = Date.now();
    const rescan = window.setInterval(() => {
      tryCapture();
      if (Date.now() - rescanStartedAt > MAX_RESCAN_MS) {
        window.clearInterval(rescan);
      }
    }, RESCAN_INTERVAL_MS);
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  patchFetch();
  patchXhr();
  console.info("[GMapLists] Maps capture hooks installed");

  onReady(() => {
    startPolling();
    startActiveExtractionPolling();
  });
})();
