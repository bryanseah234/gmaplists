

export const SYSTEM_INSTRUCTION = `
### Goal & Role
You are an expert Data Extraction Engine. Your task is to process **Raw Text** or **HTML Source** from Google Maps and extract structured data about saved places.

### Input Context
The user may provide:
1. **Raw HTML Source Code** (from a scraper).
2. **Copied Browser Text** (User selected all text on the page and copied it). This text will be messy, containing navigation labels like "Menu", "Search", "Directions", "Open now", etc.

### Your Job
You must ignore the UI noise and identifying the **List of Places**.
A "Place" entry usually contains:
- A Name (e.g., "Ms Durian")
- A Rating (e.g., "4.7")
- A Review Count (e.g., "(1,569)")
- A Category (e.g., "Cafe", "Bakery")
- A Price info (e.g., "$10-30" or "$$")
- An Accessibility badge (e.g., "Wheelchair accessible" text or icon alt text).
- A Direct Link (e.g., "[LINK: https://google.com/...]")

### Filtering Rules (CRITICAL)
1. **Exclude "Permanently Closed"**: If a place entry contains the text "Permanently closed", **IGNORE IT COMPLETELY**. Do not include it in the output.
2. **Require Rating**: Valid places MUST have a numeric star rating (e.g., "4.4"). If a place does not have a rating, ignore it.

### Required Extraction Fields
For every valid place entry found:
- \`place_name\`: String.
- \`star_rating\`: Number (float).
- \`review_count\`: Number (integer).
- \`price_range\`: String (e.g., "$10-20"). If missing, use empty string.
- \`price_range_code\`: Integer (1=$ to 4=$$$$, 0 if unknown).
- \`primary_category\`: String. **MUST be strictly one of: "Food", "Drink", "See", "Shop".** See rules below.
- \`detailed_category\`: String. A concise specific label (e.g. "Ramen", "Italian", "Cocktail Bar", "Mall"). Clean up the raw text (e.g., "Ramen restaurant" -> "Ramen").
- \`accessibility\`: Boolean (true if "Wheelchair" related text appears near the item).
- \`user_notes\`: String (Any personal note attached to the saved item).
- \`google_maps_link\`: String (The URL found in the [LINK: ...] tag if present).

### Category Normalization Rules (Strict)
Map the specific place types found in the text to exactly one of these 4 broad categories:
1. **Drink**: Bars, Cocktail bars, Pubs, Breweries, Wine bars, Izakayas (if focus is drink).
2. **Food**: Restaurants (Ramen, Italian, French, etc), Cafes, Bakeries, Ice Cream, Dessert shops, Street food.
3. **Shop**: Shopping malls, Clothing stores, Department stores, Convenience stores, Niche shops.
4. **See**: Sights, Tourist attractions, Parks, Museums, Galleries, Historical landmarks, Observation decks, Temples.

### Step B: UI/UX Component Generation
Generate a \`ui_config\` object in the JSON to guide the frontend.
- \`sorting_options\`: Define fields available for sorting.
- \`filter_groups\`: Define fields for grouping/filtering. **Use \`primary_category\` for the main category filter.**
- Assign standard placeholder icon names like "star", "flame", "tag", "map_pin", "accessibility".

### Final Output Schema (JSON)
{
  "list_title": "Extract Title or 'My Saved Places'",
  "list_source_url": "The provided source URL (or empty)",
  "ui_config": {
    "sorting_options": [
      { "field": "star_rating", "label": "Rating", "icon_svg_placeholder": "star" },
      { "field": "review_count", "label": "Popularity", "icon_svg_placeholder": "flame" },
      { "field": "price_range_code", "label": "Price", "icon_svg_placeholder": "tag" }
    ],
    "filter_groups": [
      {
        "field": "primary_category",
        "label": "Category",
        "icon_svg_placeholder": "map_pin",
        "unique_values": ["Food", "Drink", "See", "Shop"]
      },
      {
        "field": "accessibility",
        "label": "Wheelchair Accessible",
        "icon_svg_placeholder": "accessibility",
        "unique_values": [true, false]
      }
    ]
  },
  "places": [
    {
      "place_name": "Example Place",
      "primary_category": "Food",
      "detailed_category": "Ramen",
      "star_rating": 4.5,
      "review_count": 1200,
      "price_range": "$10-20",
      "price_range_code": 1,
      "accessibility": true,
      "user_notes": "optional notes found",
      "google_maps_link": "https://..."
    }
  ]
}
`;

