(() => {
  const PORT_NAME = "gmaplists-app";
  const RUNTIME_DATA_TYPE = "GMAPLIST_EXTENSION_DATA";
  const RUNTIME_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";
  const PUBLIC_DATA_TYPE = "GMAPLIST_DATA";
  const PUBLIC_STATUS_TYPE = "GMAPLIST_EXTENSION_STATUS";

  function postStatus(status) {
    window.postMessage(
      {
        type: PUBLIC_STATUS_TYPE,
        source: "gmaplists-extension",
        ...status,
      },
      window.location.origin
    );
  }

  function postToApp(payload) {
    if (!payload?.data) return;

    console.info("[GMapLists] forwarding payload to app", payload.diagnostics);
    window.postMessage(
      {
        ...payload,
        type: PUBLIC_DATA_TYPE,
        source: payload.source || "gmaplists-extension",
      },
      window.location.origin
    );
  }

  const port = chrome.runtime.connect({ name: PORT_NAME });

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
    }
  });

  port.onDisconnect.addListener(() => {
    postStatus({
      status: "disconnected",
      message: "Extension app bridge disconnected.",
      capturedAt: Date.now(),
    });
  });

  port.postMessage({ type: "GMAPLIST_GET_LATEST_PAYLOAD" });
})();
