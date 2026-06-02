import { ExtractedData, Place, UIConfig } from "../types";

/**
 * Parses the raw JSON from the Google Maps getlist internal API.
 * Strip ")]}\'" prefix before calling, or pass raw — we strip here.
 *
 * Confirmed field map (from live network capture):
 *   data[0][4]     = list title (string)
 *   data[0][5]     = list description
 *   data[0][8]     = places array (up to 500 per page)
 *   data[0][12]    = total place count
 *   data[1]        = next-page cursor (string, absent on last page)
 *
 *   Per place entry p = data[0][8][i]:
 *     p[2]        = place name
 *     p[3]        = user note (e.g. "Visited", "")
 *     p[1][2]     = full address
 *     p[1][4]     = short address
 *     p[1][5]     = [null, null, lat, lon]
 *     p[1][6]     = [hi_decimal, lo_signed_decimal] — encodes hex place ID
 *     p[1][7]     = /g/ path (e.g. "/g/11btvg9hby")
 *     p[9]        = [unix_ts_seconds, ns] — timestamp when place was added
 *     p[12]       = added_by: [name, avatarUrl, userId]
 *
 *   Enriched fields (added by bookmarklet via /maps/preview/place):
 *     p.__type    = Google place type label (e.g. "Ramen restaurant")
 *     p.__rating  = star rating (number)
 *     p.__reviews = review count (number)
 *     p.__price   = price string (e.g. "$10–30")
 */

// Icon slug → primary category mapping (from /maps/preview/place d[29])
const ICON_TO_PRIMARY: Record<string, string> = {
  restaurant: "Food",
  cafe: "Food",
  coffee: "Food",
  food: "Food",
  fastfood: "Food",
  bakery: "Food",
  icecream: "Food",
  dessert: "Food",
  bar: "Drink",
  nightclub: "Drink",
  pub: "Drink",
  brewery: "Drink",
  winery: "Drink",
  liquorstore: "Drink",
  park: "See",
  museum: "See",
  landmark: "See",
  church: "See",
  temple: "See",
  mosque: "See",
  zoo: "See",
  aquarium: "See",
  amusement: "See",
  hotel: "See",
  spa: "See",
  theater: "See",
  cinema: "See",
  stadium: "See",
  shoppingbag: "Shop",
  store: "Shop",
  shopping: "Shop",
  mall: "Shop",
  department: "Shop",
  clothing: "Shop",
  jewelry: "Shop",
  electronics: "Shop",
  bookstore: "Shop",
  pharmacy: "Shop",
  beauty: "Shop",
  salon: "Shop",
};

// Rich text type → primary category (from parsed place response text)
const TYPE_LABEL_TO_PRIMARY: Record<string, string> = {
  "restaurant": "Food", "ramen restaurant": "Food", "sushi restaurant": "Food",
  "japanese restaurant": "Food", "korean restaurant": "Food", "chinese restaurant": "Food",
  "italian restaurant": "Food", "french restaurant": "Food", "thai restaurant": "Food",
  "vietnamese restaurant": "Food", "indian restaurant": "Food", "mexican restaurant": "Food",
  "american restaurant": "Food", "seafood restaurant": "Food", "steak house": "Food",
  "pizza restaurant": "Food", "burger restaurant": "Food", "sandwich shop": "Food",
  "noodle shop": "Food", "dumpling restaurant": "Food", "dim sum restaurant": "Food",
  "hawker centre": "Food", "food court": "Food", "buffet restaurant": "Food",
  "vegetarian restaurant": "Food", "vegan restaurant": "Food", "brunch restaurant": "Food",
  "breakfast restaurant": "Food", "dessert shop": "Food", "ice cream shop": "Food",
  "gelato shop": "Food", "cake shop": "Food", "bakery": "Food", "pastry shop": "Food",
  "donut shop": "Food", "waffle shop": "Food", "cafe": "Food", "coffee shop": "Food",
  "tea house": "Food", "bubble tea shop": "Food", "juice bar": "Food", "smoothie bar": "Food",
  "tonkatsu restaurant": "Food", "teppanyaki restaurant": "Food", "shabu-shabu restaurant": "Food",
  "yakiniku restaurant": "Food", "poke bowl restaurant": "Food", "pasta shop": "Food",
  "bar": "Drink", "cocktail bar": "Drink", "wine bar": "Drink", "beer bar": "Drink",
  "sake bar": "Drink", "whisky bar": "Drink", "sports bar": "Drink", "lounge": "Drink",
  "nightclub": "Drink", "pub": "Drink", "gastropub": "Drink", "brewery": "Drink",
  "bar & grill": "Drink", "speakeasy": "Drink", "rooftop bar": "Drink",
  "park": "See", "national park": "See", "garden": "See", "botanical garden": "See",
  "museum": "See", "art museum": "See", "science museum": "See", "history museum": "See",
  "art gallery": "See", "landmark": "See", "monument": "See", "memorial": "See",
  "temple": "See", "church": "See", "cathedral": "See", "mosque": "See", "shrine": "See",
  "zoo": "See", "aquarium": "See", "amusement park": "See", "theme park": "See",
  "water park": "See", "hotel": "See", "resort": "See", "hostel": "See",
  "spa": "See", "wellness center": "See", "cinema": "See", "theater": "See",
  "stadium": "See", "arena": "See", "beach": "See", "viewpoint": "See",
  "clothing store": "Shop", "shoe store": "Shop", "jewelry store": "Shop",
  "electronics store": "Shop", "bookstore": "Shop", "gift shop": "Shop",
  "souvenir shop": "Shop", "pharmacy": "Shop", "supermarket": "Shop",
  "convenience store": "Shop", "department store": "Shop", "shopping mall": "Shop",
  "market": "Shop", "boutique": "Shop", "beauty supply store": "Shop",
  "hair salon": "Shop", "nail salon": "Shop",
};