// Redirect & Scroll Bookmarklet V6 (Safe DOM Edition)
// - Features: No innerHTML (Safe from TrustedHTML errors), Alert based status, Manual Copy Button.
export const SCROLL_BOOKMARKLET_CODE = `(function(){try{var createUI=function(e,t){var n="maplist-result-ui";var o=document.getElementById(n);if(o)o.remove();var d=document.createElement("div");d.id=n;d.style.cssText="position:fixed;top:20px;right:20px;width:300px;background:#fff;color:#111;z-index:2147483647;padding:20px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,0.2);font-family:sans-serif;border:1px solid #ccc;";var h=document.createElement("h3");h.innerText="Extraction Complete";h.style.cssText="margin:0 0 10px 0;font-size:16px;font-weight:bold;";d.appendChild(h);var p=document.createElement("p");p.innerText="Found "+t+" places. Click below to copy.";p.style.cssText="margin:0 0 15px 0;font-size:13px;color:#555;";d.appendChild(p);var ta=document.createElement("textarea");ta.value=e;ta.style.cssText="width:100%;height:80px;margin-bottom:10px;font-size:11px;";d.appendChild(ta);var btn=document.createElement("button");btn.innerText="Copy to Clipboard";btn.style.cssText="display:block;width:100%;background:#4f46e5;color:white;border:none;padding:10px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:14px;";btn.onclick=function(){ta.select();if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(ta.value).then(function(){btn.innerText="Copied!";btn.style.background="#10b981";setTimeout(function(){btn.innerText="Copy again";btn.style.background="#4f46e5";},2000);});}else{document.execCommand("copy");btn.innerText="Copied!";btn.style.background="#10b981";}};d.appendChild(btn);var cls=document.createElement("button");cls.innerText="Close";cls.style.cssText="display:block;width:100%;background:transparent;color:#555;border:1px solid #ddd;padding:8px;border-radius:6px;margin-top:8px;cursor:pointer;font-size:12px;";cls.onclick=function(){d.remove();};d.appendChild(cls);document.body.appendChild(d);};var runScroller=function(){var e=document.querySelectorAll("div"),t=document.scrollingElement||document.body,n=0;for(var o=0;o<e.length;o++){var l=e[o],r=l.scrollHeight-l.clientHeight;r>n&&l.clientHeight>0&&(n=r,t=l)}n<200&&(t=document.scrollingElement||document.body);var i=t===document.scrollingElement||t===document.body;var a=0,c=0;var s=setInterval((function(){i?window.scrollTo(0,9999999):t.scrollTo(0,9999999);var e=i?document.body.scrollHeight:t.scrollHeight;e===a?c++:(c=0,a=e);if(c>8){clearInterval(s);var txt="";var cnt=0;var main=document.querySelector('[role="main"]');var feed=document.querySelector('[role="feed"]');var target=feed||main||document.body;if(target.children&&target.children.length>3){for(var r=0;r<target.children.length;r++){var item=target.children[r];var itext=item.innerText;if(itext){if(itext.match(/Permanently closed/i))continue;if(!itext.match(/[0-5]\\.\\d/))continue;var lnk="";var aTag=item.querySelector("a[href]");if(aTag)lnk=aTag.href;else if("A"===item.tagName)lnk=item.href;if(lnk)txt+="[LINK: "+lnk+"]\\n";txt+=itext+"\\n\\n";cnt++;}}}if(cnt<2||txt.length<50){txt=target.innerText;cnt="Unknown";}createUI(txt,cnt);}}),1500);};if(-1!==window.location.href.indexOf("/local/userlists/list/")){alert("MapList: Starting Extraction...");runScroller();}else{var html=document.documentElement.innerHTML,id=null,m1=html.match(/\\[null,"([a-zA-Z0-9_-]+)",3\\]/);if(m1)id=m1[1];if(!id){var m2=window.location.href.match(/!2s([a-zA-Z0-9_-]+)!/);if(m2)id=m2[1];}if(id&&id.length>10){if(confirm("MapList: Faster view available.\\n\\nClick OK to switch to Clean View.\\n(Run extractor again after loading)"))window.location.href="https://www.google.com/local/userlists/list/"+id;else{alert("MapList: Scrolling standard view...");runScroller();}}else{alert("MapList: Scrolling standard view...");runScroller();}}}catch(e){alert("Error: "+e)}})();`;
