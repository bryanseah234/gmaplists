import { ExtractedData, Place, UIConfig } from "../types";

/**
 * Parses the raw text output from the bookmarklet into structured data.
 * This runs entirely client-side using Regex and Keyword matching (No AI).
 * 
 * @param input - The raw string pasted by the user (pipe-separated values).
 * @returns ExtractedData object containing structured places and UI config.
 */
export const parseMapData = async (input: string): Promise<ExtractedData> => {
  const lines = input.split(/\n+/);
  const places: Place[] = [];
  let listTitle = "My Saved Places";
  
  // Deduplication Set: Stores unique signature "Name|Category|ReviewCount"
  const seenPlaces = new Set<string>();

  /**
   * CATEGORIZATION LOGIC
   * Keywords used to bucket places into the 4 main categories.
   * Priority of check: Drink > See > Shop > Food > Other (Fallback)
   */
  const CATEGORIES: Record<string, string[]> = {
    Drink: [
      'bar', 'cocktail', 'pub', 'brewery', 'wine', 'izakaya', 'club', 'speakeasy', 'lounge', 'taproom', 'beverage',
      'nightclub', 'disco', 'biergarten', 'cider', 'whisky', 'sake', 'distillery', 'tavern', 'gastropub', 'vodka', 'tequila', 'rum', 'beer', 'drink'
    ],
    See: [
      // Nature & Outdoors
      'park', 'garden', 'nature', 'hiking', 'trail', 'beach', 'island', 'view', 'lookout', 'scenic', 'waterfall',
      'camp', 'glacier', 'forest', 'mountain', 'lake', 'river', 'cave', 'bay', 'reserve', 'botanical', 'cliff',
      'rock', 'volcano', 'reef', 'canyon', 'dune', 'hot spring', 'onsen', 'wildlife', 'zoo', 'aquarium',
      // Culture & History
      'museum', 'gallery', 'art', 'historic', 'landmark', 'monument', 'statue', 'castle', 'palace', 'fort',
      'temple', 'church', 'cathedral', 'mosque', 'synagogue', 'shrine', 'chapel', 'monastery', 'pagoda',
      'cemetery', 'memorial', 'ruin', 'heritage', 'archaeological', 'tomb',
      // Entertainment & Activities
      'attraction', 'theater', 'theatre', 'cinema', 'movie', 'stadium', 'arena', 'coliseum', 'racetrack',
      'casino', 'bowling', 'golf', 'gym', 'fitness', 'yoga', 'pilates', 'swim', 'pool', 'skate', 'rink',
      'amusement', 'theme park', 'water park', 'fairground', 'circus', 'escape room', 'karaoke', 'billard', 
      'play', 'playground', 'spa', 'wellness', 'massage',
      // Institutions & Civic
      'library', 'school', 'college', 'university', 'institute', 'academy', 'center', 'centre',
      'hall', 'auditorium', 'embassy', 'consulate', 'hospital', 'clinic', 'airport', 'station', 'terminal',
      'bridge', 'tower', 'observatory', 'observation', 'pier', 'harbor', 'port',
      // Lodging (treated as 'See' contextually for travel lists)
      'hotel', 'motel', 'hostel', 'resort', 'inn', 'lodge', 'guesthouse', 'villa', 'cottage', 'apartment', 'campground'
    ],
    Shop: [
      // General Retail
      'mall', 'store', 'market', 'plaza', 'boutique', 'shop', 'outlet', 'center', 'mart', 'supermarket', 'grocery', 
      'retail', 'dealer', 'supplier', 'wholesaler', 'distributor', 'agency', 'broker', 'department store',
      // Vision / Medical Retail
      'optician', 'optical', 'glasses', 'eyewear', 'contact lens', 'pharmacy', 'drug store', 'chemist', 'medicine',
      // Food Retail (Explicitly requested to be Shop)
      'bakery', 'patisserie', 'cake', 'pastry', 'butcher', 'deli', 'convenience', 'liquor', 'wine store', 'cheese', 'chocolate',
      // Specific Goods
      'fashion', 'clothing', 'shoe', 'apparel', 'jewelry', 'jeweler', 'goldsmith', 'watch', 'accessories',
      'furniture', 'decor', 'hardware', 'diy', 'tool', 'paint', 'garden center', 'florist', 'flower',
      'electronics', 'computer', 'phone', 'camera', 'appliance', 'music store', 'book', 'stationery', 'gift',
      'sport', 'toy', 'hobby', 'souvenir', 'antique', 'cosmetic', 'beauty supply',
      'auto', 'car', 'motorcycle', 'vehicle', 'tire', 'parts',
      // Services
      'salon', 'hair', 'barber', 'beauty', 'nail', 'tattoo', 'bank', 'atm', 'finance', 'insurance', 'real estate', 
      'legal', 'lawyer', 'repair', 'cleaner', 'laundry', 'tailor', 'photo', 'print', 'post', 'shipping'
    ],
    Food: [
      'restaurant', 'cafe', 'coffee', 'diner', 'bistro', 'kitchen', 'eatery', 'buffet', 'steak', 'grill', 'bbq',
      'ramen', 'sushi', 'udon', 'soba', 'tempura', 'noodle', 'dumpling', 'dim sum', 'hot pot',
      'pizza', 'burger', 'pasta', 'sandwich', 'bagel', 'taco', 'burrito',
      'ice cream', 'gelato', 'dessert', 'yogurt', 'pancake', 'waffle', 'crepe',
      'chinese', 'japanese', 'korean', 'thai', 'vietnamese', 'italian', 'french', 'spanish', 'mexican', 'indian',
      'hawker', 'food court', 'stall'
    ]
  };

  // 1. Extract List Title
  if (lines.length > 0 && lines[0].startsWith("List Name:")) {
    listTitle = lines[0].replace("List Name:", "").trim();
  }

  // 2. Process each line independently
  for (const line of lines) {
    // Skip empty or system lines
    if (!line.trim() || line.startsWith("List Name:") || line.startsWith("Extraction Complete") || line.startsWith("Found")) continue;
    
    // Skip junk header text if captured by mistake
    if (line.match(/^By\s/) || line.match(/^Hello/) || line.match(/^Share/) || line.match(/^\+\d+$/)) continue;

    // --- Extraction: Link ---
    let link = "";
    const linkMatch = line.match(/\[LINK:\s*(.*?)\]/);
    if (linkMatch) {
      link = linkMatch[1];
    }
    
    // Clean line for further processing (remove the link tag)
    const cleanLine = line.replace(/\[LINK:.*?\]/, "").trim();
    // Split by pipe separator used in bookmarklet
    const parts = cleanLine.split("|").map(s => s.trim()).filter(s => s.length > 0);

    if (parts.length === 0) continue;

    const place: Place = {
      place_name: parts[0] || "Unknown Place",
      primary_category: "Other", // Default fallback is now "Other"
      detailed_category: "Place",
      star_rating: 0,
      review_count: 0,
      price_range: "",
      price_range_code: 0,
      user_notes: "",
      google_maps_link: link
    };

    // --- Extraction: Fields ---
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];

      // 1. Rating (e.g. "4.5") - Must be float 0.0-5.0
      if (/^[0-5]\.\d$/.test(part)) {
        place.star_rating = parseFloat(part);
        continue;
      }

      // 2. Review Count (e.g. "(1,234)")
      if (/^\([\d,]+\)$/.test(part)) {
        place.review_count = parseInt(part.replace(/[\(\),]/g, ""));
        continue;
      }

      // 3. Price (e.g. "$$", "$10-20", "Ramen · $$")
      // This handles mixed strings where price is combined with category text
      if (part.includes("$")) {
        const dollarMatch = part.match(/(\$+)/); // Finds sequence of $ signs
        if (dollarMatch) {
          place.price_range_code = dollarMatch[1].length;
          place.price_range = dollarMatch[1];
        }
        
        // Extract text around the dollars (e.g. "Ramen" from "Ramen · $$")
        const textOnly = part.replace(/\$/g, "").replace(/[·]/g, "").trim();
        if (textOnly.length > 2 && !textOnly.match(/\d/)) {
           place.detailed_category = textOnly;
        }
        continue;
      }

      // 4. User Notes (e.g. "Visited", "Note: ...")
      if (part.toLowerCase().includes("visited") || part.toLowerCase().includes("note:")) {
        place.user_notes = part.replace("Note:", "").trim();
        continue;
      }

      // 5. Detailed Category (Fallback)
      // If not already set by the price logic, and is a valid text string
      if (place.detailed_category === "Place" && !part.match(/\d/) && part.length > 2) {
        place.detailed_category = part.replace(/[·]/g, "").trim();
      }
    }

    // --- Categorization Logic ---
    const lowerDetail = place.detailed_category.toLowerCase();
    
    let foundCat = false;
    // Priority Check: Drink > See > Shop > Food
    for (const [cat, keywords] of Object.entries(CATEGORIES)) {
      if (keywords.some(k => lowerDetail.includes(k))) {
        // Exception: "Coffee Shop" should not match "Shop", it is Food
        if (cat === 'Shop' && (lowerDetail.includes('coffee') || lowerDetail.includes('cafe'))) {
             continue;
        }
        place.primary_category = cat;
        foundCat = true;
        break;
      }
    }
    
    // If not found in specific keywords, check if it's a generic "Hotel" (See)
    if (!foundCat) {
       if (lowerDetail.includes("hotel") || lowerDetail.includes("resort")) {
         place.primary_category = "See";
       }
    }
    
    // --- Deduplication ---
    // Only add if we haven't seen this place before.
    // Uses Name + Rating + Reviews as a unique signature.
    if (place.star_rating > 0) {
      const uniqueKey = `${place.place_name.toLowerCase()}|${place.star_rating}|${place.review_count}`;
      
      if (!seenPlaces.has(uniqueKey)) {
        seenPlaces.add(uniqueKey);
        places.push(place);
      }
    }
  }

  // Define UI Configuration for the frontend filters
  // Note: "Other" is excluded from unique_values so it doesn't create a button, satisfying the "don't show unaccounted categories" requirement.
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