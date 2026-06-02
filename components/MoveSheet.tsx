import React from 'react';
import { COLUMNS } from '../types';
import { X } from 'lucide-react';

interface MoveSheetProps {
  placeName: string;
  currentCategory: string;
  onMove: (newCategory: string) => void;
  onClose: () => void;
}

export const MoveSheet: React.FC<MoveSheetProps> = ({ placeName, currentCategory, onMove, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl p-4 pb-8 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-0.5">Move to...</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-1">{placeName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {COLUMNS.map((col) => (
            <button
              key={col.id}
              onClick={() => { onMove(col.id); onClose(); }}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border text-sm font-medium transition-all
                ${col.id === currentCategory
                  ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                }`}
            >
              <span className="text-xl leading-none">{col.emoji}</span>
              <span className="text-xs">{col.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
