import React, { useMemo } from "react";
import { DndContext, DragEndEvent, PointerSensor, TouchSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { Place, ExtractedData, COLUMNS } from "../types";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";

interface KanbanViewProps {
  data: ExtractedData;
  places: Place[];  // may have overrides already applied
  onCategoryChange: (placeName: string, newCategory: string) => void;
  newPlacesCount: number;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  data, places, onCategoryChange, newPlacesCount,
}) => {
  const [activeDrag, setActiveDrag] = React.useState<Place | null>(null);

  // Group places by primary_category
  const grouped = useMemo(() => {
    const map: Record<string, Place[]> = {};
    for (const col of COLUMNS) map[col.id] = [];
    for (const p of places) {
      const col = COLUMNS.find((c) => c.id === p.primary_category) ? p.primary_category : "Uncategorised";
      map[col].push(p);
    }
    return map;
  }, [places]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  );

  const handleDragStart = (event: any) => {
    const place = event.active.data.current?.place as Place | undefined;
    setActiveDrag(place ?? null);
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
          <span className="text-brand-500 dark:text-brand-400">added since your last import — check ❓ Uncategorised</span>
        </div>
      )}

      {/* Kanban board — horizontal scroll on mobile */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 items-start">
          {COLUMNS.map((col) => (
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

        {/* Drag overlay — floats under cursor while dragging */}
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

