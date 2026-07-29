const form = document.getElementById("open-form");
const input = document.getElementById("maps-url");
const button = document.getElementById("open-button");
const status = document.getElementById("status");

function setStatus(message, tone = "") {
  status.textContent = message;
  status.className = tone;
}

function isMapsUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return host === "google.com" || host.endsWith(".google.com") || host === "maps.app.goo.gl";
  } catch {
    return false;
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const url = input.value.trim();
  if (!url) {
    setStatus("Paste a Google Maps list URL first.", "error");
    return;
  }

  if (!isMapsUrl(url)) {
    setStatus("Paste a google.com/maps or maps.app.goo.gl URL.", "error");
    return;
  }

  button.disabled = true;
  setStatus("Opening focused Maps tab...", "");

  chrome.runtime.sendMessage({ type: "GMAPLIST_OPEN_MAPS_URL", url }, (response) => {
    const error = chrome.runtime.lastError?.message || response?.error;

    if (error || !response?.ok) {
      button.disabled = false;
      setStatus(error || "Could not open that Maps URL.", "error");
      return;
    }

    setStatus("Opened Maps. Keep the GMapList app tab open.", "ok");
    window.setTimeout(() => window.close(), 900);
  });
});
