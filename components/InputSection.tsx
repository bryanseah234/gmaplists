import React, { useState } from 'react';
import { Map as MapIcon, Copy, Check, Radio } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../constants';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
  isReceiving: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ isReceiving }) => {
  const [copied, setCopied] = useState(false);

  const bookmarkletHref = `javascript:${encodeURIComponent(SCROLL_BOOKMARKLET_CODE)}`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-8">

      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white shadow-lg">
          <MapIcon size={32} strokeWidth={2} />
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">
          GMapList
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
          Turn your Google Maps saved list into a Kanban board — categorise, sort, and copy places for tagging.
        </p>
      </div>

      {/* Steps card */}
      <div className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden">

        {/* Step 1 */}
        <div className="flex flex-col items-center text-center gap-3 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-sm">
            1
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">Install the bookmarklet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Copy the URL below. In Chrome open <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">Ctrl+Shift+O</span>,
              click <span className="font-medium text-zinc-700 dark:text-zinc-300">⋮ → Add new bookmark</span>, paste as the URL.
            </p>
          </div>
          <button
            onClick={copyBookmarklet}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            {copied
              ? <><Check size={14} /> Copied!</>
              : <><Copy size={14} /> Copy Bookmarklet URL</>
            }
          </button>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col items-center text-center gap-3 px-6 py-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white font-bold text-sm">
            2
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">Open your list on Google Maps</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Go to <span className="font-medium text-zinc-700 dark:text-zinc-300">Google Maps → Saved → your list</span>.
              Wait for it to load, then <span className="font-medium text-zinc-700 dark:text-zinc-300">click any one place</span> on the map — this loads ratings, prices and categories.
            </p>
          </div>
          {/* Visual hint */}
          <div className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
            <span className="text-amber-500 text-sm">⚠️</span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Click one place first for full details</span>
          </div>
        </div>

        {/* Step 3 */}
        <div className={`flex flex-col items-center text-center gap-3 px-6 py-5 transition-colors duration-500 ${
          isReceiving ? 'bg-brand-50 dark:bg-brand-950/20' : ''
        }`}>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm transition-colors ${
            isReceiving ? 'bg-brand-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
          }`}>
            3
          </div>
          <div>
            <p className="font-semibold text-zinc-900 dark:text-white text-sm mb-1">Run the bookmarklet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Click <span className="font-medium text-zinc-700 dark:text-zinc-300">GMapList</span> in your bookmarks bar.
              Your Kanban board opens here automatically.
            </p>
          </div>
          {isReceiving && (
            <div className="flex items-center justify-center gap-2 text-xs text-brand-600 dark:text-brand-400 font-medium">
              <Radio size={13} className="animate-pulse" />
              Listening for bookmarklet data…
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
