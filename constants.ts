// No AI System Instruction needed for parserService
export const SYSTEM_INSTRUCTION = ``;

// Bookmarklet V22 (postMessage with copy-UI fallback if popup blocked)
export const SCROLL_BOOKMARKLET_CODE = `(function(){
  try {
    var APP_URL = "https://gmaplists.vercel.app";

    var showStatus = function(msg) {
      var id = "gml-status";
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.style.cssText = "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 28px;border-radius:30px;z-index:2147483647;font-family:sans-serif;font-size:14px;font-weight:500;box-shadow:0 4px 20px rgba(0,0,0,.4);min-width:200px;text-align:center;";
        document.body.appendChild(el);
      }
      el.textContent = msg;
    };
    var removeStatus = function() {
      var el = document.getElementById("gml-status");
      if (el) el.remove();
    };

    var showCopyUI = function(jsonText, count) {
      removeStatus();
      var id = "gml-panel";
      var ex = document.getElementById(id);
      if (ex) ex.remove();
      var d = document.createElement("div");
      d.id = id;
      d.style.cssText = "position:fixed;top:20px;right:20px;width:360px;background:#fff;color:#111;z-index:2147483647;padding:20px;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,.3);font-family:sans-serif;border:1px solid #e5e7eb;display:flex;flex-direction:column;gap:12px;";
      var h = document.createElement("div");
      h.innerHTML = "<span style=\"font-size:16px;font-weight:700;\">GMapList &mdash; Done!</span>";
      d.appendChild(h);
      var p = document.createElement("p");
      p.textContent = "Popup was blocked. Copy this and paste into GMapList.";
      p.style.cssText = "margin:0;font-size:13px;color:#6b7280;";
      d.appendChild(p);
      var ta = document.createElement("textarea");
      ta.value = jsonText;
      ta.style.cssText = "width:100%;height:90px;padding:8px;border:1px solid #d1d5db;border-radius:8px;font-size:10px;background:#f9fafb;color:#374151;resize:none;font-family:monospace;box-sizing:border-box;";
      ta.readOnly = true;
      d.appendChild(ta);
      var btn = document.createElement("button");
      btn.textContent = "Copy JSON (" + count + " places)";
      btn.style.cssText = "background:#4f46e5;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;";
      btn.onclick = function() {
        var fb = function() { ta.select(); document.execCommand("copy"); btn.textContent = "Copied!"; btn.style.background = "#10b981"; };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(jsonText).then(function(){ btn.textContent = "Copied!"; btn.style.background = "#10b981"; }).catch(fb);
        } else { fb(); }
      };
      d.appendChild(btn);
      var close = document.createElement("button");
      close.textContent = "Close";
      close.style.cssText = "background:transparent;color:#6b7280;border:1px solid #e5e7eb;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;";
      close.onclick = function() { d.remove(); };
      d.appendChild(close);
      document.body.appendChild(d);
    };

    var buildUrl = function(baseUrl, cursor) {
      var pbMatch = baseUrl.match(/([?&]pb=)([^&]+)/);
      if (!pbMatch) return baseUrl;
      var pb = decodeURIComponent(pbMatch[2]);
      pb = pb.replace(/!4i\d+/, "!4i500").replace(/!5B[^!]*/g, "");
      if (cursor) {
        var safe = cursor.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
        pb = pb.replace("!4i500", "!4i500!5B" + safe);
      }
      return baseUrl.replace(pbMatch[0], pbMatch[1] + encodeURIComponent(pb));
    };

    var getlistUrl = null;
    var entries = performance.getEntriesByType("resource");
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].name.indexOf("/maps/preview/entitylist/getlist") !== -1) {
        getlistUrl = entries[i].name;
        break;
      }
    }
    if (!getlistUrl) {
      alert("GMapList: No list data found.\n\nMake sure you:\n1. Opened a Google Maps saved list\n2. Waited for it to fully load\n3. Are on the list page (not the main map)");
      return;
    }

    var allPlaces = [];
    var firstData = null;

    var sendToApp = function() {
      removeStatus();
      if (firstData && firstData[0]) firstData[0][8] = allPlaces;
      var payload = JSON.stringify({ type: "GMAPLIST_DATA", data: firstData });
      var fallbackJson = ")]}'\n" + JSON.stringify(firstData);

      /* Try postMessage to app tab */
      var appWin = null;
      try { appWin = window.open(APP_URL, "gmaplists"); } catch(e) { appWin = null; }

      /* Popup was blocked: window.open returns null or a window with null location */
      if (!appWin || appWin.closed) {
        showCopyUI(fallbackJson, allPlaces.length);
        return;
      }

      var attempts = 0;
      var trySend = function() {
        attempts++;
        /* If the window got blocked after open (some browsers return non-null but blocked) */
        try {
          if (appWin.closed) { showCopyUI(fallbackJson, allPlaces.length); return; }
          appWin.postMessage(payload, APP_URL);
          showStatus("Sent " + allPlaces.length + " places to GMapList!");
          setTimeout(removeStatus, 3000);
        } catch(e) {
          if (attempts < 10) {
            setTimeout(trySend, 400);
          } else {
            /* postMessage kept failing — fall back to copy UI */
            showCopyUI(fallbackJson, allPlaces.length);
          }
        }
      };
      setTimeout(trySend, 800);
    };

    var fetchPage = function(url, pageNum) {
      showStatus("GMapList: Fetching page " + pageNum + " (" + allPlaces.length + " places so far)...");
      fetch(url, { credentials: "include" })
        .then(function(r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.text();
        })
        .then(function(text) {
          var body = text.replace(/^\)\]\}['\x22]\s*\n?/, "");
          var data;
          try { data = JSON.parse(body); } catch(e) {
            removeStatus();
            alert("GMapList: Could not parse response (page " + pageNum + ").\nTry refreshing the list page and clicking again.");
            return;
          }
          if (pageNum === 1) firstData = data;
          var raw = (data[0] && Array.isArray(data[0][8])) ? data[0][8] : [];
          var valid = raw.filter(function(p) {
            return Array.isArray(p) && typeof p[2] === "string" && p[2].length > 0;
          });
          allPlaces = allPlaces.concat(valid);
          showStatus("GMapList: " + allPlaces.length + " places fetched...");
          var total = (data[0] && typeof data[0][12] === "number") ? data[0][12] : 0;
          var cursor = null;
          var r1 = data[1];
          if (r1) {
            if (typeof r1 === "string" && r1.length > 8) cursor = r1;
            else if (Array.isArray(r1) && typeof r1[0] === "string" && r1[0].length > 8) cursor = r1[0];
          }
          if (cursor && allPlaces.length < total) {
            setTimeout(function() { fetchPage(buildUrl(getlistUrl, cursor), pageNum + 1); }, 350);
          } else {
            sendToApp();
          }
        })
        .catch(function(err) {
          removeStatus();
          alert("GMapList: Fetch error on page " + pageNum + ": " + err.message);
        });
    };

    fetchPage(buildUrl(getlistUrl, null), 1);

  } catch(e) {
    alert("GMapList Error: " + e.message + "\n" + e.stack);
  }
})();`;
