import React, { useState } from 'react';
import { Map as MapIcon, Sparkles, Copy, Check, Loader2, Radio } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../constants';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
  isReceiving: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onExtract, isLoading, isReceiving }) => {
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

      {/* Loading overlay — shown while processing incoming bookmarklet data */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 size={40} className="animate-spin text-brand-600" />
            <p className="text-zinc-800 dark:text-white font-semibold text-lg">Processing your list...</p>
            <p className="text-zinc-500 dark:text-zinc-400 text-sm">Parsing places from the bookmarklet data</p>
          </div>
        </div>
      )}

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
            Copy the URL, open <kbd className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-xs">Ctrl+Shift+O</kbd>, click <span className="font-medium text-zinc-700 dark:text-zinc-300">⋮ → Add new bookmark</span>, paste as the URL. Name it <span className="font-medium text-zinc-700 dark:text-zinc-300">GMapList</span>.
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
          <div className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-xs font-medium select-none">
            <Sparkles size={14} /> Click bookmarklet on Maps tab
          </div>
        </div>

        {/* Step 3 — Waiting / Done */}
        <div className={`rounded-2xl p-5 border flex flex-col gap-3 transition-all duration-500 ${
          isReceiving
            ? 'bg-brand-50 dark:bg-brand-950/30 border-brand-300 dark:border-brand-700 shadow-lg shadow-brand-500/10'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-soft'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs transition-colors ${
              isReceiving
                ? 'bg-brand-600 text-white'
                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
            }`}>3</span>
            <h3 className="font-semibold text-zinc-900 dark:text-white text-sm">
              {isReceiving ? 'Listening...' : 'Data appears here'}
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {isReceiving
              ? 'This tab is ready. Run the bookmarklet on your Maps list — cards will appear automatically.'
              : 'The bookmarklet fetches your full list and sends it here. Cards render automatically.'
            }
          </p>
          <div className={`mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-medium select-none transition-all ${
            isReceiving
              ? 'bg-brand-600 text-white animate-pulse'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
          }`}>
            {isReceiving
              ? <><Radio size={14} /> Waiting for bookmarklet data...</>
              : <><Check size={14} /> Auto-populates</>
            }
          </div>
        </div>

      </div>

      {/* Manual fallback paste area */}
      <form onSubmit={handlePasteSubmit}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-soft overflow-hidden">
          <textarea
            className="w-full h-28 p-4 bg-transparent border-none outline-none text-sm font-mono text-zinc-700 dark:text-zinc-300 resize-none focus:ring-0 placeholder-zinc-400 dark:placeholder-zinc-600"
            placeholder="Or paste JSON from the bookmarklet here manually..."
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
