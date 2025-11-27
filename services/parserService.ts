
import { ExtractedData, Place, UIConfig } from "../types";

/**
 * Parses the raw text output from the bookmarklet into structured data.
 * Replaces the AI extraction layer.
 */
export const parseMapData = async (input: string): Promise<ExtractedData> => {
  const lines = input.split(/\n+/);
  const places: Place[] = [];
  let listTitle = "My Saved Places";
  const seenPlaces = new Set<string>();

  // Basic categorization keywords
  const CATEGORIES = {
    Drink: ['bar', 'cocktail', 'pub', 'brewery', 'wine', 'izakaya', 'club', 'speakeasy', 'lounge'],
    See: ['park', 'garden', 'museum', 'gallery', 'attraction', 'view', 'lookout', 'temple', 'church', 'historic', 'landmark', 'stadium', 'theater'],
    Shop: ['mall', 'store', 'market', 'plaza', 'boutique', 'shop', 'outlet', 'center', 'mart', 'supermarket', 'grocery'],
    Food: [] // Default if no others match
  };

  // 1. Extract List Title (usually first line if formatted by bookmarklet)
  if (lines.length > 0 && lines[0].startsWith("List Name:")) {
    listTitle = lines[0].replace("List Name:", "").trim();
  }

  // 2. Process each block
  for (const line of lines) {
    // Skip empty or title lines
    if (!line.trim() || line.startsWith("List Name:") || line.startsWith("Extraction Complete") || line.startsWith("Found")) continue;
    
    // Skip junk lines
    if (line.match(/^By\s/)) continue;
    if (line.match(/^Hello/)) continue;

    // Extract Link
    let link = "";
    const linkMatch = line.match(/\[LINK:\s*(.*?)\]/);
    if (linkMatch) {
      link = linkMatch[1];
    }
    
    // Clean line for processing
    const cleanLine = line.replace(/\[LINK:.*?\]/, "").trim();
    const parts = cleanLine.split("|").map(s => s.trim()).filter(s => s.length > 0);

    if (parts.length === 0) continue;

    const place: Place = {
      place_name: parts[0] || "Unknown Place",
      primary_category: "Food",
      detailed_category: "Place",
      star_rating: 0,
      review_count: 0,
      price_range: "",
      price_range_code: 0,
      user_notes: "",
      google_maps_link: link
    };

    // Heuristics to find fields in the parts
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      // Rating (e.g. "4.5")
      if (/^[0-5]\.\d$/.test(part)) {
        place.star_rating = parseFloat(part);
        continue;
      }

      // Review Count (e.g. "(1,234)")
      if (/^\([\d,]+\)$/.test(part)) {
        place.review_count = parseInt(part.replace(/[\(\),]/g, ""));
        continue;
      }

      // Price (e.g. "$$", "$10-20", "Ramen · $$")
      if (part.includes("$")) {
        // Extract dollar signs even if mixed
        const dollarMatch = part.match(/(\$+)/);
        if (dollarMatch) {
          place.price_range_code = dollarMatch[1].length;
          place.price_range = dollarMatch[1]; // Store just $$ for display cleanliness
        }
        
        // If it contains other text, that's likely category
        // e.g. "Ramen · $$"
        if (part.includes("·")) {
           const subParts = part.split("·");
           const catCand = subParts.find(s => !s.includes("$"));
           if (catCand) place.detailed_category = catCand.trim();
        }
        continue;
      }

      // Notes (e.g. "Visited")
      if (part.toLowerCase().includes("visited") || part.toLowerCase().includes("note:")) {
        place.user_notes = part;
        continue;
      }

      // Likely Category if not identified yet
      if (place.detailed_category === "Place" && !part.match(/\d/) && part.length > 2) {
        place.detailed_category = part.replace(/[·]/g, "").trim();
      }
    }

    // Determine Primary Category based on detailed category
    const lowerDetail = place.detailed_category.toLowerCase();
    
    let foundCat = false;
    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
      if (keywords.some(k => lowerDetail.includes(k))) {
        place.primary_category = cat;
        foundCat = true;
        break;
      }
    }
    // Fallback
    if (!foundCat) {
       if (lowerDetail.includes("restaurant") || lowerDetail.includes("cafe") || lowerDetail.includes("bakery") || lowerDetail.includes("dessert") || lowerDetail.includes("ramen")) {
         place.primary_category = "Food";
       }
    }

    // Filter out bad parses and DUPLICATES
    if (place.star_rating > 0) {
      const uniqueKey = `${place.place_name}|${place.detailed_category}|${place.review_count}`;
      
      if (!seenPlaces.has(uniqueKey)) {
        seenPlaces.add(uniqueKey);
        places.push(place);
      }
    }
  }

  // Generate UI Config
  const ui_config: UIConfig = {
    sorting_options: [
      { field: "star_rating", "label": "Rating", "icon_svg_placeholder": "star" },
      { field: "review_count", "label": "Popularity", "icon_svg_placeholder": "flame" },
      { field: "price_range_code", "label": "Price", "icon_svg_placeholder": "tag" }
    ],
    filter_groups: [
      {
        field: "primary_category",
        label: "Category",
        icon_svg_placeholder: "map_pin",
        unique_values: ["Food", "Drink", "See", "Shop"]
      }
    ]
  };

  return {
    list_title: listTitle,
    list_source_url: "",
    ui_config,
    places
  };
};
