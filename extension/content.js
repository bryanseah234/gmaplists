(() => {
  const INTERNAL_LOG_TYPE = "GMAPLIST_EXTENSION_LOG";
  const LIST_ENDPOINT = "/maps/preview/entitylist/getlist";
  const NO_GETLIST_DIAGNOSTIC_MS = 10000;

  function serializeDetails(details) {
    if (details == null) return undefined;

    try {
      return JSON.parse(JSON.stringify(details));
    } catch {
      return String(details);
    }
  }

  function debugLog(level, message, details) {
    const entry = {
      level,
      message,
      details: serializeDetails(details),
      capturedAt: Date.now(),
      pageUrl: window.location.href,
    };

    window.postMessage({ type: INTERNAL_LOG_TYPE, entry }, window.location.origin);
  }

  function extractListIdFromUrl(url) {
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

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function summarizeRelevantResources() {
    return performance.getEntriesByType("resource")
      .map((entry) => entry.name)
      .filter((name) =>
        typeof name === "string" &&
        /entitylist|getlist|preview|userlists|placelists|\/maps\//i.test(name)
      )
      .slice(-12)
      .map((name) => {
        try {
          const url = new URL(name);
          return `${url.origin}${url.pathname}${url.searchParams.has("pb") ? "?pb=..." : ""}`;
        } catch {
          return name.slice(0, 180);
        }
      });
  }

  function hasObservedGetlistRequest() {
    return performance.getEntriesByType("resource")
      .some((entry) => typeof entry.name === "string" && entry.name.includes(LIST_ENDPOINT));
  }

  function onReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  debugLog("info", "Maps page observer installed", {
    mode: "background-webrequest-import",
    url: window.location.href,
  });

  onReady(() => {
    window.setTimeout(() => {
      if (hasObservedGetlistRequest()) return;

      debugLog("warn", "No getlist request detected on this Maps page yet", {
        currentUrl: window.location.href,
        listIdFromUrl: extractListIdFromUrl(window.location.href),
        relevantResources: summarizeRelevantResources(),
      });
    }, NO_GETLIST_DIAGNOSTIC_MS);
  });
})();
