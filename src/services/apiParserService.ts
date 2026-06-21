import { ExtractedData, Place, UIConfig } from "../types";

// ─── gcid -> primary category ────────────────────────────────────────────────
// Google's canonical place category IDs (gcid:*) mapped to our 5 buckets.
// Priority: gcid > type_label > suffix_rules > name_keywords > Uncategorised
//
// Rules confirmed from Bryan:
//   Food    = full meals (sit-down or takeaway, primary offering is a meal)
//   Snack   = light bites, sweet, bakery, coffee-only, bubble tea, dessert
//             NO full meals, NO alcohol
//   Drink   = primarily alcoholic / cocktails / you go there to drink
//   See     = experience/visit destination (not primarily eating or shopping)
//   Shop    = you go there to buy things
//   Uncategorised = anything we can't confidently assign
//
// Key disambiguation:
//   gcid:cafe          -> Food  (Singapore cafes typically serve full meals)
//   gcid:coffee_shop   -> Snack (beverage-focus, e.g. Starbucks, kopitiam)
//   gcid:juice_bar     -> Snack (NOT Drink — non-alcoholic)
//   gcid:gastropub     -> Drink (drinking with food, primary = drink)
//   gcid:brunch_restaurant -> Food (full meal)
// ─────────────────────────────────────────────────────────────────────────────

