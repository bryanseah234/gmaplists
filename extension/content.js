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

  let lastFingerprint = "";
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

  function rememberNetworkPayload(url, text, source) {
    const parsed = parseMapsResponseText(text);
    if (!parsed) {
      console.warn("[GMapLists] failed to parse Maps response", { source, url });
      return;
    }

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

    tryCapture();
  }

  function patchFetch() {
    const originalFetch = window.fetch;
    if (typeof originalFetch !== "function" || originalFetch.__gmaplistsPatched) return;

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

  onReady(startPolling);
})();
