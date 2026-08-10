import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Clipboard, ExternalLink, Filter, Loader2, Save, Search } from "lucide-react";
import { COLUMNS, ListSummary, Place } from "../../types";
import {
  buildClassificationPrompt,
  ClassificationPreview,
  loadUnclassifiedPlaces,
  previewClassificationImport,
  saveClassifications,
} from "../../services/gmaplistStore";
import { AutoTagCategory } from "../../services/categoryRules";
import { readStorage, writeStorage } from "../../services/browserStorage";

interface WorkQueueViewProps {
  lists: ListSummary[];
  selectedListId: string;
  places: Place[];
  onSelectList: (listId: string) => void;
  onDoneChange: (featureId: string, done: boolean) => Promise<void>;
  onCategoryChange: (featureId: string, category: AutoTagCategory) => Promise<void>;
  onRefresh: () => Promise<void>;
}

const CATEGORY_ORDER = COLUMNS.map((column) => column.id);
const CATEGORY_LABELS = new Map(COLUMNS.map((column) => [column.id, column]));
const BATCH_SIZE = 18;

type QueueUiState = {
  categoryFilter: string;
  query: string;
  currentFeatureId?: string;
};

function queueStorageKey(listId: string): string {
  return `gmaplist-queue:${listId || "none"}`;
}

function loadQueueState(listId: string): QueueUiState {
  const raw = readStorage(queueStorageKey(listId));
  if (!raw) return { categoryFilter: "All", query: "" };
  try {
    const parsed = JSON.parse(raw) as Partial<QueueUiState>;
    const categoryFilter = typeof parsed.categoryFilter === "string" ? parsed.categoryFilter : "All";
    const query = typeof parsed.query === "string" ? parsed.query : "";
    const currentFeatureId = typeof parsed.currentFeatureId === "string" ? parsed.currentFeatureId : undefined;
    return {
      categoryFilter: categoryFilter === "All" || CATEGORY_LABELS.has(categoryFilter) ? categoryFilter : "All",
      query,
      currentFeatureId,
    };
  } catch {
    return { categoryFilter: "All", query: "" };
  }
}

