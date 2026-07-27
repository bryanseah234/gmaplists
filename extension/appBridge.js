(() => {
  const PORT_NAME = "gmaplists-app";
  const RUNTIME_DATA_TYPE = "GMAPLIST_EXTENSION_DATA";
  const PUBLIC_DATA_TYPE = "GMAPLIST_DATA";

  function postToApp(payload) {
    if (!payload?.data) return;

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

  port.onMessage.addListener((message) => {
    if (message?.type === RUNTIME_DATA_TYPE) {
      postToApp(message.payload);
    }
  });

  port.postMessage({ type: "GMAPLIST_GET_LATEST_PAYLOAD" });
})();
