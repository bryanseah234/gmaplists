// No AI System Instruction needed for parserService
export const SYSTEM_INSTRUCTION = ``;

// Bookmarklet V21 (postMessage — zero paste UX)
// Fetches all pages then opens/focuses GMapList tab and postMessages data directly.
// User clicks bookmarklet on Maps → GMapList auto-opens and populates. No copy-paste.
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
      var payload = JSON.stringify({
        type: "GMAPLIST_DATA",
        data: firstData
      });
      /* Try to postMessage to an already-open GMapList tab */
      var appWin = window.open(APP_URL, "gmaplists");
      var attempts = 0;
      var send = function() {
        attempts++;
        try {
          appWin.postMessage(payload, APP_URL);
          showStatus("GMapList: Sent " + allPlaces.length + " places to app!");
          setTimeout(removeStatus, 3000);
        } catch(e) {
          if (attempts < 10) setTimeout(send, 400);
          else {
            removeStatus();
            alert("GMapList: Could not send to app tab. Please refresh GMapList and try again.");
          }
        }
      };
      /* Give the tab time to load if it was freshly opened */
      setTimeout(send, 800);
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
