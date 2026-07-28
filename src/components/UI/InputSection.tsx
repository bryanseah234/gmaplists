import React, { useState } from 'react';
import { Map as MapIcon, Copy, Check, Radio, Terminal } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../../config/constants';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
  isReceiving: boolean;
  extensionStatus?: {
    status: string;
    message?: string;
    diagnostics?: unknown;
    capturedAt?: number;
  } | null;
  extensionLogs?: Array<{
    level?: string;
    message?: string;
    details?: unknown;
    capturedAt?: number;
    pageUrl?: string;
  }>;
}

function getDiagnosticSummary(diagnostics: unknown): string | null {
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) return null;

  const values = diagnostics as Record<string, unknown>;
  const placeCount = typeof values.placeCount === 'number' ? values.placeCount : undefined;
  const networkPayloadCount = typeof values.networkPayloadCount === 'number' ? values.networkPayloadCount : undefined;
  const detailPayloadCount = typeof values.detailPayloadCount === 'number' ? values.detailPayloadCount : undefined;
  const metaWithType = typeof values.metaWithType === 'number' ? values.metaWithType : undefined;
  const metaWithGcid = typeof values.metaWithGcid === 'number' ? values.metaWithGcid : undefined;

  return [
    placeCount != null ? `${placeCount} places` : null,
    networkPayloadCount != null ? `${networkPayloadCount} network payloads` : null,
    detailPayloadCount != null ? `${detailPayloadCount} detail payloads` : null,
    metaWithType != null ? `${metaWithType} types` : null,
    metaWithGcid != null ? `${metaWithGcid} gcids` : null,
  ].filter(Boolean).join(' · ') || null;
}

function formatDebugLog(log: NonNullable<InputSectionProps['extensionLogs']>[number]): string {
  const time = log.capturedAt ? new Date(log.capturedAt).toLocaleTimeString() : '';
  const details = log.details ? ` ${JSON.stringify(log.details)}` : '';
  return `[${time}] ${log.level ?? 'info'} ${log.message ?? 'Extension log'}${details}`;
}

export const InputSection: React.FC<InputSectionProps> = ({ isReceiving, extensionStatus, extensionLogs = [] }) => {
  const [copied, setCopied] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  const bookmarkletHref = `javascript:${encodeURIComponent(
    SCROLL_BOOKMARKLET_CODE.replace('__GMAPLIST_APP_URL__', window.location.origin)
  )}`;

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletHref).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const copyDebugLogs = () => {
    const text = extensionLogs.map(formatDebugLog).join('\n').trim();
    navigator.clipboard.writeText(text || 'No extension debug logs yet.').then(() => {
      setCopiedLogs(true);
      setTimeout(() => setCopiedLogs(false), 2500);
    });
  };

  const recentLogs = extensionLogs.slice(-8).reverse();

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-10">

      {/* Hero */}
      <div className="flex flex-col items-center text-center gap-3">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-600 text-white shadow-lg">
          <MapIcon size={32} strokeWidth={2} />
        </div>
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">
          GMapList
        </h1>
        <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">
          Extract Google Maps saved places, group them, and copy phone-ready links for mobile tagging.
        </p>
      </div>

      <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ${
            extensionStatus?.status === 'payload'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
              : extensionStatus?.status === 'connected'
                ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'
                : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300'
          }`}>
            <Radio size={17} className={isReceiving ? 'animate-pulse' : ''} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">
              Extension capture
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {extensionStatus?.message ?? 'Open this app and Google Maps with the unpacked extension enabled.'}
            </p>
          </div>
        </div>
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 sm:text-right">
          {getDiagnosticSummary(extensionStatus?.diagnostics) ?? (isReceiving ? 'Listening...' : 'No capture yet')}
        </div>
      </div>

      <div className="w-full rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal size={16} className="text-zinc-400" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-white">Extension debug</p>
            <span className="text-xs text-zinc-400 dark:text-zinc-500">{extensionLogs.length} logs</span>
          </div>
          <button
            onClick={copyDebugLogs}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 transition-colors"
          >
            {copiedLogs ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy logs</>}
          </button>
        </div>
        <div className="max-h-48 overflow-auto bg-zinc-950 px-4 py-3 font-mono text-[11px] leading-relaxed text-zinc-300">
          {recentLogs.length > 0 ? (
            recentLogs.map((log, index) => (
              <div key={`${log.capturedAt ?? index}-${log.message ?? index}`} className="whitespace-pre-wrap break-words">
                {formatDebugLog(log)}
              </div>
            ))
          ) : (
            <div className="text-zinc-500">No extension logs received yet. Reload the extension, then reload this page.</div>
          )}
        </div>
      </div>

      {/* 3 step cards side by side */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Step 1 */}
        <div className="flex flex-col items-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm px-6 py-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-600 text-white font-bold text-sm flex-shrink-0">
            1
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-zinc-900 dark:text-white text-sm">Install the bookmarklet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Copy the URL below. In Chrome open{' '}
              <span className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1 rounded">Ctrl+Shift+O</span>,
              click <span className="font-medium text-zinc-700 dark:text-zinc-300">⋮ → Add new bookmark</span>, paste as the URL.
            </p>
          </div>
          <button
            onClick={copyBookmarklet}
            className="mt-auto flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 active:scale-[0.98] transition-all"
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy Bookmarklet URL</>}
          </button>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col items-center text-center gap-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm px-6 py-6">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-brand-600 text-white font-bold text-sm flex-shrink-0">
            2
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-zinc-900 dark:text-white text-sm">Open your list on Google Maps</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Go to <span className="font-medium text-zinc-700 dark:text-zinc-300">Saved → your list</span>.
              Wait for it to load, then{' '}
              <span className="font-medium text-zinc-700 dark:text-zinc-300">click any one place</span> on the map for full ratings, prices and categories.
            </p>
          </div>
          <div className="mt-auto w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700">
            <span className="text-amber-500 text-sm">⚠️</span>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Click one place first for full details</span>
          </div>
        </div>

        {/* Step 3 */}
        <div className={`flex flex-col items-center text-center gap-4 rounded-2xl border shadow-sm px-6 py-6 transition-colors duration-500 ${
          isReceiving
            ? 'bg-brand-50 dark:bg-brand-950/20 border-brand-300 dark:border-brand-700'
            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
        }`}>
          <div className={`flex items-center justify-center w-9 h-9 rounded-full font-bold text-sm flex-shrink-0 transition-colors ${
            isReceiving ? 'bg-brand-600 text-white' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300'
          }`}>
            3
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-semibold text-zinc-900 dark:text-white text-sm">Run the bookmarklet</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Click <span className="font-medium text-zinc-700 dark:text-zinc-300">GMapList</span> in your bookmarks bar.
              Your grouped link workspace appears here automatically.
            </p>
          </div>
          <div className="mt-auto">
            {isReceiving ? (
              <div className="flex items-center justify-center gap-2 text-xs text-brand-600 dark:text-brand-400 font-medium">
                <Radio size={13} className="animate-pulse" />
                Listening for bookmarklet data…
              </div>
            ) : (
              <div className="text-xs text-zinc-400 dark:text-zinc-500">Waiting…</div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