const GCID_MAP: Record<string, string> = {
  // ── Food ──────────────────────────────────────────────────────────────────
  restaurant: "Food",
  american_restaurant: "Food",
  asian_restaurant: "Food",
  chinese_restaurant: "Food",
  japanese_restaurant: "Food",
  korean_restaurant: "Food",
  thai_restaurant: "Food",
  vietnamese_restaurant: "Food",
  indian_restaurant: "Food",
  italian_restaurant: "Food",
  french_restaurant: "Food",
  mediterranean_restaurant: "Food",
  mexican_restaurant: "Food",
  middle_eastern_restaurant: "Food",
  spanish_restaurant: "Food",
  turkish_restaurant: "Food",
  greek_restaurant: "Food",
  german_restaurant: "Food",
  british_restaurant: "Food",
  australian_restaurant: "Food",
  seafood_restaurant: "Food",
  steak_house: "Food",
  sushi_restaurant: "Food",
  ramen_restaurant: "Food",
  noodle_restaurant: "Food",
  noodle_shop: "Food",
  pizza_restaurant: "Food",
  burger_restaurant: "Food",
  fried_chicken_restaurant: "Food",
  bbq_restaurant: "Food",
  hot_pot_restaurant: "Food",
  teppanyaki_restaurant: "Food",
  tonkatsu_restaurant: "Food",
  yakiniku_restaurant: "Food",
  yakitori_restaurant: "Food",
  izakaya_restaurant: "Food",
  dim_sum_restaurant: "Food",
  dumpling_restaurant: "Food",
  hawker_centre: "Food",
  food_court: "Food",
  buffet_restaurant: "Food",
  vegetarian_restaurant: "Food",
  vegan_restaurant: "Food",
  brunch_restaurant: "Food",
  breakfast_restaurant: "Food",
  family_restaurant: "Food",
  fast_food_restaurant: "Food",
  diner: "Food",
  bistro: "Food",
  brasserie: "Food",
  cafe: "Food",             // Singapore cafes = full meal destinations
  tea_restaurant: "Food",
  rice_restaurant: "Food",
  poke_restaurant: "Food",
  pasta_restaurant: "Food",
  western_restaurant: "Food",
  fusion_restaurant: "Food",
  omakase_restaurant: "Food",
  taco_restaurant: "Food",
  shabu_shabu_restaurant: "Food",
  pho_restaurant: "Food",
  curry_restaurant: "Food",
  halal_restaurant: "Food",
  kosher_restaurant: "Food",
  fish_and_chips_restaurant: "Food",
  cantonese_restaurant: "Food",
  szechuan_restaurant: "Food",
  taiwanese_restaurant: "Food",
  hong_kong_style_cafe: "Food",

  // ── Snack ─────────────────────────────────────────────────────────────────
  coffee_shop: "Snack",       // beverage-focus (Starbucks, kopitiam)
  bakery: "Snack",
  pastry_shop: "Snack",
  patisserie: "Snack",
  dessert_shop: "Snack",
  dessert_restaurant: "Snack",
  ice_cream_shop: "Snack",
  gelato_shop: "Snack",
  frozen_yogurt_shop: "Snack",
  shaved_ice_shop: "Snack",
  bubble_tea_shop: "Snack",
  boba_shop: "Snack",
  tea_house: "Snack",
  milk_tea_shop: "Snack",
  juice_bar: "Snack",         // non-alcoholic
  smoothie_bar: "Snack",
  donut_shop: "Snack",
  waffle_shop: "Snack",
  crepe_shop: "Snack",
  bagel_shop: "Snack",
  sandwich_shop: "Snack",
  toast_restaurant: "Snack",
  cake_shop: "Snack",
  chocolate_shop: "Snack",
  candy_store: "Snack",
  mochi_shop: "Snack",
  tart_shop: "Snack",
  macaron_shop: "Snack",
  soft_serve_shop: "Snack",
  fruit_stall: "Snack",
  durian_shop: "Snack",
  kopi_shop: "Snack",
  snack_bar: "Snack",

  // ── Drink ─────────────────────────────────────────────────────────────────
  bar: "Drink",
  cocktail_bar: "Drink",
  wine_bar: "Drink",
  beer_bar: "Drink",
  sake_bar: "Drink",
  whisky_bar: "Drink",
  whiskey_bar: "Drink",
  sports_bar: "Drink",
  pub: "Drink",
  taproom: "Drink",
  brewery: "Drink",
  microbrewery: "Drink",
  wine_cellar: "Drink",
  night_club: "Drink",
  nightclub: "Drink",
  lounge: "Drink",
  speakeasy: "Drink",
  rooftop_bar: "Drink",
  karaoke: "Drink",
  karaoke_bar: "Drink",
  jazz_club: "Drink",
  live_music_venue: "Drink",
  gay_bar: "Drink",
  dive_bar: "Drink",
  tiki_bar: "Drink",
  champagne_bar: "Drink",
  sake_pub: "Drink",
  distillery: "Drink",
  gastropub: "Drink",         // primary = drinking with food

  // ── See ───────────────────────────────────────────────────────────────────
  museum: "See",
  art_museum: "See",
  science_museum: "See",
  history_museum: "See",
  natural_history_museum: "See",
  children_museum: "See",
  art_gallery: "See",
  exhibition_hall: "See",
  park: "See",
  national_park: "See",
  garden: "See",
  botanical_garden: "See",
  nature_reserve: "See",
  hiking_area: "See",
  hiking_trail: "See",
  temple: "See",
  church: "See",
  cathedral: "See",
  mosque: "See",
  shrine: "See",
  hindu_temple: "See",
  buddhist_temple: "See",
  taoist_temple: "See",
  synagogue: "See",
  heritage_building: "See",
  heritage_site: "See",
  landmark: "See",
  monument: "See",
  memorial: "See",
  war_memorial: "See",
  viewpoint: "See",
  observation_deck: "See",
  zoo: "See",
  aquarium: "See",
  wildlife_park: "See",
  bird_park: "See",
  safari_park: "See",
  amusement_park: "See",
  theme_park: "See",
  water_park: "See",
  escape_room: "See",
  hotel: "See",
  resort: "See",
  hostel: "See",
  boutique_hotel: "See",
  capsule_hotel: "See",
  ryokan: "See",
  spa: "See",
  wellness_centre: "See",
  onsen: "See",
  hot_spring: "See",
  bath_house: "See",
  cinema: "See",
  movie_theater: "See",
  theater: "See",
  performing_arts_theater: "See",
  concert_hall: "See",
  opera_house: "See",
  stadium: "See",
  arena: "See",
  sports_complex: "See",
  beach: "See",
  island: "See",
  waterfall: "See",
  cave: "See",
  scenic_point: "See",
  night_market: "See",      // experience destination
  cultural_centre: "See",
  community_centre: "See",
  library: "See",
  university: "See",

  // ── Shop ──────────────────────────────────────────────────────────────────
  clothing_store: "Shop",
  shoe_store: "Shop",
  jewelry_store: "Shop",
  bag_store: "Shop",
  handbag_shop: "Shop",
  accessories_store: "Shop",
  electronics_store: "Shop",
  mobile_phone_shop: "Shop",
  camera_store: "Shop",
  computer_store: "Shop",
  bookstore: "Shop",
  record_store: "Shop",
  toy_store: "Shop",
  sporting_goods_store: "Shop",
  outdoor_sports_store: "Shop",
  bicycle_store: "Shop",
  supermarket: "Shop",
  grocery_store: "Shop",
  wet_market: "Shop",
  convenience_store: "Shop",
  department_store: "Shop",
  shopping_mall: "Shop",
  outlet_mall: "Shop",
  pharmacy: "Shop",
  beauty_supply_store: "Shop",
  cosmetics_store: "Shop",
  perfume_store: "Shop",
  furniture_store: "Shop",
  home_decor_store: "Shop",
  gift_shop: "Shop",
  souvenir_shop: "Shop",
  antique_store: "Shop",
  vintage_store: "Shop",
  thrift_store: "Shop",
  florist: "Shop",
  pet_store: "Shop",
  concept_store: "Shop",
  lifestyle_store: "Shop",
  stationery_store: "Shop",
  art_supply_store: "Shop",
  optical_store: "Shop",
  watch_store: "Shop",
  music_store: "Shop",
  craft_store: "Shop",
  tobacco_shop: "Shop",
  wine_shop: "Shop",        // buying bottles to take home
  liquor_store: "Shop",
};

