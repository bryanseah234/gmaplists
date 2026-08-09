import { beforeEach, describe, expect, it, vi } from "vitest";
import { Place } from "../../types";

type Row = Record<string, any>;

const mockDb = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: Row }>,
  tables: {
    lists: [] as Row[],
    places: [] as Row[],
    list_items: [] as Row[],
    classifications: [] as Row[],
    overrides: [] as Row[],
    progress: [] as Row[],
  },
}));

vi.mock("../supabaseClient", () => ({
  requireSupabase: () => createClient(),
}));

function createClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
    from: (table: keyof typeof mockDb.tables) => new Query(table),
    rpc: async (name: string, args: Row) => {
      mockDb.rpcCalls.push({ name, args });
      if (name !== "sync_gmaplist") {
        return { data: null, error: { code: "PGRST202", message: `Could not find function ${name} in schema cache` } };
      }
      return { data: [syncGmaplist(args)], error: null };
    },
  };
}

class Query {
  private filters: Array<(row: Row) => boolean> = [];
  private updateValues: Row | null = null;

  constructor(private table: keyof typeof mockDb.tables) {}

  select(_columns = "*") {
    return this;
  }

  order(_column: string, _options?: unknown) {
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  is(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  update(values: Row) {
    this.updateValues = values;
    return this;
  }

  async upsert(rows: Row | Row[], options?: { onConflict?: string; ignoreDuplicates?: boolean }) {
    const incoming = Array.isArray(rows) ? rows : [rows];
    const keys = (options?.onConflict ?? primaryKeyFor(this.table)).split(",").map((key) => key.trim());
    const table = mockDb.tables[this.table];

    for (const row of incoming) {
      const index = table.findIndex((existing) => keys.every((key) => existing[key] === row[key]));
      if (index >= 0) {
        if (!options?.ignoreDuplicates) table[index] = { ...table[index], ...row };
      } else {
        table.push({ ...row });
      }
    }

    return { data: null, error: null };
  }

  then(resolve: (value: { data: Row[] | null; error: null }) => void) {
    const table = mockDb.tables[this.table];
    if (this.updateValues) {
      for (const row of table) {
        if (this.filters.every((filter) => filter(row))) Object.assign(row, this.updateValues);
      }
      resolve({ data: null, error: null });
      return;
    }

    resolve({ data: table.filter((row) => this.filters.every((filter) => filter(row))).map((row) => ({ ...row })), error: null });
  }
}

function primaryKeyFor(table: keyof typeof mockDb.tables) {
  if (table === "list_items") return "list_id,feature_id";
  if (table === "progress") return "list_id,feature_id,user_id";
  if (table === "lists") return "list_id";
  return "feature_id";
}

function upsertRow(tableName: keyof typeof mockDb.tables, row: Row, keys: string[]) {
  const table = mockDb.tables[tableName];
  const index = table.findIndex((existing) => keys.every((key) => existing[key] === row[key]));
  if (index >= 0) table[index] = { ...table[index], ...row };
  else table.push({ ...row });
}

function syncGmaplist(args: Row) {
  const now = new Date().toISOString();
  const incoming = Array.isArray(args.p_places) ? args.p_places : [];
  const byFeatureId = new Map<string, Row>();
  for (const row of incoming) byFeatureId.set(row.feature_id, row);
  const places = [...byFeatureId.values()];

  upsertRow("lists", {
    list_id: args.p_list_id,
    name: args.p_list_name,
    last_synced: now,
  }, ["list_id"]);

  for (const row of places) {
    upsertRow("places", {
      feature_id: row.feature_id,
      name: row.name,
      place_label: row.place_label,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      note: row.note,
      last_synced: now,
    }, ["feature_id"]);
    upsertRow("list_items", {
      list_id: args.p_list_id,
      feature_id: row.feature_id,
      added_at: row.added_at,
      deleted_at: null,
    }, ["list_id", "feature_id"]);
  }

  const activeIds = new Set(places.map((row) => row.feature_id));
  let removedCount = 0;
  for (const item of mockDb.tables.list_items) {
    if (item.list_id === args.p_list_id && item.deleted_at === null && !activeIds.has(item.feature_id)) {
      item.deleted_at = now;
      removedCount += 1;
    }
  }

  return {
    place_count: incoming.length,
    unique_count: places.length,
    removed_count: removedCount,
  };
}

function place(featureId: string, name: string): Place {
  return {
    feature_id: featureId,
    place_name: name,
    place_label: `${name}, Kuala Lumpur`,
    address: "Kuala Lumpur",
    primary_category: "Unsorted",
    detailed_category: "Unknown",
    star_rating: 0,
    review_count: 0,
    is_override: false,
  };
}

describe("gmaplistStore resync behavior", () => {
  beforeEach(() => {
    mockDb.rpcCalls.length = 0;
    for (const table of Object.values(mockDb.tables)) table.length = 0;
  });

  it("keeps overrides and per-list done state when a place is removed and later reappears", async () => {
    const {
      loadPlacesForList,
      saveCategoryOverride,
      setProgressDone,
      syncListToSupabase,
    } = await import("../gmaplistStore");

    const list = { list_id: "list-malaysia", list_title: "Malaysia spots" };
    await syncListToSupabase({ ...list, places: [place("feature-a", "A Bar"), place("feature-b", "B Cafe")] });

    await saveCategoryOverride("feature-a", "Drink");
    await setProgressDone("list-malaysia", "feature-a", true);

    expect(await loadPlacesForList("list-malaysia")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        feature_id: "feature-a",
        primary_category: "Drink",
        detailed_category: "Manual override",
        is_override: true,
        done: true,
      }),
    ]));

    await syncListToSupabase({ ...list, places: [place("feature-b", "B Cafe")] });
    expect(mockDb.tables.list_items).toContainEqual(expect.objectContaining({
      list_id: "list-malaysia",
      feature_id: "feature-a",
      deleted_at: expect.any(String),
    }));
    expect(mockDb.tables.overrides).toContainEqual(expect.objectContaining({
      feature_id: "feature-a",
      category: "Drink",
    }));
    expect(mockDb.tables.progress).toContainEqual(expect.objectContaining({
      list_id: "list-malaysia",
      feature_id: "feature-a",
      user_id: "user-1",
      done: true,
    }));

    await syncListToSupabase({ ...list, places: [place("feature-a", "A Bar"), place("feature-b", "B Cafe")] });

    expect(mockDb.tables.list_items).toContainEqual(expect.objectContaining({
      list_id: "list-malaysia",
      feature_id: "feature-a",
      deleted_at: null,
    }));
    expect(await loadPlacesForList("list-malaysia")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        feature_id: "feature-a",
        primary_category: "Drink",
        detailed_category: "Manual override",
        is_override: true,
        done: true,
      }),
    ]));
  });

  it("uses bundled tags only as an initial classification seed and does not overwrite existing rows", async () => {
    const {
      loadPlacesForList,
      syncListToSupabase,
    } = await import("../gmaplistStore");
    const blackbyrdFeatureId = "3588304369080315123:8871540845564433213";

    mockDb.tables.classifications.push({
      feature_id: blackbyrdFeatureId,
      category: "Drink",
      confidence: "high",
      reason: "Existing reviewed classification",
      classified_at: "2026-01-01T00:00:00.000Z",
    });

    await syncListToSupabase({
      list_id: "list-malaysia",
      list_title: "Malaysia spots",
      places: [place(blackbyrdFeatureId, "Blackbyrd KL")],
    });

    expect(mockDb.tables.classifications).toContainEqual(expect.objectContaining({
      feature_id: blackbyrdFeatureId,
      category: "Drink",
      confidence: "high",
      reason: "Existing reviewed classification",
    }));
    expect(await loadPlacesForList("list-malaysia")).toEqual([
      expect.objectContaining({
        feature_id: blackbyrdFeatureId,
        primary_category: "Drink",
        detailed_category: "Classification (high)",
      }),
    ]);
  });

  it("dedupes repeated feature ids before sync upserts and keeps the last occurrence", async () => {
    const { syncListToSupabase, loadPlacesForList } = await import("../gmaplistStore");

    await syncListToSupabase({
      list_id: "list-malaysia",
      list_title: "Malaysia spots",
      places: [
        place("feature-a", "Old Name"),
        place("feature-b", "Other Place"),
        { ...place("feature-a", "New Name"), address: "Latest Address" },
      ],
    });

    expect(mockDb.tables.places.filter((row) => row.feature_id === "feature-a")).toHaveLength(1);
    expect(mockDb.tables.list_items.filter((row) => row.feature_id === "feature-a")).toHaveLength(1);
    expect(mockDb.tables.places).toContainEqual(expect.objectContaining({
      feature_id: "feature-a",
      name: "New Name",
      address: "Latest Address",
    }));
    expect(await loadPlacesForList("list-malaysia")).toEqual(expect.arrayContaining([
      expect.objectContaining({
        feature_id: "feature-a",
        place_name: "New Name",
      }),
    ]));
    expect(mockDb.rpcCalls).toContainEqual(expect.objectContaining({
      name: "sync_gmaplist",
    }));
  });

  it("refuses to sync any payload with places missing feature ids before writing", async () => {
    const { syncListToSupabase } = await import("../gmaplistStore");

    await expect(syncListToSupabase({
      list_id: "list-malaysia",
      list_title: "Malaysia spots",
      places: [
        place("feature-a", "A Bar"),
        { ...place("feature-missing", "Missing ID"), feature_id: undefined },
      ],
    })).rejects.toThrow("missing feature_id");

    expect(mockDb.tables.lists).toHaveLength(0);
    expect(mockDb.tables.places).toHaveLength(0);
    expect(mockDb.tables.list_items).toHaveLength(0);
  });

  it("warns before writing when incoming count differs sharply from the active list count", async () => {
    const { getSyncCountWarning, syncListToSupabase } = await import("../gmaplistStore");
    const list = { list_id: "list-malaysia", list_title: "Malaysia spots" };

    await syncListToSupabase({
      ...list,
      places: Array.from({ length: 100 }, (_, index) => place(`feature-${index}`, `Place ${index}`)),
    });

    const warning = await getSyncCountWarning({
      ...list,
      places: Array.from({ length: 140 }, (_, index) => place(`next-${index}`, `Next ${index}`)),
    });

    expect(warning).toEqual(expect.objectContaining({
      list_id: "list-malaysia",
      previous_count: 100,
      incoming_count: 140,
      incoming_unique_count: 140,
      duplicate_count: 0,
      percent_change: 40,
    }));
  });

  it("warns before an unusually large first sync when there is no previous count", async () => {
    const { getSyncCountWarning } = await import("../gmaplistStore");

    const warning = await getSyncCountWarning({
      list_id: "list-malaysia",
      list_title: "Malaysia spots",
      places: Array.from({ length: 501 }, (_, index) => place(`feature-${index}`, `Place ${index}`)),
    });

    expect(warning).toEqual(expect.objectContaining({
      list_id: "list-malaysia",
      previous_count: 0,
      incoming_count: 501,
      incoming_unique_count: 501,
      duplicate_count: 0,
      percent_change: 100,
    }));
  });
});
