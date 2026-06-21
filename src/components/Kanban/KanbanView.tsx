import React, { useMemo } from "react";
import {
  DndContext, DragEndEvent, PointerSensor, TouchSensor,
  useSensor, useSensors, DragOverlay,
} from "@dnd-kit/core";
import { Place, ExtractedData, COLUMNS } from "../../types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

interface KanbanViewProps {
  data: ExtractedData;
  places: Place[];
  onCategoryChange: (placeName: string, newCategory: string) => void;
  newPlacesCount: number;
}

const UNSORTED_COL = COLUMNS.find((c) => c.id === "Unsorted")!;
const CATEGORY_COLS = COLUMNS.filter((c) => c.id !== "Unsorted");

export const KanbanView: React.FC<KanbanViewProps> = ({
  data, places, onCategoryChange, newPlacesCount,
}) => {
  const [activeDrag, setActiveDrag] = React.useState<Place | null>(null);

  const grouped = useMemo(() => {
    const map: Record<string, Place[]> = {};
    for (const col of COLUMNS) map[col.id] = [];
    for (const p of places) {
      const key = COLUMNS.find((c) => c.id === p.primary_category)
        ? p.primary_category
        : "Unsorted";
      map[key].push(p);
    }
    // Sort each column alphabetically by place name
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.place_name.localeCompare(b.place_name));
    }
    return map;
  }, [places]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 12 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 12 } }),
  );

  const handleDragStart = (event: any) => {
    setActiveDrag(event.active.data.current?.place ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const place = active.data.current?.place as Place;
    const fromColumn = active.data.current?.fromColumn as string;
    const toColumn = over.id as string;
    if (!place || fromColumn === toColumn) return;
    onCategoryChange(place.place_name, toColumn);
  };

  return (
    <div className="flex flex-col gap-4 w-full">

      {/* New places banner */}
      {newPlacesCount > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-50 dark:bg-brand-950/30 border border-brand-200 dark:border-brand-800 text-sm text-brand-700 dark:text-brand-300">
          <span className="font-semibold">✨ {newPlacesCount} new place{newPlacesCount !== 1 ? "s" : ""}</span>
          <span className="text-brand-500 dark:text-brand-400">added since your last import — check ❓ Unsorted</span>
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>

        {/* Row 1 — Unsorted: full width, cards flow horizontally */}
        <KanbanColumn
          id={UNSORTED_COL.id}
          label={UNSORTED_COL.label}
          emoji={UNSORTED_COL.emoji}
          places={grouped[UNSORTED_COL.id] ?? []}
          listTitle={data.list_title}
          onCategoryChange={onCategoryChange}
          horizontal
        />

        {/* Row 2 — 5 category columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {CATEGORY_COLS.map((col) => (
            <KanbanColumn
              key={col.id}
              id={col.id}
              label={col.label}
              emoji={col.emoji}
              places={grouped[col.id] ?? []}
              listTitle={data.list_title}
              onCategoryChange={onCategoryChange}
            />
          ))}
        </div>

        <DragOverlay>
          {activeDrag ? (
            <div className="rotate-2 scale-105 shadow-2xl opacity-90">
              <KanbanCard place={activeDrag} columnId={activeDrag.primary_category} />
            </div>
          ) : null}
        </DragOverlay>

      </DndContext>
    </div>
  );
};