// ─── Type-label text -> primary (fallback if no gcid) ────────────────────────
// Covers Google's display strings like "Ramen restaurant", "Cocktail bar" etc.

function typeLabelToPrimary(label: string): string | null {
  const l = label.toLowerCase().trim();

  // Exact known labels
  const LABEL_MAP: Record<string, string> = {
    "restaurant": "Food", "ramen restaurant": "Food", "sushi restaurant": "Food",
    "japanese restaurant": "Food", "korean restaurant": "Food",
    "chinese restaurant": "Food", "italian restaurant": "Food",
    "french restaurant": "Food", "thai restaurant": "Food",
    "vietnamese restaurant": "Food", "indian restaurant": "Food",
    "mexican restaurant": "Food", "american restaurant": "Food",
    "seafood restaurant": "Food", "steak house": "Food",
    "pizza restaurant": "Food", "burger restaurant": "Food",
    "noodle shop": "Food", "dumpling restaurant": "Food",
    "dim sum restaurant": "Food", "hawker centre": "Food",
    "food court": "Food", "buffet restaurant": "Food",
    "vegetarian restaurant": "Food", "vegan restaurant": "Food",
    "brunch restaurant": "Food", "breakfast restaurant": "Food",
    "tonkatsu restaurant": "Food", "teppanyaki restaurant": "Food",
    "shabu-shabu restaurant": "Food", "yakiniku restaurant": "Food",
    "pasta shop": "Food", "pasta restaurant": "Food",
    "sandwich shop": "Snack", "bagel shop": "Snack",
    "cafe": "Food", "coffee shop": "Snack",
    "bakery": "Snack", "pastry shop": "Snack",
    "dessert shop": "Snack", "dessert restaurant": "Snack",
    "ice cream shop": "Snack", "gelato shop": "Snack",
    "bubble tea shop": "Snack", "tea house": "Snack",
    "juice bar": "Snack", "smoothie bar": "Snack",
    "donut shop": "Snack", "waffle shop": "Snack",
    "crepe shop": "Snack", "cake shop": "Snack",
    "toast restaurant": "Snack",
    "bar": "Drink", "cocktail bar": "Drink", "wine bar": "Drink",
    "beer bar": "Drink", "sake bar": "Drink", "whisky bar": "Drink",
    "sports bar": "Drink", "pub": "Drink", "taproom": "Drink",
    "brewery": "Drink", "night club": "Drink", "nightclub": "Drink",
    "lounge": "Drink", "speakeasy": "Drink", "rooftop bar": "Drink",
    "karaoke": "Drink", "jazz club": "Drink", "gastropub": "Drink",
    "museum": "See", "art gallery": "See", "park": "See", "garden": "See",
    "botanical garden": "See", "temple": "See", "church": "See",
    "cathedral": "See", "mosque": "See", "shrine": "See",
    "zoo": "See", "aquarium": "See", "amusement park": "See",
    "theme park": "See", "escape room": "See",
    "hotel": "See", "resort": "See", "hostel": "See", "spa": "See",
    "cinema": "See", "theater": "See", "stadium": "See", "beach": "See",
    "clothing store": "Shop", "shoe store": "Shop", "jewelry store": "Shop",
    "electronics store": "Shop", "bookstore": "Shop", "gift shop": "Shop",
    "souvenir shop": "Shop", "pharmacy": "Shop", "supermarket": "Shop",
    "department store": "Shop", "shopping mall": "Shop",
    "convenience store": "Shop", "florist": "Shop",
  };

  if (LABEL_MAP[l]) return LABEL_MAP[l];

  // Suffix rules
  if (l.endsWith(" restaurant")) return "Food";
  if (l.endsWith(" bistro") || l.endsWith(" brasserie")) return "Food";
  if (l.endsWith(" bar")) {
    // juice bar, smoothie bar, milk bar -> Snack
    if (l.includes("juice") || l.includes("smoothie") || l.includes("milk") || l.includes("snack")) return "Snack";
    return "Drink";
  }
  if (l.endsWith(" pub") || l.endsWith(" club") || l.endsWith(" lounge")) return "Drink";
  if (l.endsWith(" museum") || l.endsWith(" gallery") || l.endsWith(" park") ||
      l.endsWith(" garden") || l.endsWith(" temple") || l.endsWith(" shrine") ||
      l.endsWith(" church") || l.endsWith(" mosque") || l.endsWith(" theatre") ||
      l.endsWith(" theater") || l.endsWith(" hotel") || l.endsWith(" hostel") ||
      l.endsWith(" resort") || l.endsWith(" spa")) return "See";
  if (l.endsWith(" store") || l.endsWith(" shop") && (
      l.includes("clothing") || l.includes("shoe") || l.includes("jewel") ||
      l.includes("electronic") || l.includes("book") || l.includes("gift") ||
      l.includes("souvenir") || l.includes("toy") || l.includes("sport"))) return "Shop";
  if (l.endsWith(" shop") || l.endsWith(" stall")) {
    // default small shops: snack unless clearly retail
    return "Snack";
  }
  if (l.endsWith(" mall") || l.endsWith(" market")) return "Shop";

  return null;
}

