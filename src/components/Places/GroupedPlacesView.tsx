import React, { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, Link as LinkIcon, Search, Sparkles } from "lucide-react";
import { COLUMNS, ExtractedData, Place } from "../../types";

interface GroupedPlacesViewProps {
  data: ExtractedData;
  places: Place[];
  onCategoryChange: (placeName: string, newCategory: string) => void;
  newPlacesCount: number;
}

const CATEGORY_ORDER = COLUMNS.map((column) => column.id);
const CATEGORY_LABELS = new Map(COLUMNS.map((column) => [column.id, column]));

function fallbackMapsLink(place: Place): string {
  if (place.google_maps_link) return place.google_maps_link;
  const query = [place.place_name, place.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function formatPlaceLine(place: Place): string {
  return `${place.place_name}\n${fallbackMapsLink(place)}`;
}

function buildGroupedText(listTitle: string, grouped: Record<string, Place[]>): string {
  const lines = [`${listTitle}`, ""];

  for (const category of CATEGORY_ORDER) {
    const items = grouped[category] ?? [];
    if (items.length === 0) continue;

    lines.push(`${category} (${items.length})`);
    for (const place of items) {
      lines.push(`- ${place.place_name}`);
      lines.push(`  ${fallbackMapsLink(place)}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function buildGeminiPrompt(data: ExtractedData, places: Place[]): string {
  const lines = [
    "You are a Google Maps place-sorting assistant.",
    "Sort the places below into exactly these groups: Food, Snack, Drink, See, Shop, Unsorted.",
    "",
    "Important workflow:",
    "Return only the first 20 places in your first reply, because the user will paste the result into Telegram and long messages may be cut off.",
    "After exactly 20 places, stop and write only: Reply \"Next\" for the next 20.",
    "When the user replies \"Okay\" or \"Next\", continue with the next 20 places from where you stopped.",
    "Do not restart, do not repeat earlier places, and do not skip any places.",
    "",
    "Research and classification rules:",
    "Use web search when the place name, address, or Google Maps link is ambiguous.",
    "Treat the Current Maps label as a weak hint only. It can be wrong.",
    "If the place name/address clearly indicates a retail business, classify it as Shop even if the Maps label suggests food/snack/see.",
    "If unsure after checking, put it in Unsorted instead of guessing.",
    "",
    "Output rules:",
    "Return a human-readable sorted list only. No explanation, no tables, no JSON.",
    "In each reply, use group headings in this fixed order when that group has places: Food, Snack, Drink, See, Shop, Unsorted.",
    "Under each heading, list places exactly as: - Place name — Google Maps link",
    "Keep the exact Google Maps links. Do not invent, rewrite, shorten, or remove tracking/query parameters.",
    "Each place must appear under exactly one group.",
    "",
    "Category meaning:",
    "Food = full meals, restaurants, hawker stalls, cafes used mainly for meals.",
    "Snack = coffee, bakery, dessert, bubble tea, ice cream, juice, smoothies, light bites.",
    "Drink = alcohol-focused bars, pubs, cocktails, breweries, wine bars, nightlife.",
    "See = attractions, museums, parks, temples, landmarks, hotels, campuses, experiences.",
    "Shop = retail stores, malls, markets, groceries, pharmacies, bag shops, homewares, fashion, lifestyle stores.",
    "Unsorted = unclear after checking.",
    "",
    "Examples:",
    "- A bag shop, luggage store, homewares store, or fashion boutique => Shop.",
    "- A cocktail bar, wine bar, pub, brewery, or nightclub => Drink.",
    "- A bubble tea shop, coffee-only place, bakery, or dessert shop => Snack.",
    "- A restaurant, ramen shop, hawker stall, or meal-focused cafe => Food.",
    "- A museum, campus, hotel, temple, park, or attraction => See.",
    "",
    `List: ${data.list_title}`,
    "",
    "Places:",
  ];

  places.forEach((place, index) => {
    const facts = [
      `${index + 1}. ${place.place_name}`,
      `Google Maps: ${fallbackMapsLink(place)}`,
      place.address ? `Address: ${place.address}` : null,
      place.detailed_category && place.detailed_category !== "Unknown"
        ? `Current Maps label: ${place.detailed_category}`
        : null,
    ].filter(Boolean);

    lines.push(facts.join("\n"));
    lines.push("");
  });

  return lines.join("\n").trim();
}

function placeSearchText(place: Place): string {
  return [
    place.place_name,
    place.primary_category,
    place.detailed_category,
    place.address,
    place.user_notes,
  ].filter(Boolean).join(" ").toLowerCase();
}

export const GroupedPlacesView: React.FC<GroupedPlacesViewProps> = ({
  data,
  places,
  onCategoryChange,
  newPlacesCount,
}) => {
  const [query, setQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filteredPlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return places;
    return places.filter((place) => placeSearchText(place).includes(needle));
  }, [places, query]);

  const grouped = useMemo(() => {
    const map: Record<string, Place[]> = {};
    for (const category of CATEGORY_ORDER) map[category] = [];

    for (const place of filteredPlaces) {
      const category = CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted";
      map[category].push(place);
    }

    for (const category of CATEGORY_ORDER) {
      map[category].sort((a, b) => a.place_name.localeCompare(b.place_name));
    }

    return map;
  }, [filteredPlaces]);

  const copyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    });
  };

  const copyAll = () => copyText("all", buildGroupedText(data.list_title, grouped));
  const copyPrompt = () => copyText("prompt", buildGeminiPrompt(data, places));
  const linkedCount = places.filter((place) => Boolean(place.google_maps_link)).length;
  const unsortedCount = grouped.Unsorted?.length ?? 0;
  const hasCollapsedGroups = CATEGORY_ORDER.some((category) => collapsed[category]);
  const setAllCollapsed = (value: boolean) => {
    setCollapsed(Object.fromEntries(CATEGORY_ORDER.map((category) => [category, value])));
  };

  return (
    <div className="w-full space-y-4">
      {newPlacesCount > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
          {newPlacesCount} new place{newPlacesCount !== 1 ? "s" : ""} since the last import.
        </div>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-zinc-950 dark:text-white">
              {data.list_title}
            </h1>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{places.length} places</span>
              <span>{linkedCount} links</span>
              <span>{unsortedCount} unsorted</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              onClick={copyPrompt}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
            >
              {copiedKey === "prompt" ? <Check size={15} /> : <Sparkles size={15} />}
              {copiedKey === "prompt" ? "Prompt copied" : "Copy Gemini prompt"}
            </button>
            <button
              onClick={copyAll}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 transition hover:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-500"
            >
              {copiedKey === "all" ? <Check size={15} /> : <Copy size={15} />}
              {copiedKey === "all" ? "Grouped list copied" : "Copy grouped links"}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
            <Search size={16} className="text-zinc-400" />
            <input
              value={query}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              placeholder="Search places, labels, addresses"
              className="w-full bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white"
            />
          </div>
          <button
            onClick={() => setAllCollapsed(!hasCollapsedGroups)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
          >
            {hasCollapsedGroups ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
            {hasCollapsedGroups ? "Expand all" : "Collapse all"}
          </button>
        </div>
      </section>

      <div className="space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const column = CATEGORY_LABELS.get(category);
          const items = grouped[category] ?? [];

          return (
            <section
              key={category}
              className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <button
                  onClick={() => setCollapsed((current) => ({ ...current, [category]: !current[category] }))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {collapsed[category]
                    ? <ChevronRight size={15} className="shrink-0 text-zinc-400" />
                    : <ChevronDown size={15} className="shrink-0 text-zinc-400" />
                  }
                  <span className="text-base leading-none">{column?.emoji}</span>
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{column?.label ?? category}</h2>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {items.length}
                  </span>
                </button>

                <button
                  disabled={items.length === 0}
                  onClick={() => copyText(category, buildGroupedText(data.list_title, { [category]: items }))}
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
                >
                  {copiedKey === category ? <Check size={13} /> : <Copy size={13} />}
                  {copiedKey === category ? "Copied" : "Copy"}
                </button>
              </div>

              {collapsed[category] ? (
                <div className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">
                  {items.length} place{items.length !== 1 ? "s" : ""} hidden.
                </div>
              ) : items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
                  No places.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {items.map((place) => {
                    const mapsLink = fallbackMapsLink(place);

                    return (
                      <div
                        key={place.place_name}
                        className="flex min-h-[150px] flex-col justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/60 dark:hover:border-zinc-600"
                      >
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-start gap-2">
                            <a
                              href={mapsLink}
                              target="_blank"
                              rel="noreferrer"
                              className="min-w-0 truncate text-sm font-semibold text-zinc-950 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-white dark:hover:text-zinc-300"
                            >
                              {place.place_name}
                            </a>
                            <a
                              href={mapsLink}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                              title="Open in Google Maps"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                            <span>{place.detailed_category || "Unknown"}</span>
                            {place.address && <span className="line-clamp-2">{place.address}</span>}
                            {place.price_level && <span>{place.price_level}</span>}
                            {place.star_rating > 0 && <span>{place.star_rating} stars</span>}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                          <select
                            value={CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted"}
                            onChange={(event: React.ChangeEvent<HTMLSelectElement>) =>
                              onCategoryChange(place.place_name, event.target.value)
                            }
                            className="h-9 min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-800 outline-none transition focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                          >
                            {COLUMNS.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.label}
                              </option>
                            ))}
                          </select>

                          <button
                            onClick={() => copyText(place.place_name, formatPlaceLine(place))}
                            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
                          >
                            {copiedKey === place.place_name ? <Check size={13} /> : <LinkIcon size={13} />}
                            {copiedKey === place.place_name ? "Copied" : "Link"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
