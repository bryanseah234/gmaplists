import bundledTags from "../data/tags.json";
import { ListSummary, Place } from "../types";
import { AutoTagCategory, AutoTagConfidence, classifyPlaceByRules } from "./categoryRules";
import { assertPlaceRecordsContainNoContributorData } from "./privacy";
import { requireSupabase } from "./supabaseClient";

const CATEGORIES: AutoTagCategory[] = ["Food", "Snack", "Drink", "See", "Shop", "Unsorted"];
const CONFIDENCES: AutoTagConfidence[] = ["high", "medium", "low"];
const BATCH_SIZE = 100;

type DbClassification = {
  feature_id: string;
  category: AutoTagCategory;
  confidence: AutoTagConfidence;
  reason: string;
};

type StaticTagValue = Omit<DbClassification, "feature_id">;

type DbOverride = {
  feature_id: string;
  category: AutoTagCategory;
};

type DbProgress = {
  list_id: string;
  feature_id: string;
  done: boolean;
  done_at: string | null;
};

export type ClassificationInput = {
  feature_id: string;
  category: AutoTagCategory;
  confidence: AutoTagConfidence;
  reason: string;
};

export type ClassificationPreview = {
  accepted: ClassificationInput[];
  rejected: Array<{ feature_id?: string; reason: string }>;
};

export type SyncCountWarning = {
  list_id: string;
  list_title: string;
  previous_count: number;
  incoming_count: number;
  incoming_unique_count: number;
  duplicate_count: number;
  percent_change: number;
};

const staticTags = bundledTags as unknown as Record<string, StaticTagValue>;

