export type AutoTagCategory = "Food" | "Snack" | "Drink" | "See" | "Shop" | "Unsorted";
export type AutoTagConfidence = "high" | "medium" | "low";

export interface RulePlaceInput {
  displayName?: string;
  placeLabel?: string;
  address?: string;
  userNote?: string;
}

export interface RuleClassification {
  category: AutoTagCategory;
  confidence: AutoTagConfidence;
  ruleId: string;
  reason: string;
  matchedFamilies: RuleMatch[];
  resolution: string;
  matchedOn: "note" | "name_label" | "address" | "none";
}

interface RuleFamily {
  id: string;
  category: Exclude<AutoTagCategory, "Unsorted">;
  confidence: Exclude<AutoTagConfidence, "low">;
  terms: string[];
  substringTerms?: string[];
  reason: string;
}

export interface RuleMatch {
  id: string;
  category: Exclude<AutoTagCategory, "Unsorted">;
  confidence: Exclude<AutoTagConfidence, "low">;
  term: string;
  matchedOn: "note" | "name_label" | "address";
  reason: string;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(haystack: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (!normalizedTerm) return false;

  if (/^[\p{Letter}\p{Number} ]+$/u.test(normalizedTerm) && /[a-z0-9]/.test(normalizedTerm)) {
    return new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`, "u").test(haystack);
  }

  return haystack.includes(normalizedTerm);
}

function containsSubstringTerm(haystack: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  return normalizedTerm ? haystack.includes(normalizedTerm) : false;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Authoritative category definitions:
// - Food = full meals, any cuisine.
// - Drink = alcohol/nightlife places only when no full-meal token is present.
// - Snack = no full meals: coffee/tea shops, bakeries, desserts, roadside snack stores.
// - Shop = material goods retail.
// - See = points of interest not fitting the other four.
//
// Explicit rulings:
// - Full-meal tokens beat alcohol tokens. A restaurant with a bar is Food, not Drink.
// - "bar" is guarded: juice/coffee/dessert/snack bars are Snack; sushi/salad bars are Food.
// - Kopitiam/kedai kopi are Food; literal "coffee shop"/coffee bar/roastery are Snack.
// - "cafe" alone is Snack at medium confidence; full-meal tokens can still make it Food.
// - "dining" is Food at medium confidence because it signals meal context but can appear on cafe branding.
// - Izakaya is Food because it is alcohol plus full meals.
// - Hotel/resort/spa stay See.
// - Night market/pasar malam are mixed experience destinations, so See at medium confidence unless stronger food/shop tokens also match.
// - Categorical notes are high-trust human input and override name/address conflicts.
//   Non-categorical/status notes such as "visited" and "closed" abstain completely.
// - Address-only matches are medium confidence because street/mall names can contain misleading tokens.
export const RULE_FAMILIES: RuleFamily[] = [
  {
    id: "drink.alcohol",
    category: "Drink",
    confidence: "high",
    terms: [
      "bar", "cocktail", "pub", "lounge", "speakeasy", "taproom", "brewery", "beer", "wine", "whisky",
      "whiskey", "gin", "sake", "nightclub", "night club", "cocktail bar",
    ],
    reason: "alcohol or nightlife venue token",
  },
  {
    id: "food.meal",
    category: "Food",
    confidence: "high",
    terms: [
      "restaurant", "restoran", "kedai makan", "warung", "mamak", "gerai", "hawker", "food", "food court", "food street",
      "kopitiam", "kedai kopi", "bistro", "brasserie", "diner", "eatery", "kitchen", "izakaya", "cuisine", "buffet",
      "nasi", "mee", "mie", "noodle", "noodles", "laksa", "satay", "roti", "biryani", "banana leaf", "curry",
      "bak kut teh", "char kway teow", "yong tau foo", "steamboat", "hot pot", "dim sum", "dumpling", "claypot", "chicken rice", "chicken chop",
      "roasted duck", "duck rice", "seafood", "bbq", "grill", "burger", "pizza", "pasta", "sushi", "sushi bar", "salad bar", "ramen", "udon", "tonkatsu",
      "茶餐室", "餐馆", "餐廳", "饭店", "飯店", "肉骨茶", "点心", "點心", "火锅", "火鍋", "小厨", "鸡饭", "雞飯", "烧鸭", "燒鴨",
      "உணவகம்", "சாப்பாடு", "மாமக்",
    ],
    reason: "full-meal venue or meal dish token",
  },
  {
    id: "food.meal-context",
    category: "Food",
    confidence: "medium",
    terms: ["dining"],
    reason: "ambiguous meal-context token",
  },
  {
    id: "snack.sweets.bakery",
    category: "Snack",
    confidence: "high",
    terms: [
      "cafe", "coffee", "coffee shop", "coffee house", "coffee bar", "coffee roaster", "coffee roasters", "roastery", "espresso", "juice bar", "smoothie bar", "dessert bar", "snack bar",
      "bakery", "baker", "bakers", "bakehouse", "bakeri", "patisserie", "pastry", "bagel", "bagels", "cake", "dessert", "desserts", "ice cream", "gelato",
      "waffle", "crepe", "donut", "doughnut", "chocolate", "candy", "butter", "cendol", "ais kacang",
      "bubble tea", "boba", "matcha", "milk tea", "teh tarik", "tea house", "juice", "smoothie", "kombucha", "kopi",
      "snowflake", "snowmen", "面包", "麵包", "蛋糕", "甜品", "甜点", "甜點", "冰淇淋", "奶茶", "茶室", "豆花", "雪人",
      "பேக்கரி", "தேநீர்", "இனிப்பு",
    ],
    reason: "dessert, bakery, or non-alcoholic drink token",
  },
  {
    id: "see.destination",
    category: "See",
    confidence: "high",
    terms: [
      "museum", "gallery", "park", "garden", "temple", "church", "mosque", "shrine", "heritage",
      "landmark", "monument", "viewpoint", "lookout", "waterfall", "beach", "island", "cave",
      "zoo", "aquarium", "theme park", "amusement", "escape room", "resort", "hotel", "spa", "cinema", "theatre", "theater",
      "botanical", "trail", "hiking", "reserve",
      "博物馆", "博物館", "画廊", "公园", "公園", "寺", "庙", "廟", "清真寺", "瀑布", "海滩", "海灘",
      "கோவில்", "பள்ளிவாசல்", "பூங்கா",
    ],
    reason: "visit, attraction, lodging, or experience token",
  },
  {
    id: "shop.retail",
    category: "Shop",
    confidence: "high",
    terms: [
      "mall", "megamall", "shopping", "store", "shop", "kedai", "market", "supermarket", "hypermarket", "mart", "outlet", "boutique",
      "pharmacy", "florist", "bookstore", "souvenir", "gift", "jewellery", "jewelry", "fashion", "optical",
      "grocery", "convenience", "department store", "plaza", "retail",
      "商场", "商場", "购物", "購物", "超市", "药房", "藥房", "花店", "书店", "書店", "市场", "市場", "廣場", "广场",
      "கடை", "சந்தை", "மருந்தகம்",
    ],
    substringTerms: ["megamall"],
    reason: "retail or shopping token",
  },
  {
    id: "see.mixed-market",
    category: "See",
    confidence: "medium",
    terms: ["night market", "pasar malam"],
    reason: "mixed food/goods market treated as experience destination",
  },
];

const NOTE_LABELS: Array<{ category: AutoTagCategory; terms: string[] }> = [
  { category: "Drink", terms: ["bar", "cocktail", "pub", "beer", "wine", "drink", "drinks"] },
  { category: "Food", terms: ["dim sum", "ramen", "nasi", "mee", "laksa", "seafood", "restaurant", "dinner", "lunch", "breakfast", "meal", "food", "cuisine", "dining", "eatery", "buffet", "claypot", "chicken rice", "roasted duck", "chicken chop", "steamboat", "bak kut teh", "char kway teow", "yong tau foo", "roti"] },
  { category: "Snack", terms: ["butter", "cake", "bakery", "bagel", "bagels", "dessert", "desserts", "ice cream", "coffee", "tea", "teh tarik", "boba", "bubble tea", "kombucha", "豆花", "snack"] },
  { category: "See", terms: ["night market", "pasar malam", "escape room", "museum", "park", "view", "temple", "beach", "waterfall"] },
  { category: "Shop", terms: ["shop", "mall", "megamall", "market", "buy", "store"] },
];

const NON_LABEL_NOTE_TERMS = [
  "visited", "visit", "go", "went", "try", "maybe", "done", "saved", "closed", "near", "with", "jasmine",
  "must try", "want to go", "recommended", "recommend", "check", "todo", "to try",
];

function collectMatches(family: RuleFamily, haystack: string, matchedOn: "note" | "name_label" | "address"): RuleMatch[] {
  const wordMatches = family.terms
    .filter((term) => containsTerm(haystack, term))
    .map((term) => ({
      id: family.id,
      category: family.category,
      confidence: family.confidence,
      term,
      matchedOn,
      reason: family.reason,
    }));
  const substringMatches = (family.substringTerms ?? [])
    .filter((term) => containsSubstringTerm(haystack, term) && !family.terms.some((wordTerm) => normalizeText(wordTerm) === normalizeText(term) && containsTerm(haystack, wordTerm)))
    .map((term) => ({
      id: family.id,
      category: family.category,
      confidence: family.confidence,
      term,
      matchedOn,
      reason: family.reason,
    }));
  return [...wordMatches, ...substringMatches];
}

function confidenceForWinner(winner: RuleMatch, matches: RuleMatch[]): AutoTagConfidence {
  if (winner.matchedOn === "address") return "medium";
  if (winner.id === "snack.sweets.bakery" && normalizeText(winner.term) === "cafe" && winner.matchedOn !== "note") return "medium";
  if (winner.id === "see.mixed-market") return "medium";
  if (matches.some((match) => match.matchedOn === "address")) return "medium";
  return winner.confidence;
}

function resolveMatches(matches: RuleMatch[]): { winner: RuleMatch; resolution: string } {
  const categories = new Set(matches.map((match) => match.category));
  const byCategory = (category: AutoTagCategory) => matches.filter((match) => match.category === category);

  if (categories.has("Food")) {
    return {
      winner: byCategory("Food")[0],
      resolution: categories.has("Drink")
        ? "Food wins because full-meal tokens override alcohol/nightlife tokens."
        : "Food wins because full-meal tokens are the strongest category signal.",
    };
  }

  if (categories.has("Snack")) {
    return {
      winner: byCategory("Snack")[0],
      resolution: categories.has("Drink")
        ? "Snack wins because guarded bar/coffee/tea/dessert tokens are not alcohol destinations."
        : "Snack wins because non-full-meal food/drink tokens outrank mixed See/Shop signals.",
    };
  }

  if (categories.has("Drink")) {
    return {
      winner: byCategory("Drink")[0],
      resolution: "Drink wins only because alcohol/nightlife tokens matched and no full-meal token matched.",
    };
  }

  const mixedMarket = matches.find((match) => match.id === "see.mixed-market");
  if (mixedMarket && byCategory("Shop").every((match) => normalizeText(match.term) === "market")) {
    return {
      winner: mixedMarket,
      resolution: "See wins because night market/pasar malam is an explicitly mixed experience destination; generic market is not a stronger Shop signal.",
    };
  }

  if (categories.has("Shop")) {
    return {
      winner: byCategory("Shop")[0],
      resolution: "Shop wins because material-goods retail outranks generic point-of-interest signals.",
    };
  }

  return {
    winner: byCategory("See")[0],
    resolution: "See wins as the remaining point-of-interest category.",
  };
}

export function classifyPlaceByRules(input: RulePlaceInput): RuleClassification {
  const name = normalizeText(input.displayName ?? "");
  const label = normalizeText(input.placeLabel ?? "");
  const address = normalizeText(input.address ?? "");
  const note = normalizeText(input.userNote ?? "");
  const nameLabel = [name, label].filter(Boolean).join(" ");

  const noteMatches = isNonCategoricalNote(note)
    ? []
    : RULE_FAMILIES.flatMap((family) => collectMatches(family, note, "note"));
  const nameLabelMatches = RULE_FAMILIES.flatMap((family) => collectMatches(family, nameLabel, "name_label"));
  const addressMatches = RULE_FAMILIES.flatMap((family) => collectMatches(family, address, "address"));
  const matches = noteMatches.length > 0 ? noteMatches : nameLabelMatches.length > 0 ? nameLabelMatches : addressMatches;

  if (matches.length > 0) {
    const { winner, resolution } = resolveMatches(matches);
    const confidence = confidenceForWinner(winner, matches);
    return {
      category: winner.category,
      confidence,
      ruleId: winner.matchedOn === "address" ? `${winner.id}.address` : winner.matchedOn === "note" ? `${winner.id}.note` : winner.id,
      reason: winner.matchedOn === "address"
        ? `${winner.reason} in address fallback`
        : winner.matchedOn === "note"
          ? `${winner.reason} in high-trust note`
          : winner.reason,
      matchedFamilies: matches,
      resolution: winner.matchedOn === "note" ? `Note wins as high-trust human input. ${resolution}` : resolution,
      matchedOn: winner.matchedOn,
    };
  }

  return {
    category: "Unsorted",
    confidence: "low",
    ruleId: "unsorted.low-confidence",
    reason: "no reliable rule token in display name, place label, or address",
    matchedFamilies: [],
    resolution: "No rule families matched.",
    matchedOn: "none",
  };
}

export function categoryFromFoodDescriptiveNote(note: string): AutoTagCategory | null {
  const normalized = normalizeText(note);
  if (isNonCategoricalNote(normalized)) return null;

  for (const label of NOTE_LABELS) {
    if (label.terms.some((term) => containsTerm(normalized, term))) return label.category;
  }

  return null;
}

function isNonCategoricalNote(normalizedNote: string): boolean {
  if (!normalizedNote) return true;
  return NON_LABEL_NOTE_TERMS.some((term) => normalizedNote === normalizeText(term));
}
