
export const SYSTEM_INSTRUCTION = `
### Goal & Role
You are an expert Data Extraction Engine. Your task is to process **Raw Text** from Google Maps and extract structured data.

### Input Format
The user will provide text where each place is typically compressed into a single line or block, often separated by pipes ("|").
Example Input:
"List Name: Singapore spots"
"Hakata Ikkousha Ramen | 4.3 | (909) | Ramen · $$ [LINK: https://...]"
"Ms Durian | 4.7 | (1,569) | Cafe · $$ | Note: Visited [LINK: https://...]"

### Filtering Rules (CRITICAL)
1. **Exclude "Permanently Closed"**: If a line contains "Permanently closed", IGNORE IT.
2. **Require Rating**: Valid places MUST have a rating (e.g. "4.4"). If missing, ignore.

### Extraction Fields
- \`place_name\`: String. (e.g. "Ms Durian")
- \`star_rating\`: Number.
- \`review_count\`: Number.
- \`price_range\`: String (e.g. "$10-30").
- \`price_range_code\`: Number (1-4 count of $ symbols).
- \`primary_category\`: String (Strictly: "Food", "Drink", "See", "Shop").
- \`detailed_category\`: String (e.g. "Ramen", "Cafe").
- \`user_notes\`: String (Look for text like "Note: Visited" or just "Visited").
- \`google_maps_link\`: String (Extract from [LINK: ...] tag).

### Output Schema (JSON)
{
  "list_title": "string",
  "list_source_url": "string",
  "ui_config": {
    "sorting_options": [
      { "field": "star_rating", "label": "Rating", "icon_svg_placeholder": "star" },
      { "field": "review_count", "label": "Popularity", "icon_svg_placeholder": "flame" },
      { "field": "price_range_code", "label": "Price", "icon_svg_placeholder": "tag" }
    ],
    "filter_groups": [
      { "field": "primary_category", "label": "Category", "icon_svg_placeholder": "map_pin", "unique_values": ["Food", "Drink", "See", "Shop"] }
    ]
  },
  "places": [
    { "place_name": "...", "primary_category": "...", "detailed_category": "...", "star_rating": 0, "review_count": 0, "price_range": "...", "price_range_code": 0, "user_notes": "...", "google_maps_link": "..." }
  ]
}
`;

