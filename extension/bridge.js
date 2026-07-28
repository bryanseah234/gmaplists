(() => {
  const INTERNAL_MESSAGE_TYPE = "GMAPLIST_EXTENSION_CAPTURE";
  const INTERNAL_LOG_TYPE = "GMAPLIST_EXTENSION_LOG";

  function forward(message) {
    chrome.runtime.sendMessage(message, () => {
      void chrome.runtime.lastError;
    });
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;

    if (event.data?.type === INTERNAL_MESSAGE_TYPE && event.data.payload) {
      forward({
        type: INTERNAL_MESSAGE_TYPE,
        payload: event.data.payload,
      });
      return;
    }

    if (event.data?.type === INTERNAL_LOG_TYPE && event.data.entry) {
      forward({
        type: INTERNAL_LOG_TYPE,
        entry: event.data.entry,
      });
    }
  });
})();
