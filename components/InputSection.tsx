import React, { useState } from 'react';
import { Map as MapIcon, Sparkles, Copy, Check, Radio } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../constants';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
  isReceiving: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onExtract, isLoading, isReceiving }) => {
  const [copied, setCopied] = useState(false);

  const bookmarkletHref = `javascript:${encodeURIComponent(SCROLL_BOOKMARKLET_CODE)}`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-brand-600 text-white shadow-lg">
          <MapIcon size={32} strokeWidth={2} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          GMapList
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
          Turn your Google Maps saved list into a Kanban board — sort, categorise, and tag your places.
        </p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4">

        {/* Step 1 — Install */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs">1</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Install the bookmarklet</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Copy the URL below. Open <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">Ctrl+Shift+O</kbd>, click <span className="font-medium text-zinc-700 dark:text-zinc-300">⋮ → Add new bookmark</span>, paste as the URL. Name it <span className="font-medium text-zinc-700 dark:text-zinc-300">GMapList</span>.
          </p>
          <button
            onClick={copyBookmarklet}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all"
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Bookmarklet URL</>}
          </button>
        </div>

        {/* Step 2 — Run */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs">2</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Run on Google Maps</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Open any <span className="font-medium text-zinc-700 dark:text-zinc-300">Google Maps saved list</span>, wait for it to load.{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">Click any one place</span> on the map first — this loads rich details (category, rating, price).
            Then click <span className="font-medium text-zinc-700 dark:text-zinc-300">GMapList</span> in your bookmarks bar.
          </p>
          {/* Warning */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <span className="text-amber-500 text-sm mt-0.5">⚠</span>
            <span className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              <span className="font-semibold">Click one place on the map first.</span> Without this step the bookmarklet still works, but categories, ratings and prices won't be fetched.
            </span>
          </div>
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-medium">
            <Sparkles size={14} /> Click bookmarklet on Maps tab
          </div>
        </div>

        {/* Step 3 — Waiting */}
        <div className={`rounded-2xl p-5 border flex flex-col gap-3 transition-all duration-500 ${
          isReceiving
            ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-300 dark:border-brand-700 shadow-lg'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs transition-colors ${
              isReceiving ? 'bg-brand-600 text-white' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            }`}>3</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
              {isReceiving ? 'Listening for your list...' : 'Your Kanban board appears here'}
            </h3>
          </div>
          {isReceiving ? (
            <div className="flex items-center gap-2 text-xs text-brand-600 dark:text-brand-400">
              <Radio size={13} className="animate-pulse" />
              Waiting for bookmarklet data — run it on Maps now
            </div>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              After running the bookmarklet, your list opens here as a sortable Kanban board. Drag cards between columns to categorise.
            </p>
          )}
        </div>

      </div>
    </div>
  );
};
