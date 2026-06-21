/**
 * storageService.ts
 * Persists per-list category overrides to localStorage.
 * No backend required — all data stays on-device.
 *
 * Storage key: "gmaplist_v1"
 * Shape:
 *   {
 *     "<listId>": {
 *       list_title: string,
 *       last_synced: number,   // unix seconds
 *       place_count: number,
 *       overrides: { "<place_name>": "<primary_category>" }
 *     }
 *   }
 *
 * Lookup key = place_name (stable, human-readable).
 * Override wins over auto-categorisation on re-import.
 */

import { Place } from "../types";

const STORAGE_KEY = "gmaplist_v1";

export class StorageQuotaExceededError extends Error {
  constructor() {
    super("Storage limit exceeded. Unable to save list data. Please free up space by deleting older lists.");
    this.name = "StorageQuotaExceededError";
  }
}

export interface ListMeta {
  list_title: string;
  last_synced: number;
  place_count: number;
  overrides: Record<string, string>;
  /** Full places array saved on import for offline/refresh restore */
  places?: Place[];
  /** List source URL */
  list_source_url?: string;
}

function load(): Record<string, ListMeta> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function save(data: Record<string, ListMeta>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    throw new StorageQuotaExceededError();
  }
}

/** Save list metadata + full places after a fresh import. */
export function saveListMeta(
  listId: string,
  title: string,
  placeCount: number,
  places?: Place[],
  listSourceUrl?: string,
): void {
  if (!listId) return;
  const data = load();
  if (!data[listId]) {
    data[listId] = { list_title: title, last_synced: 0, place_count: 0, overrides: {} };
  }
  data[listId].list_title = title;
  data[listId].last_synced = Math.floor(Date.now() / 1000);
  data[listId].place_count = placeCount;
  if (places) data[listId].places = places;
  if (listSourceUrl) data[listId].list_source_url = listSourceUrl;
  save(data);
}

/** Restore a previously imported list from localStorage. Returns null if not found. */
export function restoreList(listId: string): { places: Place[]; list_title: string; list_source_url: string } | null {
  if (!listId) return null;
  const data = load();
  const meta = data[listId];
  if (!meta?.places?.length) return null;
  return {
    places: meta.places,
    list_title: meta.list_title,
    list_source_url: meta.list_source_url ?? '',
  };
}

/** Save a single manual override (user dragged a card). */
export function saveOverride(listId: string, placeName: string, newCategory: string): void {
  if (!listId || !placeName) return;
  const data = load();
  if (!data[listId]) {
    data[listId] = { list_title: "", last_synced: 0, place_count: 0, overrides: {} };
  }
  data[listId].overrides[placeName] = newCategory;
  save(data);
}

/** Remove a single override (e.g. if user drags back to auto-category). */
export function removeOverride(listId: string, placeName: string): void {
  if (!listId || !placeName) return;
  const data = load();
  if (data[listId]?.overrides) {
    delete data[listId].overrides[placeName];
    save(data);
  }
}

/** Get all overrides for a list. Returns {} if none saved. */
export function loadOverrides(listId: string): Record<string, string> {
  if (!listId) return {};
  const data = load();
  return data[listId]?.overrides ?? {};
}

/** Get list metadata (last import time, count). Returns null if never imported. */
export function getListMeta(listId: string): ListMeta | null {
  if (!listId) return null;
  const data = load();
  return data[listId] ?? null;
}

/**
 * Apply stored overrides to a places array.
 * Mutates is_override and primary_category in place (returns new array).
 * New places (not in overrides) keep their auto-categorisation.
 */
export function applyOverrides(places: Place[], overrides: Record<string, string>): Place[] {
  if (!overrides || Object.keys(overrides).length === 0) return places;
  return places.map((p) => {
    const override = overrides[p.place_name];
    if (override && override !== p.primary_category) {
      return { ...p, primary_category: override, is_override: true };
    }
    return p;
  });
}

/**
 * Count how many places are new since last import.
 * Uses added_at timestamp vs last_synced.
 */
export function countNewPlaces(places: Place[], listId: string): number {
  const meta = getListMeta(listId);
  if (!meta || !meta.last_synced) return 0;
  return places.filter(
    (p) => p.added_at != null && p.added_at > meta.last_synced
  ).length;
}

/** Clear all data for a specific list. */
export function clearListData(listId: string): void {
  if (!listId) return;
  const data = load();
  delete data[listId];
  save(data);
}
