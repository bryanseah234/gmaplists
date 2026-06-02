import React, { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Place } from "../types";
import { KanbanCard } from "./KanbanCard";
import { Copy, Check, ChevronDown, ChevronRight } from "lucide-react";

interface KanbanColumnProps {
  id: string;
  label: string;
  emoji: string;
  places: Place[];
  listTitle: string;
  onCategoryChange?: (placeName: string, newCategory: string) => void;
  /** Unsorted row — cards flow in a wrapping horizontal grid */
  horizontal?: boolean;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  id, label, emoji, places, listTitle, onCategoryChange, horizontal,
}) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = () => {
    const lines: string[] = [`📍 ${listTitle} — ${label} (${places.length} place${places.length !== 1 ? "s" : ""})
`];
    for (const p of places) {
      lines.push(p.place_name);
      lines.push(p.google_maps_link || `https://www.google.com/maps/search/${encodeURIComponent(p.place_name)}`);
      lines.push("");
    }
    const text = lines.join("\n").trim();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Column accent colours per category
  const accentMap: Record<string, string> = {
    Unsorted: "border-zinc-300 dark:border-zinc-700",
    Food:          "border-orange-300 dark:border-orange-700",
    Snack:         "border-pink-300 dark:border-pink-700",
    Drink:         "border-purple-300 dark:border-purple-700",
    See:           "border-blue-300 dark:border-blue-700",
    Shop:          "border-green-300 dark:border-green-700",
  };
  const headerMap: Record<string, string> = {
    Unsorted: "text-zinc-500 dark:text-zinc-400",
    Food:          "text-orange-600 dark:text-orange-400",
    Snack:         "text-pink-600 dark:text-pink-400",
    Drink:         "text-purple-600 dark:text-purple-400",
    See:           "text-blue-600 dark:text-blue-400",
    Shop:          "text-green-600 dark:text-green-400",
  };
  const dropBg: Record<string, string> = {
    Unsorted: "bg-zinc-50 dark:bg-zinc-900/50",
    Food:          "bg-orange-50 dark:bg-orange-950/20",
    Snack:         "bg-pink-50 dark:bg-pink-950/20",
    Drink:         "bg-purple-50 dark:bg-purple-950/20",
    See:           "bg-blue-50 dark:bg-blue-950/20",
    Shop:          "bg-green-50 dark:bg-green-950/20",
  };

  const accent = accentMap[id] ?? accentMap.Unsorted;
  const headerColor = headerMap[id] ?? headerMap.Unsorted;
  const bgColor = dropBg[id] ?? dropBg.Unsorted;

  return (
    <div className={`flex flex-col rounded-2xl border-2 transition-colors duration-150 ${horizontal ? "w-full" : "w-full"}
      ${isOver ? "border-brand-400 dark:border-brand-500" : accent}
      ${isOver ? "bg-brand-50 dark:bg-brand-950/20" : bgColor}
    `}>
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
        >
          {collapsed
            ? <ChevronRight size={14} className="flex-shrink-0 text-zinc-400" />
            : <ChevronDown size={14} className="flex-shrink-0 text-zinc-400" />
          }
          <span className="text-base leading-none">{emoji}</span>
          <span className={`text-sm font-semibold truncate ${headerColor}`}>{label}</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500 font-normal ml-0.5">
            {places.length}
          </span>
        </button>

        {/* Copy button */}
        {places.length > 0 && (
          <button
            onClick={handleCopy}
            title={`Copy ${places.length} places`}
            className={`flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all
              ${copied
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                : "bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400"
              }`}
          >
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
          </button>
        )}
      </div>

      {/* Drop zone / card list */}
      {!collapsed && (
        <div
          ref={setNodeRef}
          className={`${horizontal ? "flex flex-row flex-wrap gap-1.5" : "flex flex-col gap-1.5"} px-2 pb-3 min-h-[80px] transition-colors
            ${isOver ? "bg-brand-50/50 dark:bg-brand-950/10 rounded-xl" : ""}
          `}
        >
          {places.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-xs text-zinc-400 dark:text-zinc-600 italic">
              Drop here
            </div>
          ) : (
            places.map((place) => (
              <KanbanCard key={place.place_name} place={place} columnId={id} onCategoryChange={onCategoryChange} />
            ))
          )}
        </div>
      )}

      {/* Collapsed summary */}
      {collapsed && (
        <div className="px-3 pb-3 text-xs text-zinc-400 dark:text-zinc-500">
          {places.length} place{places.length !== 1 ? "s" : ""} — click to expand
        </div>
      )}
    </div>
  );
};



