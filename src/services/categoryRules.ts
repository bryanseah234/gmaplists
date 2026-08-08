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
}

interface RuleFamily {
  id: string;
  category: Exclude<AutoTagCategory, "Unsorted">;
  confidence: Exclude<AutoTagConfidence, "low">;
  terms: string[];
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Judgement calls:
// - Cafe is Food in this Malaysia/Singapore context because many cafes are full-meal destinations.
// - Kopitiam/kedai kopi are Food, not Snack, because the common use is a meal venue even if kopi is in the name.
// - Bakery, dessert, ice cream, cake, tea, and coffee chains are Snack unless a stronger full-meal token also appears.
// - Bar/pub/lounge/cocktail/wine/beer are Drink even when food is also offered.
// - Market is See only for night/pasar-malam style destinations; generic mall/store/supermarket remains Shop.
// - Address-only matches are medium confidence because street/mall names can contain misleading tokens.
export const RULE_FAMILIES: RuleFamily[] = [
  {
    id: "drink.alcohol",
    category: "Drink",
    confidence: "high",
    terms: [
      "bar", "cocktail", "pub", "lounge", "speakeasy", "taproom", "brewery", "beer", "wine", "whisky",
      "whiskey", "gin", "sake", "izakaya", "nightclub", "night club", "bistro bar",
    ],
    reason: "alcohol or nightlife venue token",
  },
  {
    id: "food.meal",
    category: "Food",
    confidence: "high",
    terms: [
      "restaurant", "restoran", "kedai makan", "warung", "mamak", "gerai", "hawker", "food court",
      "cafe", "kopitiam", "kedai kopi", "coffee shop", "bistro", "brasserie", "diner", "kitchen",
      "nasi", "mee", "mie", "noodle", "laksa", "satay", "roti", "biryani", "banana leaf", "curry",
      "bak kut teh", "char kway teow", "yong tau foo", "steamboat", "hot pot", "dim sum", "dumpling",
      "seafood", "bbq", "grill", "burger", "pizza", "pasta", "sushi", "ramen", "udon", "tonkatsu",
      "茶餐室", "餐馆", "餐廳", "饭店", "飯店", "肉骨茶", "点心", "點心", "火锅", "火鍋", "小厨",
      "உணவகம்", "சாப்பாடு", "மாமக்",
    ],
    reason: "full-meal venue or meal dish token",
  },
  {
    id: "snack.sweets.bakery",
    category: "Snack",
    confidence: "high",
    terms: [
      "bakery", "bakeri", "patisserie", "pastry", "cake", "kek", "dessert", "ice cream", "gelato",
      "waffle", "crepe", "donut", "doughnut", "chocolate", "candy", "cendol", "ais kacang",
      "bubble tea", "boba", "milk tea", "teh tarik", "tea house", "juice", "smoothie", "kopi",
      "面包", "麵包", "蛋糕", "甜品", "甜点", "甜點", "冰淇淋", "奶茶", "茶室",
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
      "zoo", "aquarium", "theme park", "amusement", "resort", "hotel", "spa", "cinema", "theatre", "theater",
      "night market", "pasar malam", "botanical", "trail", "hiking", "reserve",
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
      "mall", "shopping", "store", "shop", "kedai", "market", "supermarket", "mart", "outlet", "boutique",
      "pharmacy", "florist", "bookstore", "souvenir", "gift", "jewellery", "jewelry", "fashion", "optical",
      "grocery", "convenience", "department store", "plaza", "retail",
      "商场", "商場", "购物", "購物", "超市", "药房", "藥房", "花店", "书店", "書店", "市场", "市場",
      "கடை", "சந்தை", "மருந்தகம்",
    ],
    reason: "retail or shopping token",
  },
];

const NOTE_LABELS: Array<{ category: AutoTagCategory; terms: string[] }> = [
  { category: "Drink", terms: ["bar", "cocktail", "pub", "beer", "wine", "drink", "drinks"] },
  { category: "Food", terms: ["dim sum", "ramen", "nasi", "mee", "laksa", "seafood", "restaurant", "dinner", "lunch", "breakfast", "meal", "food", "steamboat", "bak kut teh", "char kway teow", "yong tau foo", "roti"] },
  { category: "Snack", terms: ["butter", "cake", "bakery", "dessert", "ice cream", "coffee", "tea", "teh tarik", "boba", "bubble tea", "snack"] },
  { category: "See", terms: ["museum", "park", "view", "temple", "beach", "waterfall", "visited"] },
  { category: "Shop", terms: ["shop", "mall", "market", "buy", "store"] },
];

const NON_LABEL_NOTE_TERMS = [
  "visited", "go", "went", "try", "maybe", "done", "saved", "closed", "near", "with", "jasmine",
];

export function classifyPlaceByRules(input: RulePlaceInput): RuleClassification {
  const name = normalizeText(input.displayName ?? "");
  const label = normalizeText(input.placeLabel ?? "");
  const address = normalizeText(input.address ?? "");
  const nameLabel = [name, label].filter(Boolean).join(" ");

  for (const family of RULE_FAMILIES) {
    if (family.terms.some((term) => containsTerm(nameLabel, term))) {
      return {
        category: family.category,
        confidence: family.confidence,
        ruleId: family.id,
        reason: family.reason,
      };
    }
  }

  for (const family of RULE_FAMILIES) {
    if (family.terms.some((term) => containsTerm(address, term))) {
      return {
        category: family.category,
        confidence: "medium",
        ruleId: `${family.id}.address`,
        reason: `${family.reason} in address/label fallback`,
      };
    }
  }

  return {
    category: "Unsorted",
    confidence: "low",
    ruleId: "unsorted.low-confidence",
    reason: "no reliable rule token in display name, place label, or address",
  };
}

export function categoryFromFoodDescriptiveNote(note: string): AutoTagCategory | null {
  const normalized = normalizeText(note);
  if (!normalized || NON_LABEL_NOTE_TERMS.includes(normalized)) return null;

  for (const label of NOTE_LABELS) {
    if (label.terms.some((term) => containsTerm(normalized, term))) return label.category;
  }

  return null;
}