function buildMapsLink(p: any[], hexPlaceId?: string): string {
  try {
    // Prefer hex place_id — opens correct place in Maps app reliably
    if (hexPlaceId) {
      return "https://www.google.com/maps/place/?q=place_id:" + hexPlaceId;
    }
    const loc = p[1];
    if (!loc) return "";
    // Fallback: lat/lon + name search (works, no 404s unlike /g/ paths)
    const lat = loc[5]?.[2];
    const lon = loc[5]?.[3];
    const name = p[2] ?? "";
    if (lat != null && lon != null) {
      return "https://www.google.com/maps/search/" + encodeURIComponent(name) + "/@" + lat + "," + lon + ",17z";
    }
    return "";
  } catch { return ""; }
}

export function parseApiJson(raw: string, meta?: any[]): ExtractedData {
  const body = raw.replace(/^\)\]\}'\n?/, "");
  let data: any;
  try { data = JSON.parse(body); } catch { data = raw; }
  if (data && data.type === "GMAPLIST_DATA") data = data.data;

  const listTitle: string = data?.[0]?.[4] ?? "My List";
  const listUrl: string = data?.[0]?.[2]?.[2] ?? "";
  const listId: string = data?.[0]?.[0]?.[0] ?? "";
  const rawPlaces: any[] = data?.[0]?.[8] ?? [];
  // meta comes as a separate top-level key in the GMAPLIST_DATA payload
  const metaArr: any[] = meta ?? [];

  const places: Place[] = [];

  for (let i = 0; i < rawPlaces.length; i++) {
    const p = rawPlaces[i];
    if (!Array.isArray(p) || typeof p[2] !== "string" || !p[2]) continue;

    const meta = metaArr[i] ?? {};
    const name: string = p[2];
    const userNote: string = p[3] ?? "";

    const iconSlug: string = meta.__icon ?? "";
    const typeLabel: string = meta.__type ?? "";
    const gcid: string = meta.__gcid ?? "";  // e.g. "gcid:ramen_restaurant"
    const hexPlaceId: string = meta.__hexId ?? "";
    const rating: number = typeof meta.__rating === "number" ? meta.__rating : 0;
    const reviews: number = typeof meta.__reviews === "number" ? meta.__reviews : 0;

    // ── Category resolution (priority order) ──────────────────────────────
    let primary: string = "";
    let detailed: string = typeLabel || "";

    // 1. gcid (most reliable)
    if (!primary && gcid) {
      const gcidKey = gcid.replace("gcid:", "");
      primary = GCID_MAP[gcidKey] ?? "";
    }

    // 2. type label exact + suffix rules
    if (!primary && typeLabel) {
      primary = typeLabelToPrimary(typeLabel) ?? "";
    }

    // 3. icon slug (coarse fallback)
    if (!primary && iconSlug) {
      const iconMap: Record<string, string> = {
        restaurant: "Food", cafe: "Food", food: "Food", fastfood: "Food",
        bakery: "Snack", icecream: "Snack", dessert: "Snack", coffee: "Snack",
        bar: "Drink", nightclub: "Drink",
        park: "See", museum: "See", landmark: "See", hotel: "See",
        shoppingbag: "Shop", store: "Shop",
      };
      primary = iconMap[iconSlug.toLowerCase()] ?? "";
      if (!detailed) detailed = iconSlug.charAt(0).toUpperCase() + iconSlug.slice(1);
    }

    // 4. Unsorted - explicit, visible
    if (!primary) primary = "Unsorted";
    if (!detailed) detailed = primary === "Unsorted" ? "Unknown" : primary;

    const addedAt: number | undefined =
      Array.isArray(p[9]) && typeof p[9][0] === "number" ? p[9][0] : undefined;

    places.push({
      place_name: name,
      primary_category: primary,
      detailed_category: detailed,
      star_rating: rating,
      review_count: reviews,      user_notes: userNote || undefined,
      google_maps_link: buildMapsLink(p, hexPlaceId),
      hex_place_id: hexPlaceId || undefined,
      added_at: addedAt,
      is_override: false,
      list_id: listId,
      ...(gcid ? { __gcid_raw: gcid } as any : {}),
    });
  }


  // Deduplicate by place_name (same place can appear multiple times in a list)
  const seen = new Set<string>();
  const uniquePlaces = places.filter(p => {
    if (seen.has(p.place_name)) return false;
    seen.add(p.place_name);
    return true;
  });

  return {
    list_title: listTitle,
    list_source_url: listUrl,
    list_id: listId,
    ui_config: buildUIConfig(uniquePlaces),
    places: uniquePlaces,
  };
}

function buildUIConfig(places: Place[]): UIConfig {
  const cats = [...new Set(places.map((p) => p.primary_category))].sort();
  return {
    sorting_options: [],
    filter_groups: [{
      field: "primary_category",
      label: "Category",
      icon_svg_placeholder: "",
      unique_values: cats,
    }],
  };
}









