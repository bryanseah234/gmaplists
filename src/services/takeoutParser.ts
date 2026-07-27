import { ExtractedData, Place, UIConfig } from "../types";

interface TakeoutFeatureCollection {
  type: "FeatureCollection";
  features: TakeoutFeature[];
}

interface TakeoutFeature {
  type?: "Feature";
  geometry?: {
    type?: string;
    coordinates?: unknown[];
  };
  properties?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function validLat(value: unknown): number | undefined {
  const numberValue = asNumber(value);
  return numberValue != null && numberValue >= -90 && numberValue <= 90 ? numberValue : undefined;
}

function validLng(value: unknown): number | undefined {
  const numberValue = asNumber(value);
  return numberValue != null && numberValue >= -180 && numberValue <= 180 ? numberValue : undefined;
}

function fnv1a64(input: string): string {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;

  for (let i = 0; i < input.length; i++) {
    hash ^= BigInt(input.charCodeAt(i));
    hash = (hash * prime) & mask;
  }

  return hash.toString(16).padStart(16, "0");
}

function deterministicHexPlaceId(seed: string): string {
  return `0x${fnv1a64(seed)}:0x${fnv1a64(`${seed}:gmaplists`)}`;
}

function getLocation(properties: Record<string, unknown>): Record<string, unknown> | undefined {
  const location = properties.Location ?? properties.location;
  if (Array.isArray(location)) return location.find(isRecord);
  return isRecord(location) ? location : undefined;
}

function getGoogleMapsUrl(properties: Record<string, unknown>): string | undefined {
  return (
    asString(properties["Google Maps URL"]) ??
    asString(properties.google_maps_url) ??
    asString(properties.googleMapsUrl)
  );
}

function getPlaceName(
  properties: Record<string, unknown>,
  location: Record<string, unknown> | undefined,
  fallbackIndex: number,
): string {
  return (
    asString(location?.["Business Name"]) ??
    asString(location?.BusinessName) ??
    asString(location?.Name) ??
    asString(location?.name) ??
    asString(properties.Title) ??
    asString(properties.title) ??
    asString(properties.name) ??
    `Unknown Place ${fallbackIndex + 1}`
  );
}

function getAddress(
  properties: Record<string, unknown>,
  location: Record<string, unknown> | undefined,
): string | undefined {
  return (
    asString(location?.Address) ??
    asString(location?.address) ??
    asString(properties.Address) ??
    asString(properties.address)
  );
}

function getGooglePlaceId(url: string | undefined): string | undefined {
  return url?.match(/ChIJ[^/?&#]+/)?.[0];
}

function buildUIConfig(places: Place[]): UIConfig {
  const cats = [...new Set(places.map((place) => place.primary_category))].sort();
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

export function parseTakeoutPlaces(rawJson: string): Place[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error("Invalid Google Takeout JSON file.");
  }

  if (!isRecord(parsed) || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    throw new Error("Expected a GeoJSON FeatureCollection from Google Takeout.");
  }

  const collection = parsed as unknown as TakeoutFeatureCollection;
  const places = collection.features.map((feature, index): Place | null => {
    const properties = feature.properties ?? {};
    const location = getLocation(properties);
    const coordinates = feature.geometry?.coordinates ?? [];
    const lng = validLng(coordinates[0]);
    const lat = validLat(coordinates[1]);
    const googleMapsUrl = getGoogleMapsUrl(properties);
    const placeName = getPlaceName(properties, location, index);
    const address = getAddress(properties, location);
    const hashSeed = googleMapsUrl ?? (lat != null && lng != null ? `${lng},${lat}` : placeName);

    return {
      place_name: placeName,
      primary_category: "Unsorted",
      detailed_category: "Google Takeout",
      star_rating: 0,
      review_count: 0,
      user_notes: undefined,
      google_maps_link: googleMapsUrl,
      price_level: undefined,
      lat,
      lng,
      address,
      phone: undefined,
      website: undefined,
      google_place_id: getGooglePlaceId(googleMapsUrl),
      business_status: undefined,
      added_at: undefined,
      hex_place_id: deterministicHexPlaceId(hashSeed),
      is_override: false,
      list_id: undefined,
    };
  }).filter((place): place is Place => place !== null);

  const seen = new Set<string>();
  return places.filter((place) => {
    const key = place.hex_place_id ?? place.google_maps_link ?? `${place.place_name}|${place.lat}|${place.lng}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseTakeoutJson(rawJson: string, sourceName = "Saved Places.json"): ExtractedData {
  const places = parseTakeoutPlaces(rawJson);
  const baseTitle = sourceName.replace(/\.json$/i, "").trim() || "Google Takeout Saved Places";
  const listId = `takeout-${fnv1a64(rawJson).slice(0, 12)}`;

  return {
    list_title: baseTitle,
    list_source_url: "",
    list_id: listId,
    ui_config: buildUIConfig(places),
    places: places.map((place) => ({ ...place, list_id: listId })),
  };
}
