
// No AI System Instruction needed for parserService, but kept as empty string to avoid breakages
export const SYSTEM_INSTRUCTION = ``;

// Bookmarklet V16 (Precision Link & Scroll)
// - Targets relative hrefs (/search?q=...) which are common in Clean View.
// - Safe DOM creation.
// - Aggressive lazy-loading support.
export const SCROLL_BOOKMARKLET_CODE = `(function(){
  try {
    /* --- UI Creator (Safe DOM) --- */
    var createUI = function(text, count) {
      var id = "gmaplist-ui-panel";
      var existing = document.getElementById(id);
      if (existing) existing.remove();

      var d = document.createElement("div");
      d.id = id;
      d.style.cssText = "position:fixed;top:20px;right:20px;width:340px;background:#fff;color:#111;z-index:2147483647;padding:20px;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.3);font-family:sans-serif;border:1px solid #e5e7eb;display:flex;flex-direction:column;gap:12px;";

      var h = document.createElement("h3");
      h.textContent = "Extraction Complete";
      h.style.cssText = "margin:0;font-size:16px;font-weight:700;color:#111;";
      d.appendChild(h);

      var p = document.createElement("p");
      p.textContent = "Found " + count + " places. Copy to GMapList.";
      p.style.cssText = "margin:0;font-size:13px;color:#6b7280;";
      d.appendChild(p);

      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "width:100%;height:120px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:11px;background:#f9fafb;color:#374151;resize:none;font-family:monospace;white-space:pre;";
      ta.setAttribute("readonly", "true");
      d.appendChild(ta);

      var btn = document.createElement("button");
      btn.textContent = "Copy to Clipboard";
      btn.style.cssText = "background:#4f46e5;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:0.2s;";
      
      var fallbackCopy = function() {
        ta.select();
        try {
          document.execCommand("copy");
          btn.textContent = "Copied (Fallback)!";
          btn.style.background = "#10b981";
        } catch (e) {
          btn.textContent = "Copy Failed";
          btn.style.background = "#ef4444";
        }
      };

      btn.onclick = function() {
        ta.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(ta.value).then(function() {
            btn.textContent = "Copied!";
            btn.style.background = "#10b981";
            setTimeout(function() {
              btn.textContent = "Copy to Clipboard";
              btn.style.background = "#4f46e5";
            }, 2000);
          }).catch(fallbackCopy);
        } else {
          fallbackCopy();
        }
      };
      d.appendChild(btn);

      var close = document.createElement("button");
      close.textContent = "Close";
      close.style.cssText = "background:transparent;color:#6b7280;border:1px solid #e5e7eb;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;";
      close.onclick = function() { d.remove(); };
      d.appendChild(close);

      document.body.appendChild(d);
    };

    /* --- Scroller Logic --- */
    var findScrollTarget = function() {
      // Heuristic: Find the element with the largest scrollable content height
      var candidates = document.querySelectorAll("div, [role='feed'], main");
      var best = document.scrollingElement || document.body;
      var maxScroll = 0;
      for (var i = 0; i < candidates.length; i++) {
        var el = candidates[i];
        if (el.scrollHeight > el.clientHeight && el.clientHeight > 0) {
          if (el.scrollHeight > maxScroll) {
            maxScroll = el.scrollHeight;
            best = el;
          }
        }
      }
      return best;
    };

    var runScroller = function() {
      alert("GMapList: Scrolling started...\\n\\nDo not switch tabs. I will wait up to 20 seconds for loading to finish.");
      
      var t = findScrollTarget();
      var a = 0, c = 0;
      var maxRetries = 10; // 10 * 2s = 20s wait time
      
      var statusDiv = document.createElement("div");
      statusDiv.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 24px;border-radius:30px;z-index:999999;font-family:sans-serif;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-weight:500;";
      statusDiv.textContent = "GMapList: Scrolling...";
      document.body.appendChild(statusDiv);

      var s = setInterval(function() {
        // Force scroll to bottom
        t.scrollTop = t.scrollHeight;
        if (t !== document.body) window.scrollTo(0, document.body.scrollHeight);
        
        var h = t.scrollHeight;
        // Check for Google's loading spinner
        var spinner = document.querySelector('[role="progressbar"]') || document.querySelector(".loading-spinner");
        
        if (h === a) {
          c++;
          statusDiv.textContent = "GMapList: Waiting... (" + c + "/" + maxRetries + ")";
        } else {
          c = 0; // Reset counter if height changed
          a = h;
          var items = document.querySelectorAll("div[role='article'], a[href*='/maps/place']").length;
          statusDiv.textContent = "GMapList: Scrolling... (~" + items + " items)";
        }

        // Finish Condition
        if (c >= maxRetries && !spinner) {
          clearInterval(s);
          statusDiv.remove();
          
          var txt = "";
          var cnt = 0;
          var titleEl = document.querySelector("h1");
          if (titleEl) txt += "List Name: " + titleEl.textContent + "\\n\\n";
          
          var uniquePlaces = new Set();
          
          var main = document.querySelector('[role="main"]');
          var feed = document.querySelector('[role="feed"]');
          var target = feed || main || document.body;
          
          // Find links specifically.
          // Selector includes relative links (/search?q=, /maps/place) common in Clean View.
          var linkNodes = document.querySelectorAll('a[href*="/maps/place"], a[href*="/search?q="], a[href*="google.com/maps"], a[href*="google.com/search"]');
          var validNodes = [];
          
          // Filter link nodes
          linkNodes.forEach(function(node){
             var t = node.innerText || "";
             if (t.trim().length > 5 && !t.includes("Sign in")) {
                validNodes.push(node);
             }
          });

          // Fallback if no specific links found, try generic structure
          if (validNodes.length === 0 && target.children) {
             // Logic for when links might be wrapping text but not matched above
             var allLinks = target.querySelectorAll('a');
             allLinks.forEach(function(node){
                if (node.innerText.length > 10) validNodes.push(node);
             });
          }

          for (var r = 0; r < validNodes.length; r++) {
            var item = validNodes[r];
            var rawText = item.innerText || item.textContent;
            
            if (!rawText || rawText.length < 10) continue;
            if (uniquePlaces.has(rawText)) continue;
            
            // Filtering
            if (titleEl && rawText.includes(titleEl.innerText)) continue;
            if (rawText.match(/^By\\s.*\\d+\\s+places/i)) continue;
            if (rawText.match(/^(Share|Follow|\\+\\d+)$/)) continue;
            if (rawText.match(/Permanently closed/i)) continue;
            if (!rawText.match(/[0-5]\\.\\d/)) continue; 
            
            var flatText = rawText.replace(/[\\r\\n]+/g, " | ");
            
            // Capture the href from the node itself since we iterated anchors
            var lnk = item.href;
            if (lnk) flatText += " [LINK: " + lnk + "]";
            
            txt += flatText + "\\n\\n";
            uniquePlaces.add(rawText);
            cnt++;
          }

          if (cnt === 0 && txt.length < 50) {
             txt = "Error: Could not find places. Try switching to the 'Clean View'.";
          }
          
          createUI(txt, cnt);
        }
      }, 2000);
    };

    /* --- Main Execution --- */
    if (window.location.href.includes("/local/userlists/list/")) {
       runScroller();
    } else {
       var html = document.documentElement.innerHTML;
       var id = null;
       var m1 = html.match(/\\[null,"([a-zA-Z0-9_-]+)",3\\]/);
       if (m1) id = m1[1];
       if (!id) {
         var m2 = window.location.href.match(/!2s([a-zA-Z0-9_-]+)!/);
         if (m2) id = m2[1];
       }
       
       if (id && id.length > 10) {
         if (confirm("GMapList: Optimize View?\\n\\nSwitching to 'Clean View' is faster and more accurate.")) {
           window.location.href = "https://www.google.com/local/userlists/list/" + id;
         } else {
           runScroller();
         }
       } else {
         runScroller();
       }
    }
  } catch (e) {
    alert("GMapList Error: " + e);
  }
})();`;