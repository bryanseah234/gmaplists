import React, { useEffect, useMemo, useState } from "react";
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
const BATCH_SIZE = 10;

type QueueUiState = {
  categoryFilter: string;
  query: string;
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
    return {
      categoryFilter: categoryFilter === "All" || CATEGORY_LABELS.has(categoryFilter) ? categoryFilter : "All",
      query,
    };
  } catch {
    return { categoryFilter: "All", query: "" };
  }
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

function contextLine(place: Place): string {
  return [place.place_label, place.address, place.user_notes ? `Note: ${place.user_notes}` : null]
    .filter(Boolean)
    .join(" · ");
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
  const { categoryFilter, query } = queueState;

  useEffect(() => {
    setQueueState(loadQueueState(selectedListId));
    setRowErrors({});
  }, [selectedListId]);

  const selectedList = lists.find((list) => list.list_id === selectedListId);
  const remaining = places.filter((place) => !place.done);
  const doneCount = places.length - remaining.length;
  const progressPercent = places.length === 0 ? 0 : Math.round((doneCount / places.length) * 100);

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

  function updateQueueState(next: QueueUiState) {
    setQueueState(next);
    writeStorage(queueStorageKey(selectedListId), JSON.stringify(next));
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
    try {
      const unclassified = await loadUnclassifiedPlaces(scope === "current" ? selectedListId : undefined);
      await navigator.clipboard.writeText(buildClassificationPrompt(unclassified));
      setCopied(`prompt-${scope}`);
      window.setTimeout(() => setCopied(null), 1800);
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
    try {
      await saveClassifications(preview.accepted);
      setImportText("");
      setPreview(null);
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <section className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Google Maps list
            </label>
            <select
              value={selectedListId}
              onChange={(event) => onSelectList(event.target.value)}
              className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            >
              {lists.map((list) => (
                <option key={list.list_id} value={list.list_id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            <div className="font-semibold">{doneCount}/{places.length} done · {remaining.length} remain</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Last synced: {formatDate(selectedList?.last_synced ?? null)}</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <section className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Filter size={16} className="shrink-0 text-zinc-400" />
          {["All", ...CATEGORY_ORDER].map((category) => (
            <button
              key={category}
              onClick={() => updateQueueState({ ...queueState, categoryFilter: category })}
              className={`h-9 shrink-0 rounded-full px-3 text-sm font-semibold ${
                categoryFilter === category
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        <div className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 dark:border-zinc-800 dark:bg-zinc-950">
          <Search size={16} className="text-zinc-400" />
          <input
            value={query}
            onChange={(event) => updateQueueState({ ...queueState, query: event.target.value })}
            placeholder="Search this queue"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-950 outline-none dark:text-white"
          />
        </div>
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

      {CATEGORY_ORDER.map((category) => {
        const items = grouped[category].slice(0, BATCH_SIZE);
        if (categoryFilter !== "All" && categoryFilter !== category) return null;
        if (items.length === 0) return null;
        const label = CATEGORY_LABELS.get(category);

        return (
          <section key={category} className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="sticky top-12 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-sm font-bold text-zinc-950 dark:text-white">{label?.emoji} {category}</h2>
              <span className="text-xs font-semibold text-zinc-500">{grouped[category].length} remain · showing {items.length}</span>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {items.map((place) => {
                const featureId = place.feature_id;
                const isRowBusy = Boolean(featureId && rowBusy[featureId]);
                const rowError = featureId ? rowErrors[featureId] : rowErrors.missing;
                return (
                <article key={featureId ?? place.place_name} className="grid gap-2 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <a href={mapsLink(place)} target="_blank" rel="noreferrer" className="min-w-0 text-base font-semibold leading-snug text-zinc-950 underline-offset-2 hover:underline dark:text-white">
                      {place.place_name}
                    </a>
                    <a href={mapsLink(place)} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-zinc-200 p-2 text-zinc-500 dark:border-zinc-700 dark:text-zinc-300" title="Open in Google Maps">
                      <ExternalLink size={16} />
                    </a>
                  </div>
                  <p className="line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{contextLine(place) || "No extra context."}</p>
                  <div className="flex items-center justify-between gap-2">
                    <select
                      value={CATEGORY_LABELS.has(place.primary_category) ? place.primary_category : "Unsorted"}
                      disabled={isRowBusy}
                      onChange={(event) => runRowAction(featureId, "category", (id) => onCategoryChange(id, event.target.value as AutoTagCategory))}
                      className="h-10 min-w-0 flex-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 text-sm font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    >
                      {COLUMNS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <button
                      disabled={isRowBusy}
                      onClick={() => runRowAction(featureId, "done", (id) => onDoneChange(id, true))}
                      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
                    >
                      {isRowBusy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      {rowBusy[featureId ?? ""] === "done" ? "Saving" : "Done"}
                    </button>
                  </div>
                  {rowError && (
                    <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                      {rowError}
                    </p>
                  )}
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
            {remaining.length === 0 ? "All done for this list." : "No places match this filter."}
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {remaining.length === 0 ? "Switch lists or sync again when Google Maps changes." : "Clear search or switch category."}
          </p>
        </section>
      )}
    </div>
  );
};