function placeElementId(featureId: string): string {
  return `place-${featureId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function mapsLink(place: Place): string {
  if (place.google_maps_link) return place.google_maps_link;
  const query = [place.place_name, place.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

function formatDate(value: string | null): string {
  if (!value) return "Never synced";
  return new Date(value).toLocaleString();
}

function detailLine(place: Place): string {
  const details = [
    place.star_rating ? `${place.star_rating.toFixed(1)} stars` : null,
    place.review_count ? `${place.review_count.toLocaleString()} reviews` : null,
    place.price_level,
  ].filter(Boolean);
  return details.length > 0 ? details.join(" · ") : "";
}

function sourceLabel(place: Place): string {
  if (place.is_override) return "Manual";
  if (place.detailed_category.startsWith("Classification")) return "Saved";
  if (place.detailed_category.startsWith("Rule:")) return "Rules";
  return "Unsorted";
}

function categoryClass(category: string): string {
  switch (category) {
    case "Drink":
      return "bg-rose-600 text-white";
    case "Food":
      return "bg-orange-600 text-white";
    case "Snack":
      return "bg-amber-500 text-zinc-950";
    case "Shop":
      return "bg-sky-600 text-white";
    case "See":
      return "bg-emerald-600 text-white";
    default:
      return "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-950";
  }
}

export const WorkQueueView: React.FC<WorkQueueViewProps> = ({
  lists,
  selectedListId,
  places,
  onSelectList,
  onDoneChange,
  onCategoryChange,
  onRefresh,
}) => {
  const [queueState, setQueueState] = useState<QueueUiState>(() => loadQueueState(selectedListId));
  const [copied, setCopied] = useState<string | null>(null);
  const [importText, setImportText] = useState("");
  const [importScope, setImportScope] = useState<"current" | "all">("current");
  const [preview, setPreview] = useState<ClassificationPreview | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [rowBusy, setRowBusy] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const lastScrolledFeatureId = useRef<string | null>(null);
  const { categoryFilter, query } = queueState;

  useEffect(() => {
    setQueueState(loadQueueState(selectedListId));
    setRowErrors({});
  }, [selectedListId]);

  const selectedList = lists.find((list) => list.list_id === selectedListId);
  const remaining = places.filter((place) => !place.done);
  const doneCount = places.length - remaining.length;
  const progressPercent = places.length === 0 ? 0 : Math.round((doneCount / places.length) * 100);
  const countsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const category of CATEGORY_ORDER) counts[category] = 0;
    for (const place of remaining) {
      const category = CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted";
      counts[category] = (counts[category] ?? 0) + 1;
    }
    return counts;
  }, [remaining]);

  const visiblePlaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return remaining.filter((place) => {
      const category = CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted";
      if (categoryFilter !== "All" && category !== categoryFilter) return false;
      if (!needle) return true;
      return [place.place_name, place.address, place.place_label, place.user_notes, place.primary_category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [remaining, categoryFilter, query]);

  const grouped = useMemo(() => {
    const map: Record<string, Place[]> = {};
    for (const category of CATEGORY_ORDER) map[category] = [];
    for (const place of visiblePlaces) {
      const category = CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted";
      map[category].push(place);
    }
    return map;
  }, [visiblePlaces]);
  const hasVisibleWork = visiblePlaces.length > 0;
  const shownNow = CATEGORY_ORDER.reduce((total, category) => total + Math.min(grouped[category].length, BATCH_SIZE), 0);

  useEffect(() => {
    const featureId = queueState.currentFeatureId;
    if (!featureId || lastScrolledFeatureId.current === featureId) return;
    if (!visiblePlaces.some((place) => place.feature_id === featureId)) return;
    window.setTimeout(() => {
      document.getElementById(placeElementId(featureId))?.scrollIntoView({ block: "center" });
      lastScrolledFeatureId.current = featureId;
    }, 80);
  }, [queueState.currentFeatureId, visiblePlaces]);

  function updateQueueState(next: QueueUiState) {
    setQueueState(next);
    writeStorage(queueStorageKey(selectedListId), JSON.stringify(next));
  }

  function markCurrentPlace(featureId?: string) {
    if (!featureId) return;
    updateQueueState({ ...queueState, currentFeatureId: featureId });
  }

  async function runRowAction(featureId: string | undefined, label: string, action: (id: string) => Promise<void>) {
    if (!featureId) {
      setRowErrors((prev) => ({ ...prev, missing: "This place is missing feature_id and cannot be saved." }));
      return;
    }
    setRowBusy((prev) => ({ ...prev, [featureId]: label }));
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[featureId];
      return next;
    });
    try {
      await action(featureId);
    } catch (error) {
      setRowErrors((prev) => ({
        ...prev,
        [featureId]: error instanceof Error ? error.message : String(error),
      }));
    } finally {
      setRowBusy((prev) => {
        const next = { ...prev };
        delete next[featureId];
        return next;
      });
    }
  }

  async function copyPrompt(scope: "current" | "all") {
    setBusy(`prompt-${scope}`);
    setImportError(null);
    try {
      const unclassified = await loadUnclassifiedPlaces(scope === "current" ? selectedListId : undefined);
      if (unclassified.length === 0) {
        setCopied(null);
        setImportError(scope === "current" ? "No unclassified places in this list." : "No unclassified places across any synced list.");
        return;
      }
      await navigator.clipboard.writeText(buildClassificationPrompt(unclassified));
      setCopied(`prompt-${scope}`);
      window.setTimeout(() => setCopied(null), 1800);
    } catch (error) {
      setCopied(null);
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function previewImport() {
    setBusy("preview");
    setImportError(null);
    try {
      const allowed = await loadUnclassifiedPlaces(importScope === "current" ? selectedListId : undefined);
      setPreview(await previewClassificationImport(importText, allowed));
    } catch (error) {
      setPreview(null);
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  async function savePreview() {
    if (!preview?.accepted.length) return;
    setBusy("save");
    setImportError(null);
    try {
      await saveClassifications(preview.accepted);
      setImportText("");
      setPreview(null);
      await onRefresh();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-4 pb-20 lg:grid-cols-[292px_minmax(0,1fr)]">
      <aside className="grid gap-3 self-start lg:sticky lg:top-16">
      <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-zinc-950 dark:text-white">{selectedList?.name ?? "Google Maps list"}</p>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] font-bold text-zinc-600 dark:text-zinc-300">
              <span className="rounded-full bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">{doneCount}/{places.length} tagged</span>
              <span className="rounded-full bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">{remaining.length} left</span>
              <span className="rounded-full bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">{shownNow} visible</span>
              <span className="rounded-full bg-zinc-50 px-2 py-1 ring-1 ring-zinc-200 dark:bg-zinc-950 dark:ring-zinc-800">{selectedList?.unclassified_count ?? 0} uncategorised</span>
            </div>
          </div>
          <select
            value={selectedListId}
            onChange={(event) => onSelectList(event.target.value)}
            className="h-10 w-full shrink-0 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-950 md:w-56 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            aria-label="Google Maps list"
          >
            {lists.map((list) => (
              <option key={list.list_id} value={list.list_id}>
                {list.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
          <Filter size={16} className="shrink-0 text-zinc-400" />
          {["All", ...CATEGORY_ORDER].map((category) => {
            const count = category === "All" ? remaining.length : countsByCategory[category] ?? 0;
            return (
              <button
                key={category}
                onClick={() => updateQueueState({ ...queueState, categoryFilter: category })}
                className={`flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold ${
                  categoryFilter === category
                    ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                    : "bg-white text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800"
                }`}
              >
                <span>{category}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  categoryFilter === category
                    ? "bg-white/20 text-current dark:bg-zinc-950/10"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex h-11 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Search size={16} className="text-zinc-400" />
          <input
            value={query}
            onChange={(event) => updateQueueState({ ...queueState, query: event.target.value })}
            placeholder="Search this queue"
            className="min-w-0 flex-1 bg-transparent text-base text-zinc-950 outline-none dark:text-white"
          />
        </div>
        <p className="mt-2 text-[11px] font-medium leading-relaxed text-zinc-500 dark:text-zinc-500">
          Last synced: {formatDate(selectedList?.last_synced ?? null)}. Google rating, reviews, and Google category are not in this saved-list payload.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <button
          onClick={() => setShowImportPanel((value) => !value)}
          className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left"
        >
          <span>
            <span className="block text-sm font-semibold text-zinc-950 dark:text-white">Unclassified prompt</span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">Copy-paste classification tools</span>
          </span>
          {showImportPanel ? <ChevronDown size={16} className="text-zinc-400" /> : <ChevronRight size={16} className="text-zinc-400" />}
        </button>
        {showImportPanel && (
          <div className="grid gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => copyPrompt("current")} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                {busy === "prompt-current" ? <Loader2 size={14} className="animate-spin" /> : <Clipboard size={14} />}
                {copied === "prompt-current" ? "Copied" : "Current list"}
              </button>
              <button onClick={() => copyPrompt("all")} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                {busy === "prompt-all" ? <Loader2 size={14} className="animate-spin" /> : <Clipboard size={14} />}
                {copied === "prompt-all" ? "Copied" : "All lists"}
              </button>
            </div>
            <div className="flex gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              <label><input type="radio" checked={importScope === "current"} onChange={() => setImportScope("current")} /> Current list</label>
              <label><input type="radio" checked={importScope === "all"} onChange={() => setImportScope("all")} /> All lists</label>
            </div>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder="Paste strict JSON here to preview before saving"
              className="min-h-28 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-950 outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            />
            <div className="flex flex-wrap gap-2">
              <button onClick={previewImport} disabled={!importText.trim() || busy === "preview"} className="inline-flex h-11 items-center gap-1.5 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-zinc-950">
                {busy === "preview" ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                Preview import
              </button>
              <button onClick={savePreview} disabled={!preview?.accepted.length || busy === "save"} className="inline-flex h-11 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50">
                {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save accepted
              </button>
            </div>
            {preview && (
              <div className="grid gap-1 rounded-md bg-zinc-50 p-2 text-xs dark:bg-zinc-950">
                <div className="font-semibold text-zinc-900 dark:text-white">{preview.accepted.length} accepted, {preview.rejected.length} rejected</div>
                {preview.rejected.slice(0, 5).map((item, index) => (
                  <div key={`${item.feature_id ?? "entry"}-${index}`} className="text-red-600 dark:text-red-300">
                    {item.feature_id ?? "entry"}: {item.reason}
                  </div>
                ))}
              </div>
            )}
            {importError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {importError}
              </div>
            )}
          </div>
        )}
      </section>
      </aside>

      <main className="min-w-0 space-y-3">

      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category].slice(0, BATCH_SIZE);
        if (categoryFilter !== "All" && categoryFilter !== category) return null;
        if (items.length === 0) return null;
        const label = CATEGORY_LABELS.get(category);

        return (
          <section key={category} className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-black text-zinc-950 dark:text-white">{category}</h2>
              <span className="text-xs font-semibold text-zinc-500">{grouped[category].length} remain · showing {items.length}</span>
            </div>
            <div className="grid gap-2 p-2">
              {items.map((place) => {
                const featureId = place.feature_id;
                const isRowBusy = Boolean(featureId && rowBusy[featureId]);
                const rowError = featureId ? rowErrors[featureId] : rowErrors.missing;
                return (
                <article
                  key={featureId ?? place.place_name}
                  id={featureId ? placeElementId(featureId) : undefined}
                  className={`grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_260px] md:items-start ${
                    featureId && queueState.currentFeatureId === featureId
                      ? "border-blue-400 bg-blue-50 shadow-sm dark:border-blue-600 dark:bg-blue-950/30"
                      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950"
                  }`}
                >
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <a onClick={() => markCurrentPlace(featureId)} href={mapsLink(place)} target="_blank" rel="noreferrer" className="min-w-0 text-base font-black leading-tight text-zinc-950 underline-offset-2 hover:underline dark:text-white">
                        {place.place_name || "Unnamed place"}
                      </a>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${categoryClass(category)}`}>
                        {category}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">
                      {place.address || place.place_label || "No address captured"}
                    </p>
                    {place.user_notes && (
                      <p className="line-clamp-2 rounded-md bg-white px-2 py-1 text-xs font-semibold text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800">
                        Note: {place.user_notes}
                      </p>
                    )}
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-500">
                      {sourceLabel(place)} suggestion · {place.resolved_confidence ?? "low"} confidence{detailLine(place) ? ` · ${detailLine(place)}` : ""}
                    </p>
                    {place.resolved_reason && (
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-500">{place.resolved_reason}</p>
                    )}
                  </div>
                  <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <a onClick={() => markCurrentPlace(featureId)} href={mapsLink(place)} target="_blank" rel="noreferrer" className="inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 text-sm font-black text-white shadow-sm" title="Open in Google Maps">
                        <ExternalLink size={16} />
                        Open Maps
                      </a>
                      <button
                        disabled={isRowBusy}
                        onClick={() => runRowAction(featureId, "tagged", (id) => onDoneChange(id, true))}
                        className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-black text-white shadow-sm disabled:cursor-wait disabled:opacity-60"
                      >
                        {isRowBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                        {rowBusy[featureId ?? ""] === "tagged" ? "Saving" : "Tagged in Maps"}
                      </button>
                    </div>
                    <select
                      value={CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted"}
                      disabled={isRowBusy}
                      onChange={(event) => runRowAction(featureId, "category", (id) => onCategoryChange(id, event.target.value as AutoTagCategory))}
                      className="h-10 min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-sm font-bold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      aria-label={`Change category for ${place.place_name}`}
                    >
                      {COLUMNS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    {rowError && (
                      <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                        {rowError}
                      </p>
                    )}
                  </div>
                </article>
                );
              })}
            </div>
          </section>
        );
      })}

      {!hasVisibleWork && (
        <section className="rounded-lg border border-zinc-200 bg-white p-5 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm font-bold text-zinc-950 dark:text-white">
            {remaining.length === 0 ? "All tagged for this list." : "No places match this filter."}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {remaining.length === 0 ? "Switch lists or sync again when Google Maps changes." : "Clear search or switch category."}
          </p>
        </section>
      )}
      </main>
    </div>
  );
};
