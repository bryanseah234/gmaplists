import { ExtractedData, Place, UIConfig } from "../types";
import { resolveAutoTag } from "./autoTagService";
import { assertContributorProfilesStrippedFromGetlist, stripContributorProfilesFromGetlist } from "./privacy";

export function flattenAndFind(array: any[], predicate: (val: any) => boolean): any {
  const visit = (value: any): any => {
    if (predicate(value)) return value;

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = visit(item);
        if (found !== undefined) return found;
      }
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) {
        const found = visit(item);
        if (found !== undefined) return found;
      }
    }

    return undefined;
  };

  return visit(array);
}

const PLACE_ID_PATTERN = /^ChIJ/;
const PHONE_PATTERN = /\+\d{1,3}\s\d+/;

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

function normalizePriceLevel(value: unknown): string | undefined {
  if (typeof value === "number" && value > 0) {
    return "$".repeat(Math.min(Math.floor(value), 4));
  }

  if (typeof value === "string") {
    const dollars = value.match(/\${1,4}/)?.[0];
    if (dollars) return dollars;

    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) {
      return "$".repeat(Math.min(Math.floor(numeric), 4));
    }

    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }

  return undefined;
}

function isExternalWebsite(value: any): value is string {
  if (typeof value !== "string") return false;

  const candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate)) return false;

  try {
    const host = new URL(candidate).hostname.replace(/^www\./, "").toLowerCase();
    return !(
      host === "google.com" ||
      host.endsWith(".google.com") ||
      host === "gstatic.com" ||
      host.endsWith(".gstatic.com") ||
      host === "googleusercontent.com" ||
      host.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

function isPhone(value: any): value is string {
  return typeof value === "string" && PHONE_PATTERN.test(value.replace(/\s+/g, " "));
}

function isPlaceId(value: any): value is string {
  return typeof value === "string" && PLACE_ID_PATTERN.test(value);
}

function isGoogleMapsUrl(value: any): value is string {
  if (typeof value !== "string") return false;

  const candidate = value.trim();
  if (!/^https?:\/\//i.test(candidate)) return false;

  try {
    const url = new URL(candidate);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    return (host === "google.com" || host.endsWith(".google.com")) && url.pathname.includes("/maps");
  } catch {
    return false;
  }
}

function isLat(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isLng(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function findCoordinatePair(roots: any[]): { lat?: number; lng?: number } {
  const pair = flattenAndFind(roots, (value) =>
    Array.isArray(value) && isLat(value[2]) && isLng(value[3])
  );

  return Array.isArray(pair) ? { lat: pair[2], lng: pair[3] } : {};
}

function pickAddress(place: any[], meta: Record<string, unknown>, placeName: string): string | undefined {
  const candidates = [
    meta.__address,
    meta.address,
    place?.[1]?.[4],
    place?.[1]?.[2],
  ];

  return candidates
    .map(asString)
    .find((value) => value && value.toLowerCase() !== placeName.toLowerCase());
}

function pickBusinessStatus(roots: any[]): string | undefined {
  const knownStatus = flattenAndFind(roots, (value) =>
    typeof value === "string" &&
    /^(CLOSED|OPERATIONAL|CLOSED_TEMPORARILY|CLOSED_PERMANENTLY|PERMANENTLY_CLOSED|TEMPORARILY_CLOSED)$/i.test(value)
  );

  return asString(knownStatus);
}

function featureIdFromListPlace(place: any[]): string | undefined {
  const ids = place?.[1]?.[6] ?? place?.[8]?.[1];
  if (!Array.isArray(ids) || ids.length < 2) return undefined;

  const first = asString(ids[0]) ?? (typeof ids[0] === "number" ? String(ids[0]) : undefined);
  const second = asString(ids[1]) ?? (typeof ids[1] === "number" ? String(ids[1]) : undefined);
  return first && second ? `${first}:${second}` : undefined;
}

function buildMapsLink(p: any[], googlePlaceId?: string, rawMapsLink?: string, lat?: number, lng?: number, address?: string): string {
  try {
    if (googlePlaceId) {
      return "https://www.google.com/maps/search/?api=1&query_place_id=" + encodeURIComponent(googlePlaceId);
    }

    if (rawMapsLink) {
      return rawMapsLink;
    }

    const loc = p[1];
    if (!loc) return "";
    const fallbackLat = lat ?? loc[5]?.[2];
    const fallbackLng = lng ?? loc[5]?.[3];
    const query = [p[2], address].filter(Boolean).join(" ");
    if (fallbackLat != null && fallbackLng != null) {
      return "https://www.google.com/maps/search/" + encodeURIComponent(query) + "/@" + fallbackLat + "," + fallbackLng + ",17z";
    }
    return query ? "https://www.google.com/maps/search/" + encodeURIComponent(query) : "";
  } catch { return ""; }
}

export function parseApiJson(raw: string, meta?: any[]): ExtractedData {
  const body = raw.replace(/^\)\]\}'\n?/, "");
  let data: any;
  try { data = JSON.parse(body); } catch { data = raw; }
  if (data && data.type === "GMAPLIST_DATA") data = data.data;
  data = stripContributorProfilesFromGetlist(data);
  assertContributorProfilesStrippedFromGetlist(data);

  const listTitle: string = data?.[0]?.[4] ?? "My List";
  const listUrl: string = data?.[0]?.[2]?.[2] ?? "";
  const listId: string = data?.[0]?.[0]?.[0] ?? "";
  const rawPlaces: any[] = data?.[0]?.[8] ?? [];
  const metaArr: any[] = meta ?? [];

  const places: Place[] = [];

  for (let i = 0; i < rawPlaces.length; i++) {
    const p = rawPlaces[i];
    if (!Array.isArray(p) || typeof p[2] !== "string" || !p[2]) continue;

    const placeMeta: Record<string, unknown> = metaArr[i] ?? {};
    const name: string = p[2];
    const userNote: string = p[3] ?? "";
    const searchRoots = [placeMeta, p];

    const hexPlaceId: string = asString(placeMeta.__hexId) ?? "";
    const rating: number = asNumber(placeMeta.__rating) ?? 0;
    const reviews: number = asNumber(placeMeta.__reviews) ?? 0;
    const coordinates = findCoordinatePair(searchRoots);
    const lat = asNumber(placeMeta.__lat) ?? asNumber(placeMeta.lat) ?? asNumber(p?.[1]?.[5]?.[2]) ?? coordinates.lat;
    const lng = asNumber(placeMeta.__lng) ?? asNumber(placeMeta.lng) ?? asNumber(p?.[1]?.[5]?.[3]) ?? coordinates.lng;
    const priceLevel = normalizePriceLevel(placeMeta.__price ?? placeMeta.price_level);
    const website = flattenAndFind(searchRoots, isExternalWebsite);
    const googlePlaceId = flattenAndFind(searchRoots, isPlaceId);
    const rawMapsLink = asString(placeMeta.__mapsUrl) ?? flattenAndFind(searchRoots, isGoogleMapsUrl);
    const phone = flattenAndFind(searchRoots, isPhone);
    const placeLabel = asString(p?.[1]?.[2]);
    const address = pickAddress(p, placeMeta, name);
    const businessStatus = asString(placeMeta.__businessStatus) ?? asString(placeMeta.business_status) ?? pickBusinessStatus(searchRoots);
    const featureId = featureIdFromListPlace(p);
    const tag = resolveAutoTag({
      place_name: name,
      place_label: placeLabel,
      address,
      user_notes: userNote || undefined,
      feature_id: featureId,
    });

    const addedAt: number | undefined =
      Array.isArray(p[9]) && typeof p[9][0] === "number" ? p[9][0] : undefined;

    places.push({
      place_name: name,
      primary_category: tag.category,
      detailed_category: tag.detailedCategory,
      star_rating: rating,
      review_count: reviews,
      user_notes: userNote || undefined,
      google_maps_link: buildMapsLink(p, googlePlaceId, rawMapsLink, lat, lng, address),
      price_level: priceLevel,
      lat,
      lng,
      address,
      place_label: placeLabel,
      phone,
      website,
      google_place_id: googlePlaceId,
      business_status: businessStatus,
      hex_place_id: hexPlaceId || undefined,
      feature_id: featureId,
      added_at: addedAt,
      is_override: false,
    });
  }

  return {
    list_title: listTitle,
    list_source_url: listUrl,
    list_id: listId,
    ui_config: buildUIConfig(places),
    places,
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