function chunk<T>(items: T[], size = BATCH_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function requireSignedInUserId(): Promise<string> {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error("Sign in before syncing or saving.");
  return data.user.id;
}

async function selectByIds<T>(table: string, ids: string[], columns = "*"): Promise<T[]> {
  const client = requireSupabase();
  const rows: T[] = [];
  for (const idsChunk of chunk(ids)) {
    const { data, error } = await client.from(table).select(columns).in("feature_id", idsChunk);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

function toPlaceRow(place: Place) {
  if (!place.feature_id) throw new Error(`Place "${place.place_name}" has no feature_id.`);
  return {
    feature_id: place.feature_id,
    name: place.place_name,
    place_label: place.place_label ?? null,
    address: place.address ?? null,
    lat: place.lat ?? null,
    lng: place.lng ?? null,
    note: place.user_notes ?? null,
    last_synced: new Date().toISOString(),
  };
}

function dedupePlacesByFeatureId(places: Place[]): Place[] {
  const byFeatureId = new Map<string, Place>();
  for (const place of places) {
    if (!place.feature_id) continue;
    byFeatureId.set(place.feature_id, place);
  }
  return [...byFeatureId.values()];
}

function dedupeClassificationsByFeatureId(rows: ClassificationInput[]): ClassificationInput[] {
  const byFeatureId = new Map<string, ClassificationInput>();
  for (const row of rows) byFeatureId.set(row.feature_id, row);
  return [...byFeatureId.values()];
}

function shouldWarnAboutCount(previousCount: number, incomingCount: number): boolean {
  if (previousCount === 0) return incomingCount > 500;
  const absoluteDelta = Math.abs(incomingCount - previousCount);
  const percentChange = absoluteDelta / previousCount;
  return absoluteDelta >= 25 && percentChange >= 0.25;
}

function resolveCategory(
  place: Place,
  classification?: DbClassification,
  override?: DbOverride,
  progress?: DbProgress,
): Place {
  if (override) {
    return {
      ...place,
      primary_category: override.category,
      detailed_category: "Manual override",
      is_override: true,
      done: progress?.done ?? false,
      done_at: progress?.done_at ?? undefined,
      resolved_confidence: "high",
      resolved_reason: "Manual correction",
    };
  }

  if (classification) {
    return {
      ...place,
      primary_category: classification.category,
      detailed_category: `Classification (${classification.confidence})`,
      is_override: false,
      done: progress?.done ?? false,
      done_at: progress?.done_at ?? undefined,
      resolved_confidence: classification.confidence,
      resolved_reason: classification.reason,
    };
  }

  const rule = classifyPlaceByRules({
    displayName: place.place_name,
    placeLabel: place.place_label,
    address: place.address,
    userNote: place.user_notes,
  });

  return {
    ...place,
    primary_category: rule.category,
    detailed_category: rule.category === "Unsorted" ? "Unknown" : `Rule: ${rule.ruleId}`,
    is_override: false,
    done: progress?.done ?? false,
    done_at: progress?.done_at ?? undefined,
    resolved_confidence: rule.confidence,
    resolved_reason: rule.reason,
  };
}

export async function syncListToSupabase(data: { list_id: string; list_title: string; places: Place[] }): Promise<void> {
  await requireSignedInUserId();
  const client = requireSupabase();
  const now = new Date().toISOString();
  const places = dedupePlacesByFeatureId(data.places);

  const placeRows = places.map(toPlaceRow);
  assertPlaceRecordsContainNoContributorData(placeRows);

  const { error: listError } = await client.from("lists").upsert({
    list_id: data.list_id,
    name: data.list_title,
    last_synced: now,
  }, { onConflict: "list_id" });
  if (listError) throw listError;

  for (const rows of chunk(placeRows)) {
    const { error } = await client.from("places").upsert(rows, { onConflict: "feature_id" });
    if (error) throw error;
  }

  const listItems = places.map((place) => ({
    list_id: data.list_id,
    feature_id: place.feature_id!,
    added_at: place.added_at ?? null,
    deleted_at: null,
  }));

  for (const rows of chunk(listItems)) {
    const { error } = await client.from("list_items").upsert(rows, { onConflict: "list_id,feature_id" });
    if (error) throw error;
  }

  const { data: existingItems, error: existingError } = await client
    .from("list_items")
    .select("feature_id")
    .eq("list_id", data.list_id)
    .is("deleted_at", null);
  if (existingError) throw existingError;

  const currentIds = new Set(places.map((place) => place.feature_id));
  const removedIds = (existingItems ?? [])
    .map((row) => row.feature_id as string)
    .filter((featureId) => !currentIds.has(featureId));

  for (const ids of chunk(removedIds)) {
    const { error } = await client
      .from("list_items")
      .update({ deleted_at: now })
      .eq("list_id", data.list_id)
      .in("feature_id", ids);
    if (error) throw error;
  }

  const seedClassifications = places
    .map((place) => {
      const tag = place.feature_id ? staticTags[place.feature_id] : undefined;
      return tag && tag.category !== "Unsorted" ? { featureId: place.feature_id!, tag } : undefined;
    })
    .filter((entry): entry is { featureId: string; tag: StaticTagValue } => Boolean(entry))
    .map(({ featureId, tag }) => ({
      feature_id: featureId,
      category: tag.category,
      confidence: tag.confidence,
      reason: tag.reason,
      classified_at: now,
    }));

  for (const rows of chunk(seedClassifications)) {
    const { error } = await client.from("classifications").upsert(rows, { onConflict: "feature_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

export async function getSyncCountWarning(data: { list_id: string; list_title: string; places: Place[] }): Promise<SyncCountWarning | null> {
  await requireSignedInUserId();
  const client = requireSupabase();
  const { data: existingItems, error } = await client
    .from("list_items")
    .select("feature_id")
    .eq("list_id", data.list_id)
    .is("deleted_at", null);
  if (error) throw error;

  const incomingPlaces = data.places.filter((place) => place.feature_id);
  const incomingUniqueCount = dedupePlacesByFeatureId(data.places).length;
  const previousCount = existingItems?.length ?? 0;
  if (!shouldWarnAboutCount(previousCount, incomingPlaces.length)) return null;

  return {
    list_id: data.list_id,
    list_title: data.list_title,
    previous_count: previousCount,
    incoming_count: incomingPlaces.length,
    incoming_unique_count: incomingUniqueCount,
    duplicate_count: incomingPlaces.length - incomingUniqueCount,
    percent_change: previousCount === 0
      ? 100
      : Math.round((Math.abs(incomingPlaces.length - previousCount) / previousCount) * 100),
  };
}

export async function loadListSummaries(): Promise<ListSummary[]> {
  await requireSignedInUserId();
  const client = requireSupabase();
  const [{ data: lists, error: listsError }, { data: items, error: itemsError }, { data: progress, error: progressError }, { data: classifications, error: classError }] = await Promise.all([
    client.from("lists").select("list_id,name,last_synced").order("last_synced", { ascending: false }),
    client.from("list_items").select("list_id,feature_id,deleted_at").is("deleted_at", null),
    client.from("progress").select("list_id,feature_id,done"),
    client.from("classifications").select("feature_id,category"),
  ]);
  if (listsError) throw listsError;
  if (itemsError) throw itemsError;
  if (progressError) throw progressError;
  if (classError) throw classError;

  const classified = new Set((classifications ?? []).map((row) => row.feature_id as string));
  const done = new Set((progress ?? []).filter((row) => row.done).map((row) => `${row.list_id}:${row.feature_id}`));

  return (lists ?? []).map((list) => {
    const listItems = (items ?? []).filter((item) => item.list_id === list.list_id);
    const doneCount = listItems.filter((item) => done.has(`${item.list_id}:${item.feature_id}`)).length;
    const unclassifiedCount = listItems.filter((item) => !classified.has(item.feature_id as string)).length;
    return {
      list_id: list.list_id as string,
      name: list.name as string,
      last_synced: list.last_synced as string | null,
      total_count: listItems.length,
      done_count: doneCount,
      remaining_count: listItems.length - doneCount,
      unclassified_count: unclassifiedCount,
    };
  });
}

export async function loadPlacesForList(listId: string): Promise<Place[]> {
  await requireSignedInUserId();
  const client = requireSupabase();
  const { data: items, error: itemsError } = await client
    .from("list_items")
    .select("feature_id,added_at")
    .eq("list_id", listId)
    .is("deleted_at", null);
  if (itemsError) throw itemsError;

  const featureIds = (items ?? []).map((item) => item.feature_id as string);
  if (featureIds.length === 0) return [];

  const [places, classifications, overrides, progressRows] = await Promise.all([
    selectByIds<any>("places", featureIds, "feature_id,name,place_label,address,lat,lng,note"),
    selectByIds<DbClassification>("classifications", featureIds, "feature_id,category,confidence,reason"),
    selectByIds<DbOverride>("overrides", featureIds, "feature_id,category"),
    selectByIds<DbProgress>("progress", featureIds, "list_id,feature_id,done,done_at"),
  ]);

  const itemById = new Map((items ?? []).map((item) => [item.feature_id as string, item]));
  const classificationById = new Map(classifications.map((row) => [row.feature_id, row]));
  const overrideById = new Map(overrides.map((row) => [row.feature_id, row]));
  const progressById = new Map(progressRows.filter((row) => row.list_id === listId).map((row) => [row.feature_id, row]));

  return places
    .map((row) => {
      const place: Place = {
        feature_id: row.feature_id,
        place_name: row.name,
        place_label: row.place_label ?? undefined,
        address: row.address ?? undefined,
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
        user_notes: row.note ?? undefined,
        google_maps_link: buildMapsLink(row.name, row.address, row.lat, row.lng),
        primary_category: "Unsorted",
        detailed_category: "Unknown",
        star_rating: 0,
        review_count: 0,
        added_at: itemById.get(row.feature_id)?.added_at ?? undefined,
        is_override: false,
      };
      return resolveCategory(place, classificationById.get(row.feature_id), overrideById.get(row.feature_id), progressById.get(row.feature_id));
    })
    .sort((a, b) => a.place_name.localeCompare(b.place_name));
}

export async function setProgressDone(listId: string, featureId: string, done: boolean): Promise<void> {
  const userId = await requireSignedInUserId();
  const client = requireSupabase();
  const { error } = await client.from("progress").upsert({
    list_id: listId,
    feature_id: featureId,
    user_id: userId,
    done,
    done_at: done ? new Date().toISOString() : null,
  }, { onConflict: "list_id,feature_id,user_id" });
  if (error) throw error;
}

export async function saveCategoryOverride(featureId: string, category: AutoTagCategory): Promise<void> {
  const userId = await requireSignedInUserId();
  const client = requireSupabase();
  const { error } = await client.from("overrides").upsert({
    feature_id: featureId,
    category,
    user_id: userId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "feature_id" });
  if (error) throw error;
}

export async function loadUnclassifiedPlaces(scopeListId?: string): Promise<Place[]> {
  await requireSignedInUserId();
  const client = requireSupabase();
  const { data: classifiedRows, error: classifiedError } = await client.from("classifications").select("feature_id");
  if (classifiedError) throw classifiedError;
  const classified = new Set((classifiedRows ?? []).map((row) => row.feature_id as string));

  const itemQuery = client.from("list_items").select("list_id,feature_id").is("deleted_at", null);
  const { data: items, error: itemsError } = scopeListId ? await itemQuery.eq("list_id", scopeListId) : await itemQuery;
  if (itemsError) throw itemsError;

  const ids = [...new Set((items ?? []).map((row) => row.feature_id as string).filter((id) => !classified.has(id)))];
  if (ids.length === 0) return [];

  const places = await selectByIds<any>("places", ids, "feature_id,name,place_label,address,lat,lng,note");
  return places.map((row) => ({
    feature_id: row.feature_id,
    place_name: row.name,
    place_label: row.place_label ?? undefined,
    address: row.address ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    user_notes: row.note ?? undefined,
    google_maps_link: buildMapsLink(row.name, row.address, row.lat, row.lng),
    primary_category: "Unsorted",
    detailed_category: "Unknown",
    star_rating: 0,
    review_count: 0,
    is_override: false,
  })).sort((a, b) => a.place_name.localeCompare(b.place_name));
}

export async function previewClassificationImport(rawText: string, allowedPlaces: Place[]): Promise<ClassificationPreview> {
  const allowedIds = allowedPlaces.map((place) => place.feature_id).filter((id): id is string => Boolean(id));
  const allowed = new Set(allowedIds);
  const overrides = await selectByIds<DbOverride>("overrides", [...allowed], "feature_id,category");
  const overrideIds = new Set(overrides.map((row) => row.feature_id));
  const parsed = parseClassificationJson(rawText);
  const accepted: ClassificationInput[] = [];
  const rejected: Array<{ feature_id?: string; reason: string }> = [];

  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      rejected.push({ reason: "Entry is not an object." });
      continue;
    }

    const featureId = typeof item.feature_id === "string" ? item.feature_id : "";
    const category = item.category as AutoTagCategory;
    const confidence = item.confidence as AutoTagConfidence;
    const reason = typeof item.reason === "string" ? item.reason.trim() : "";

    if (!allowed.has(featureId)) rejected.push({ feature_id: featureId, reason: "feature_id is not in the current unclassified set." });
    else if (overrideIds.has(featureId)) rejected.push({ feature_id: featureId, reason: "feature_id has a manual override and will not be overwritten." });
    else if (!CATEGORIES.includes(category)) rejected.push({ feature_id: featureId, reason: "Unknown category." });
    else if (!CONFIDENCES.includes(confidence)) rejected.push({ feature_id: featureId, reason: "Unknown confidence." });
    else if (!reason) rejected.push({ feature_id: featureId, reason: "Missing reason." });
    else accepted.push({ feature_id: featureId, category, confidence, reason });
  }

  return { accepted, rejected };
}

export async function saveClassifications(rows: ClassificationInput[]): Promise<void> {
  await requireSignedInUserId();
  const client = requireSupabase();
  const now = new Date().toISOString();
  for (const batch of chunk(dedupeClassificationsByFeatureId(rows))) {
    const { error } = await client.from("classifications").upsert(batch.map((row) => ({
      ...row,
      classified_at: now,
    })), { onConflict: "feature_id" });
    if (error) throw error;
  }
}

export function buildClassificationPrompt(places: Place[]): string {
  const lines = [
    "You are helping classify places from my collaborative Google Maps saved lists.",
    "Return strict JSON only: an array of objects with feature_id, category, confidence, reason.",
    "Allowed categories: Food, Snack, Drink, See, Shop, Unsorted.",
    "Allowed confidence: high, medium, low.",
    "",
    "Authoritative category definitions:",
    "- Food: Full meals. Any cuisine.",
    "- Drink: Places serving ALCOHOL, such as bars and clubs. Food places that also serve alcohol are Food, not Drink.",
    "- Snack: Places not serving full meals, such as coffee shops, tea shops, bakeries and roadside stores.",
    "- Shop: Places to buy material goods.",
    "- See: Places of interest not fitting the other four.",
    "",
    "Do not force a guess. Use Unsorted with low confidence when unsure.",
    "Do not invent feature_id values. Use exactly the feature_id values below.",
    "",
    "Places:",
    JSON.stringify(places.map((place) => ({
      feature_id: place.feature_id,
      name: place.place_name,
      place_label: place.place_label ?? null,
      address: place.address ?? null,
      note: place.user_notes ?? null,
    })), null, 2),
  ];

  return lines.join("\n");
}

function parseClassificationJson(text: string): any[] {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fenced?.[1]?.trim() ?? trimmed;
  const parsed = JSON.parse(jsonText);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed?.classifications)) return parsed.classifications;
  throw new Error("Expected a JSON array or an object with a classifications array.");
}

function buildMapsLink(name: string, address?: string | null, lat?: number | null, lng?: number | null): string {
  const query = [name, address].filter(Boolean).join(" ");
  if (lat != null && lng != null) {
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${lat},${lng},17z`;
  }
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}
