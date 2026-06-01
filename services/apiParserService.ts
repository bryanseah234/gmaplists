import { ExtractedData, Place, UIConfig } from "../types";

/**
 * Parses the raw JSON from the Google Maps getlist internal API.
 * Strip ")]}'" prefix before calling, or pass raw — we strip here.
 *
 * Confirmed field map (from live network capture):
 *   data[0][0][0]  = list ID
 *   data[0][4]     = list title (string)
 *   data[0][8]     = places array (up to 500 per page)
 *   data[1]        = next-page cursor (string, absent on last page)
 *
 *   Per place entry p = data[0][8][i]:
 *     p[2]        = place name
 *     p[3]        = user note (e.g. "Visited", "")
 *     p[1][2]     = full address
 *     p[1][4]     = short address
 *     p[1][5]     = [null, null, lat, lon]
 *     p[1][7]     = /g/ path (e.g. "/g/11btvg9hby") for Maps link
 *     p[12]       = added_by: [name, avatarUrl, userId]
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
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
    }
  } catch {}
  return "";
}

export function parseApiJson(raw: string): ExtractedData {
  const stripped = raw.replace(/^\)\]\}['"]\s*\n?/, "");
  const root = JSON.parse(stripped) as any[];

  const d0 = root[0] ?? [];
  const listId: string = d0[0]?.[0] ?? "";
  const listTitle: string = typeof d0[4] === "string" ? d0[4] : "Saved Places";
  const listUrl = listId
    ? `https://www.google.com/maps/placelists/list/${listId}`
    : "https://www.google.com/maps/saved";

  // Places are at data[0][8] — confirmed from live response
  const placesRaw: any[] = Array.isArray(d0[8]) ? d0[8] : [];
  const places: Place[] = [];
  const seen = new Set<string>();

  for (const p of placesRaw) {
    if (!Array.isArray(p)) continue;
    const name: string = p[2];
    if (!name || typeof name !== "string") continue;
    if (seen.has(name)) continue;
    seen.add(name);

    const userNote: string = typeof p[3] === "string" ? p[3] : "";
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
      google_maps_link: buildMapsLink(p),
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
