import React, { useState, useEffect } from 'react';
import { Map as MapIcon, Sparkles, Copy, Check, Loader2 } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../constants';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onExtract, isLoading }) => {
  const [copied, setCopied] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  const bookmarkletHref = `javascript:${encodeURIComponent(SCROLL_BOOKMARKLET_CODE)}`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handlePasteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;
    await onExtract(pasteContent);
  };

  return (
    <div className="w-full max-w-3xl mx-auto">

      {/* Hero */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-brand-600 text-white shadow-glow shadow-brand-500/30">
          <MapIcon size={32} strokeWidth={2} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
          Organize your Maps.
        </h1>
        <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Turn your Google Maps saved lists into a clean, sortable card view — in seconds.
        </p>
      </div>

      {/* Steps */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

        {/* Step 1 — Install */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-soft flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs">1</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Install Bookmarklet</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Copy the bookmarklet URL, then open <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">Ctrl+Shift+O</kbd> → <span className="font-medium text-zinc-700 dark:text-zinc-300">⋮ → Add new bookmark</span> → paste as the URL.
          </p>
          <button
            onClick={copyBookmarklet}
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-all select-none"
          >
            {copied
              ? <><Check size={14} /> Copied!</>
              : <><Copy size={14} /> Copy Bookmarklet URL</>
            }
          </button>
        </div>

        {/* Step 2 — Run */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-soft flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-xs">2</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Run on Maps</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Open any <span className="font-medium text-zinc-700 dark:text-zinc-300">Google Maps saved list</span>, wait for it to load, then click <span className="font-medium text-zinc-700 dark:text-zinc-300">GMapList</span> in your bookmarks bar.
          </p>
          <div className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-medium select-none">
            <Sparkles size={14} /> Click bookmarklet on Maps
          </div>
        </div>

        {/* Step 3 — Done */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 shadow-soft flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-xs">3</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">Data appears here</h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            The bookmarklet fetches your full list and sends it directly to this tab. Cards render automatically — no copy-paste needed.
          </p>
          <div className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 text-xs font-medium select-none">
            <Check size={14} /> Auto-populates
          </div>
        </div>

      </div>

      {/* Manual fallback paste area */}
      <form onSubmit={handlePasteSubmit}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-soft overflow-hidden">
          <textarea
            className="w-full h-28 p-4 bg-transparent border-none outline-none text-sm font-mono text-zinc-700 dark:text-zinc-300 resize-none focus:ring-0 placeholder-zinc-400 dark:placeholder-zinc-600"
            placeholder="Or paste the JSON from the bookmarklet here manually..."
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            disabled={isLoading}
          />
          {pasteContent.trim() && (
            <div className="px-4 pb-4">
              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50 transition-all"
              >
                {isLoading ? <><Loader2 size={16} className="animate-spin" /> Processing...</> : 'Process'}
              </button>
            </div>
          )}
        </div>
      </form>

    </div>
  );
};
