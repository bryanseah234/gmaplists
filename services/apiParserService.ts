import { ExtractedData, Place, UIConfig } from "../types";

/**
 * Parses the structured JSON payload returned by the getlist internal API.
 * Called when the user pastes JSON (not pipe-separated DOM text).
 *
 * Response shape (after stripping ")]}'\n" prefix):
 *   root[0][0][5]  = list title
 *   root[0][2]     = places array (each item is a place entry)
 *     place[2]     = place name string
 *     place[3]     = user note string (e.g. "Visited", "")
 *     place[1][7]  = /g/ path for Maps link
 */

const CATEGORIES: Record<string, string[]> = {
  Drink: [
    "bar","cocktail","pub","brewery","wine","izakaya","club","speakeasy","lounge","taproom",
    "beverage","nightclub","disco","biergarten","cider","whisky","sake","distillery","tavern",
    "gastropub","vodka","tequila","rum","beer","drink","pocha","mezcal","whiskey"
  ],
  See: [
    "park","garden","nature","hiking","trail","beach","island","view","lookout","scenic",
    "waterfall","museum","gallery","art","historic","landmark","monument","castle","palace",
    "fort","temple","church","cathedral","mosque","shrine","chapel","monastery","pagoda",
    "memorial","heritage","ruin","attraction","theater","theatre","cinema","stadium","arena",
    "amusement","theme park","water park","spa","wellness","massage","hotel","motel","hostel",
    "resort","inn","lodge","skywalk","sentosa","zoo","aquarium","observatory"
  ],
  Shop: [
    "mall","store","market","plaza","boutique","shop","outlet","mart","supermarket","grocery",
    "retail","dealer","supplier","bakery","patisserie","cake","pastry","butcher","deli",
    "chocolate","fashion","clothing","shoe","apparel","jewelry","electronics","music store",
    "book","stationery","gift","sport","toy","hobby","souvenir","antique","cosmetic",
    "salon","hair","barber","beauty","nail","tattoo","grocer","superstore"
  ],
};

function detectCategory(name: string, note: string): { primary: string; detailed: string } {
  const combined = (name + " " + note).toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORIES)) {
    for (const kw of keywords) {
      if (combined.includes(kw)) {
        return { primary: cat, detailed: kw.charAt(0).toUpperCase() + kw.slice(1) };
      }
    }
  }
  return { primary: "Food", detailed: "Restaurant" };
}

function buildMapsLink(entry: any[]): string {
  try {
    const loc = entry[1];
    if (!loc) return "";
    const gPath = loc[7];
    if (gPath && typeof gPath === "string" && gPath.startsWith("/g/")) {
      return `https://www.google.com/maps${gPath}`;
    }
    const name = entry[2] ?? "";
    const lat = loc[5]?.[2];
    const lon = loc[5]?.[3];
    if (lat && lon) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    }
  } catch {}
  return "";
}

export function parseApiJson(raw: string): ExtractedData {
  const stripped = raw.replace(/^\)\]\}'\s*\n?/, "");
  const root = JSON.parse(stripped) as any[];

  const listMeta = root[0]?.[0] ?? [];
  const listTitle: string = listMeta[5] ?? "Saved Places";
  const listId: string = listMeta[0] ?? "";
  const listUrl = listId
    ? `https://www.google.com/maps/placelists/list/${listId}`
    : "https://www.google.com/maps/saved";

  const placesRaw: any[] = root[0]?.[2] ?? [];
  const places: Place[] = [];
  const seen = new Set<string>();

  for (const entry of placesRaw) {
    if (!Array.isArray(entry)) continue;
    const name: string = entry[2];
    if (!name || typeof name !== "string") continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const userNote: string = entry[3] ?? "";
    const { primary, detailed } = detectCategory(name, userNote);

    places.push({
      place_name: name,
      primary_category: primary,
      detailed_category: detailed,
      star_rating: 0,
      review_count: 0,
      price_range: "",
      price_range_code: 0,
      user_notes: userNote || undefined,
      google_maps_link: buildMapsLink(entry),
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

