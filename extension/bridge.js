(() => {
  const INTERNAL_MESSAGE_TYPE = "GMAPLIST_EXTENSION_CAPTURE";

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== INTERNAL_MESSAGE_TYPE || !event.data.payload) return;

    chrome.runtime.sendMessage({
      type: INTERNAL_MESSAGE_TYPE,
      payload: event.data.payload,
    });
  });
})();
