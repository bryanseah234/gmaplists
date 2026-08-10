(() => {
  const PORT_NAME = "gmaplists-app";
  const RUNTIME_DATA_TYPE = "GMAPLIST_EXTENSION_DATA";
  const RUNTIME_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";
  const RUNTIME_LOG_TYPE = "GMAPLIST_EXTENSION_LOG";
  const RUNTIME_LOGS_TYPE = "GMAPLIST_EXTENSION_LOGS";
  const PUBLIC_DATA_TYPE = "GMAPLIST_DATA";
  const PUBLIC_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";
  const PUBLIC_LOG_TYPE = "GMAPLIST_EXTENSION_LOGS";
  const APP_OPEN_MAPS_URL_TYPE = "GMAPLIST_APP_OPEN_MAPS_URL";
  const APP_REQUEST_LATEST_TYPE = "GMAPLIST_APP_REQUEST_LATEST";
  const EXTENSION_VERSION = "0.1.15";

  let reconnectAttempt = 0;
  let port = null;

  function postStatus(status) {
    window.postMessage(
      {
        type: PUBLIC_STATUS_TYPE,
        source: "gmaplists-extension",
        ...status,
        diagnostics: { extensionVersion: EXTENSION_VERSION, ...(status.diagnostics || {}) },
      },
      window.location.origin
    );
  }

  function postToApp(payload) {
    if (!payload?.data) return;

    console.info("[gmaplists] forwarding payload to app", payload.diagnostics);
    window.postMessage(
      {
        ...payload,
        diagnostics: { extensionVersion: EXTENSION_VERSION, ...(payload.diagnostics || {}) },
        type: PUBLIC_DATA_TYPE,
        source: payload.source || "gmaplists-extension",
      },
      window.location.origin
    );
  }

  function postLogs(logs) {
    window.postMessage(
      {
        type: PUBLIC_LOG_TYPE,
        source: "gmaplists-extension",
        logs,
        capturedAt: Date.now(),
      },
      window.location.origin
    );
  }

  function requestLatest() {
    if (!port) return;

    try {
      port.postMessage({ type: "GMAPLIST_GET_LATEST_PAYLOAD" });
      port.postMessage({ type: "GMAPLIST_GET_DEBUG_LOGS" });
    } catch {
      scheduleReconnect();
    }
  }

  function forwardOpenMapsRequest(url) {
    chrome.runtime.sendMessage({ type: "GMAPLIST_OPEN_MAPS_URL", url }, (response) => {
      const error = chrome.runtime.lastError?.message || response?.error;

      postStatus({
        status: response?.ok ? "loading" : "error",
        message: response?.ok
          ? "Opened Google Maps tab. Waiting for list request..."
          : error || "Extension could not open that Maps URL.",
        diagnostics: { url, error },
        capturedAt: Date.now(),
      });
    });
  }

  function scheduleReconnect() {
    reconnectAttempt += 1;
    const delay = Math.min(1000 * reconnectAttempt, 10000);

    window.setTimeout(connect, delay);
  }

  function connect() {
    try {
      if (!chrome?.runtime?.id) {
        postStatus({
          status: "unavailable",
          message: "Extension runtime unavailable. Reload the extension and this page.",
          capturedAt: Date.now(),
        });
        return;
      }

      port = chrome.runtime.connect({ name: PORT_NAME });
      reconnectAttempt = 0;
    } catch (error) {
      postStatus({
        status: "error",
        message: "Extension app bridge failed to connect.",
        diagnostics: { error: error instanceof Error ? error.message : String(error) },
        capturedAt: Date.now(),
      });
      scheduleReconnect();
      return;
    }

    postStatus({
      status: "connected",
      message: "Extension app bridge connected.",
      capturedAt: Date.now(),
    });

    port.onMessage.addListener((message) => {
      if (message?.type === RUNTIME_DATA_TYPE) {
        postStatus({
          status: "payload",
          message: "Latest Maps payload delivered to app.",
          diagnostics: message.payload?.diagnostics,
          capturedAt: Date.now(),
        });
        postToApp(message.payload);
      } else if (message?.type === RUNTIME_STATUS_TYPE) {
        postStatus(message);
      } else if (message?.type === RUNTIME_LOG_TYPE) {
        postLogs([message.entry].filter(Boolean));
      } else if (message?.type === RUNTIME_LOGS_TYPE) {
        postLogs(Array.isArray(message.logs) ? message.logs : []);
      }
    });

    port.onDisconnect.addListener(() => {
      const runtimeError = chrome.runtime.lastError?.message;
      port = null;
      postStatus({
        status: "reconnecting",
        message: "Extension app bridge disconnected; reconnecting.",
        diagnostics: runtimeError ? { error: runtimeError } : undefined,
        capturedAt: Date.now(),
      });
      scheduleReconnect();
    });

    requestLatest();
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    if (event.data?.type === APP_REQUEST_LATEST_TYPE) {
      requestLatest();
      return;
    }

    if (event.data?.type !== APP_OPEN_MAPS_URL_TYPE || typeof event.data.url !== "string") return;

    forwardOpenMapsRequest(event.data.url);
  });

  connect();
})();
