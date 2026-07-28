function gmaplistBookmarklet() {
  const APP_URL = "__GMAPLIST_APP_URL__";
  const LIST_ENDPOINT = "/maps/preview/entitylist/getlist";

  const showStatus = (message: string) => {
    const id = "gml-status";
    let element = document.getElementById(id);
    if (!element) {
      element = document.createElement("div");
      element.id = id;
      element.style.cssText = [
        "position:fixed",
        "bottom:24px",
        "left:50%",
        "transform:translateX(-50%)",
        "background:#111",
        "color:#fff",
        "padding:12px 28px",
        "border-radius:30px",
        "z-index:2147483647",
        "font-family:sans-serif",
        "font-size:14px",
        "font-weight:500",
        "box-shadow:0 4px 20px rgba(0,0,0,.4)",
        "min-width:200px",
        "text-align:center",
      ].join(";");
      document.body.appendChild(element);
    }
    element.textContent = message;
  };

  const removeStatus = () => {
    document.getElementById("gml-status")?.remove();
  };

  const showCopyUI = (jsonText: string, count: number) => {
    removeStatus();
    document.getElementById("gml-panel")?.remove();

    const panel = document.createElement("div");
    panel.id = "gml-panel";
    panel.style.cssText = [
      "position:fixed",
      "top:20px",
      "right:20px",
      "width:360px",
      "background:#fff",
      "color:#111",
      "z-index:2147483647",
      "padding:20px",
      "border-radius:16px",
      "box-shadow:0 20px 50px rgba(0,0,0,.3)",
      "font-family:sans-serif",
      "border:1px solid #e5e7eb",
      "display:flex",
      "flex-direction:column",
      "gap:12px",
    ].join(";");

    const heading = document.createElement("div");
    heading.textContent = "GMapList Done";
    heading.style.cssText = "font-size:16px;font-weight:700;";
    panel.appendChild(heading);

    const help = document.createElement("p");
    help.textContent = "Popup blocked. Copy and paste this JSON into GMapList.";
    help.style.cssText = "margin:0;font-size:13px;color:#6b7280;";
    panel.appendChild(help);

    const textarea = document.createElement("textarea");
    textarea.value = jsonText;
    textarea.readOnly = true;
    textarea.style.cssText = [
      "width:100%",
      "height:90px",
      "padding:8px",
      "border:1px solid #d1d5db",
      "border-radius:8px",
      "font-size:10px",
      "background:#f9fafb",
      "color:#374151",
      "resize:none",
      "font-family:monospace",
      "box-sizing:border-box",
    ].join(";");
    panel.appendChild(textarea);

    const copy = document.createElement("button");
    copy.textContent = `Copy JSON (${count} places)`;
    copy.style.cssText = "background:#18181b;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;";
    copy.onclick = () => {
      const markCopied = () => {
        copy.textContent = "Copied";
        copy.style.background = "#10b981";
      };

      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(jsonText).then(markCopied).catch(() => {
          textarea.select();
          document.execCommand("copy");
          markCopied();
        });
      } else {
        textarea.select();
        document.execCommand("copy");
        markCopied();
      }
    };
    panel.appendChild(copy);

    const close = document.createElement("button");
    close.textContent = "Close";
    close.style.cssText = "background:transparent;color:#6b7280;border:1px solid #e5e7eb;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;";
    close.onclick = () => panel.remove();
    panel.appendChild(close);

    document.body.appendChild(panel);
  };

  const signedIntToHex = (value: unknown) => {
    try {
      let numeric = BigInt(value as string | number | bigint);
      if (numeric < 0n) numeric += 1n << 64n;
      return `0x${numeric.toString(16)}`;
    } catch {
      return "";
    }
  };

  const hexIdFromPlace = (place: any[]) => {
    const ids = place?.[1]?.[6];
    if (!Array.isArray(ids) || ids.length < 2) return null;
    const hi = signedIntToHex(ids[0]);
    const lo = signedIntToHex(ids[1]);
    return hi && lo ? `${hi}:${lo}` : null;
  };

  const buildUrl = (baseUrl: string, cursor: string | null) => {
    const pbMatch = baseUrl.match(/([?&]pb=)([^&]+)/);
    if (!pbMatch) return baseUrl;

    let pb = decodeURIComponent(pbMatch[2]);
    pb = pb.replace(/!4i\d+/, "!4i500").replace(/!5B[^!]*/g, "");

    if (cursor) {
      const safeCursor = cursor.split("+").join("-").split("/").join("_").split("=").join("");
      pb = pb.replace("!4i500", `!4i500!5B${safeCursor}`);
    }

    return baseUrl.replace(pbMatch[0], `${pbMatch[1]}${encodeURIComponent(pb)}`);
  };

  const parseMapsJson = (text: string) => JSON.parse(text.replace(/^\)\]\}'\n?/, ""));

  const findGetlistUrl = () => performance
    .getEntriesByType("resource")
    .map((entry) => (entry as PerformanceResourceTiming).name)
    .find((name) => typeof name === "string" && name.includes(LIST_ENDPOINT));

  const sendToApp = (firstData: any[], places: any[]) => {
    removeStatus();
    if (firstData?.[0]) firstData[0][8] = places;

    const meta = places.map((place) => ({
      __lat: place?.[1]?.[5]?.[2] ?? null,
      __lng: place?.[1]?.[5]?.[3] ?? null,
      __address: place?.[1]?.[4] || place?.[1]?.[2] || null,
      __hexId: hexIdFromPlace(place),
    }));

    const payload = {
      type: "GMAPLIST_DATA",
      source: "gmaplists-bookmarklet",
      data: firstData,
      meta,
      diagnostics: {
        mode: "bookmarklet-list",
        fullExtraction: true,
        placeCount: places.length,
        metaCount: meta.length,
        needsGeminiSorting: true,
      },
    };
    const payloadText = JSON.stringify(payload);
    const listId = firstData?.[0]?.[0]?.[0] || "";
    const targetUrl = `${APP_URL}${listId ? `/${listId}` : ""}`;

    let appWindow: Window | null = null;
    try {
      appWindow = window.open(targetUrl, "gmaplists");
    } catch {
      appWindow = null;
    }

    if (!appWindow || appWindow.closed) {
      showCopyUI(payloadText, places.length);
      return;
    }

    let attempts = 0;
    const trySend = () => {
      attempts += 1;
      try {
        if (!appWindow || appWindow.closed) {
          showCopyUI(payloadText, places.length);
          return;
        }
        appWindow.postMessage(payloadText, "*");
        showStatus(`Sent ${places.length} places to GMapList`);
        setTimeout(removeStatus, 2500);
      } catch {
        if (attempts < 12) {
          setTimeout(trySend, 400);
        } else {
          showCopyUI(payloadText, places.length);
        }
      }
    };

    setTimeout(trySend, 800);
  };

  const fetchAllPages = async (firstUrl: string) => {
    const places: any[] = [];
    let firstData: any[] | null = null;
    let nextUrl = buildUrl(firstUrl, null);
    const seenCursors = new Set<string>();

    for (let page = 1; page <= 200; page += 1) {
      showStatus(`GMapList: fetching page ${page} (${places.length} places)`);
      const response = await fetch(nextUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = parseMapsJson(await response.text());
      if (page === 1) firstData = data;

      const rawPlaces = Array.isArray(data?.[0]?.[8]) ? data[0][8] : [];
      places.push(...rawPlaces.filter((place: unknown) =>
        Array.isArray(place) && typeof place[2] === "string" && place[2].length > 0
      ));

      const total = typeof data?.[0]?.[12] === "number" ? data[0][12] : places.length;
      const responseCursor = data?.[1];
      const cursor = typeof responseCursor === "string" && responseCursor.length > 8
        ? responseCursor
        : Array.isArray(responseCursor) && typeof responseCursor[0] === "string" && responseCursor[0].length > 8
          ? responseCursor[0]
          : null;

      if (!cursor || places.length >= total || seenCursors.has(cursor)) break;

      seenCursors.add(cursor);
      nextUrl = buildUrl(firstUrl, cursor);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }

    if (!firstData) throw new Error("No list data returned.");
    return { firstData, places };
  };

  (async () => {
    try {
      const getlistUrl = findGetlistUrl();
      if (!getlistUrl) {
        alert("GMapList: no saved list request found. Open a saved list, wait for it to load, then run this again.");
        return;
      }

      const { firstData, places } = await fetchAllPages(getlistUrl);
      sendToApp(firstData, places);
    } catch (error) {
      removeStatus();
      alert(`GMapList: ${error instanceof Error ? error.message : String(error)}`);
    }
  })();
}

export const SCROLL_BOOKMARKLET_CODE =
  `(${gmaplistBookmarklet.toString().replace(/\s+/g, " ")})();`;