// Bookmarklet V12 (Heuristic Scroll + TrustedHTML Safe)
// - Adds findScrollTarget to locate the actual scrollable container (sidebar vs body).
// - Uses DOM methods to avoid TrustedHTML errors.
export const SCROLL_BOOKMARKLET_CODE = `(function(){try{var createUI=function(e,t){var n="maplist-result-ui";var o=document.getElementById(n);if(o)o.remove();var d=document.createElement("div");d.id=n;d.style.cssText="position:fixed;top:20px;right:20px;width:340px;background:#fff;color:#111;z-index:2147483647;padding:20px;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.3);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;border:1px solid #e5e7eb;display:flex;flex-direction:column;gap:10px;";var h=document.createElement("h3");h.innerText="Extraction Complete";h.style.cssText="margin:0;font-size:16px;font-weight:700;color:#111;";d.appendChild(h);var p=document.createElement("p");p.innerText="Found "+t+" places. Copy and paste into MapList.";p.style.cssText="margin:0;font-size:13px;color:#6b7280;";d.appendChild(p);var ta=document.createElement("textarea");ta.value=e;ta.style.cssText="width:100%;height:120px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-size:11px;background:#f9fafb;color:#374151;resize:none;font-family:monospace;white-space:pre;";ta.setAttribute("readonly",true);d.appendChild(ta);var copyBtn=document.createElement("button");copyBtn.innerText="Copy to Clipboard";copyBtn.style.cssText="background:#4f46e5;color:white;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;font-size:14px;transition:0.2s;";var fallbackCopy=function(){ta.select();try{document.execCommand("copy");copyBtn.innerText="Copied (Fallback)!";copyBtn.style.background="#10b981";}catch(err){copyBtn.innerText="Failed to Copy";copyBtn.style.background="#ef4444";}};copyBtn.onclick=function(){ta.select();if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(ta.value).then(function(){copyBtn.innerText="Copied!";copyBtn.style.background="#10b981";setTimeout(function(){copyBtn.innerText="Copy to Clipboard";copyBtn.style.background="#4f46e5";},2000);}).catch(function(){fallbackCopy();});}else{fallbackCopy();}};d.appendChild(copyBtn);var closeBtn=document.createElement("button");closeBtn.innerText="Close";closeBtn.style.cssText="background:transparent;color:#6b7280;border:1px solid #e5e7eb;padding:8px;border-radius:8px;cursor:pointer;font-size:12px;";closeBtn.onclick=function(){d.remove();};d.appendChild(closeBtn);document.body.appendChild(d);};var findScrollTarget=function(){var candidates=document.querySelectorAll("div, [role='feed'], main");var best=document.scrollingElement||document.body;var maxScroll=0;for(var i=0;i<candidates.length;i++){var el=candidates[i];if(el.scrollHeight>el.clientHeight&&el.clientHeight>0){if(el.scrollHeight>maxScroll){maxScroll=el.scrollHeight;best=el;}}}return best;};var runScroller=function(){alert("MapList: Scrolling started... Please wait.");var t=findScrollTarget();var a=0,c=0;var maxRetries=20;var statusDiv=document.createElement("div");statusDiv.style.cssText="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:12px 24px;border-radius:30px;z-index:999999;font-family:sans-serif;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-weight:500;display:flex;align-items:center;gap:10px;";var txtSpan=document.createElement("span");txtSpan.innerText="MapList: Scrolling...";statusDiv.appendChild(txtSpan);document.body.appendChild(statusDiv);var s=setInterval((function(){t.scrollTo(0,9999999);var e=t.scrollHeight;var spinner=document.querySelector('[role="progressbar"]')||document.querySelector(".loading-spinner");if(e===a){c++;}else{c=0;a=e;}if(c>maxRetries&&!spinner){clearInterval(s);statusDiv.remove();var txt="";var cnt=0;var titleEl=document.querySelector("h1");if(titleEl)txt+="List Name: "+titleEl.innerText+"\\n\\n";var uniquePlaces=new Set();var linkNodes=[];var specificNodes=document.querySelectorAll("a.Xgkwf");if(specificNodes.length>0){linkNodes=Array.from(specificNodes);}else{var allAnchors=document.querySelectorAll("a");for(var k=0;k<allAnchors.length;k++){var anchor=allAnchors[k];if(anchor.href.includes("google.com")&&(anchor.innerText.includes("$")||anchor.innerText.match(/\\(\\d+\\)/))){linkNodes.push(anchor);}}}for(var r=0;r<linkNodes.length;r++){var item=linkNodes[r];var rawText=item.innerText;if(!rawText)continue;if(uniquePlaces.has(rawText))continue;if(titleEl&&rawText.includes(titleEl.innerText))continue;if(rawText.match(/^By\\s.*\\d+\\s+places/i))continue;if(rawText.match(/^Hello/))continue;if(rawText.match(/^(Share|Follow|\\+\\d+)$/))continue;if(rawText.match(/Permanently closed/i))continue;if(!rawText.match(/[0-5]\\.\\d/))continue;var flatText=rawText.replace(/[\\r\\n]+/g," | ");var lnk=item.href;if(lnk)flatText+=" [LINK: "+lnk+"]";txt+=flatText+"\\n\\n";uniquePlaces.add(rawText);cnt++;}if(cnt===0&&txt.length<50){txt="Error: Could not find places. Please try the 'Clean View' link or ensure the list is visible.";}createUI(txt,cnt);}}),1500);};if(window.location.href.includes("/local/userlists/list/")){runScroller();}else{var html=document.documentElement.innerHTML;var id=null;var m1=html.match(/\\[null,"([a-zA-Z0-9_-]+)",3\\]/);if(m1)id=m1[1];if(!id){var m2=window.location.href.match(/!2s([a-zA-Z0-9_-]+)!/);if(m2)id=m2[1];}if(id&&id.length>10){if(confirm("MapList: Optimize View?\\n\\nClick OK to switch to Clean View for better results."))window.location.href="https://www.google.com/local/userlists/list/"+id;else{runScroller();}}else{runScroller();}}}catch(e){alert("Error: "+e)}})();`;
