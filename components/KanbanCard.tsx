import React, { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Place } from '../types';
import { ExternalLink, GripVertical, Pencil, Star, MoreHorizontal } from 'lucide-react';
import { MoveSheet } from './MoveSheet';

interface KanbanCardProps {
  place: Place;
  columnId: string;
  onCategoryChange?: (placeName: string, newCategory: string) => void;
}

const KanbanCardInner: React.FC<KanbanCardProps> = ({ place, columnId, onCategoryChange }) => {
  const [showSheet, setShowSheet] = useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: place.place_name,
    data: { place, fromColumn: columnId },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    touchAction: 'none',
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`group flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-all duration-150 cursor-default select-none
          bg-white dark:bg-zinc-900
          border-zinc-200 dark:border-zinc-800
          hover:border-brand-300 dark:hover:border-brand-700
          hover:shadow-sm
          ${isDragging ? 'shadow-xl z-50' : ''}
        `}
      >
        {/* Drag handle — desktop */}
        <div
          {...listeners}
          {...attributes}
          className="mt-0.5 flex-shrink-0 text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-grab active:cursor-grabbing hidden sm:flex"
          title="Drag to move"
        >
          <GripVertical size={14} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Name + open link */}
          <div className="flex items-start justify-between gap-1">
            <a
              href={place.google_maps_link || '#'}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-zinc-900 dark:text-white leading-snug line-clamp-2 hover:text-brand-600 dark:hover:text-brand-400 hover:underline underline-offset-2 transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {place.place_name}
            </a>
            <a
              href={place.google_maps_link || '#'}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 mt-0.5 text-zinc-300 dark:text-zinc-600 hover:text-brand-500 transition-colors"
              title="Open in Google Maps"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium leading-none">
              {place.detailed_category}
            </span>
            {place.star_rating > 0 && (
              <span className="flex items-center gap-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                <Star size={9} className="fill-amber-400 text-amber-400" />
                {place.star_rating}
              </span>
            )}
            {place.is_override && (
              <span title="Manually categorised" className="text-brand-400 dark:text-brand-500">
                <Pencil size={9} />
              </span>
            )}
          </div>
        </div>

        {/* Mobile move button */}
        {onCategoryChange && (
          <button
            className="sm:hidden flex-shrink-0 mt-0.5 p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            onClick={() => setShowSheet(true)}
            title="Move to..."
          >
            <MoreHorizontal size={14} />
          </button>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {showSheet && onCategoryChange && (
        <MoveSheet
          placeName={place.place_name}
          currentCategory={place.primary_category}
          onMove={(cat) => onCategoryChange(place.place_name, cat)}
          onClose={() => setShowSheet(false)}
        />
      )}
    </>
  );
};

export const KanbanCard = React.memo(KanbanCardInner);