function iconSlugToPrimary(slug: string): string {
  const key = slug.toLowerCase().replace(/[^a-z]/g, "");
  return ICON_TO_PRIMARY[key] || "Food";
}

function typeLabelToPrimary(label: string): string {
  const key = label.toLowerCase().trim();
  return TYPE_LABEL_TO_PRIMARY[key] || "Food";
}

function parsePriceCode(priceStr: string): number {
  if (!priceStr) return 0;
  // "$10–30" style
  const dollarCount = (priceStr.match(/\$/g) || []).length;
  if (dollarCount > 1) return dollarCount; // "$$" → 2
  // Parse numeric range like "$10–30"
  const nums = priceStr.match(/\d+/g);
  if (!nums) return 0;
  const avg = nums.reduce((a, b) => a + parseInt(b), 0) / nums.length;
  if (avg <= 15) return 1;
  if (avg <= 30) return 2;
  if (avg <= 60) return 3;
  return 4;
}

function buildMapsLink(p: any[]): string {
  try {
    const loc = p[1];
    if (!loc) return "";
    const gPath = loc[7];
    if (typeof gPath === "string" && gPath.startsWith("/g/")) {
      return `https://www.google.com/maps${gPath}`;
    }
    const lat = loc[5]?.[2];
    const lon = loc[5]?.[3];
    const name = p[2] ?? "";
    if (lat != null && lon != null) {
      return `https://www.google.com/maps/search/${encodeURIComponent(name)}/@${lat},${lon},17z`;
    }
    return "";
  } catch {
    return "";
  }
}

export function parseApiJson(raw: string): ExtractedData {
  const body = raw.replace(/^\)\]\}'\n?/, "");
  let data: any;
  try {
    data = JSON.parse(body);
  } catch {
    // If raw is already the parsed object (sent via postMessage as object)
    data = raw;
  }

  // Handle postMessage wrapper: { type: "GMAPLIST_DATA", data: [...] }
  if (data && data.type === "GMAPLIST_DATA") data = data.data;

  const listTitle: string = data?.[0]?.[4] ?? "My List";
  const listUrl: string = data?.[0]?.[2]?.[2] ?? "";
  const rawPlaces: any[] = data?.[0]?.[8] ?? [];

  const places: Place[] = [];

  for (const p of rawPlaces) {
    if (!Array.isArray(p) || typeof p[2] !== "string" || !p[2]) continue;

    const name: string = p[2];
    const userNote: string = p[3] ?? "";

    // Enriched fields from bookmarklet place lookup
    const pa = p as any;
    const iconSlug: string = pa.__icon ?? "";
    const typeLabel: string = pa.__type ?? "";
    const rating: number = typeof pa.__rating === "number" ? pa.__rating : 0;
    const reviews: number = typeof pa.__reviews === "number" ? pa.__reviews : 0;
    const priceStr: string = pa.__price ?? "";

    // Determine category
    let primary: string;
    let detailed: string;
    if (typeLabel) {
      primary = typeLabelToPrimary(typeLabel);
      detailed = typeLabel;
    } else if (iconSlug) {
      primary = iconSlugToPrimary(iconSlug);
      detailed = iconSlug.charAt(0).toUpperCase() + iconSlug.slice(1);
    } else {
      primary = "Food";
      detailed = "Restaurant";
    }

    // Added-at timestamp
    const addedAt: number | undefined =
      Array.isArray(p[9]) && typeof p[9][0] === "number" ? p[9][0] : undefined;

    places.push({
      place_name: name,
      primary_category: primary,
      detailed_category: detailed,
      star_rating: rating,
      review_count: reviews,
      price_range: priceStr,
      price_range_code: parsePriceCode(priceStr),
      user_notes: userNote || undefined,
      google_maps_link: buildMapsLink(p),
      added_at: addedAt,
    });
  }

  return {
    list_title: listTitle,
    list_source_url: listUrl,
    ui_config: buildUIConfig(places),
    places,
  };
}

function buildUIConfig(places: Place[]): UIConfig {
  const cats = [...new Set(places.map((p) => p.primary_category))].sort();
  const hasVisited = places.some((p) => p.user_notes?.toLowerCase().includes("visited"));
  return {
    sorting_options: [],
    filter_groups: [
      {
        field: "primary_category",
        label: "Category",
        icon_svg_placeholder: "",
        unique_values: cats,
      },
      ...(hasVisited
        ? [{
            field: "user_notes" as keyof Place,
            label: "Status",
            icon_svg_placeholder: "",
            unique_values: ["Visited"],
          }]
        : []),
    ],
  };
}

