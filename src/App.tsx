import { useState, useEffect, useCallback, useRef } from 'react';

import { saveListMeta, loadOverrides, saveOverride, applyOverrides, countNewPlaces, restoreList } from './services/storageService';
import { ExtractedData, Place } from './types';
import { KanbanView } from './components/Kanban/KanbanView';
import { InputSection } from './components/UI/InputSection';
import { Sun, Moon, Monitor, RotateCcw } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

type IncomingMapsPayload = {
  data: unknown;
  meta?: unknown;
  diagnostics?: unknown;
};

type ExtensionStatus = {
  status: string;
  message?: string;
  diagnostics?: unknown;
  capturedAt?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeExtensionStatus(message: unknown): ExtensionStatus | null {
  if (!isRecord(message) || message.type !== 'GMAPLIST_EXTENSION_STATUS') return null;

  return {
    status: typeof message.status === 'string' ? message.status : 'unknown',
    message: typeof message.message === 'string' ? message.message : undefined,
    diagnostics: message.diagnostics,
    capturedAt: typeof message.capturedAt === 'number' ? message.capturedAt : undefined,
  };
}

function normalizeIncomingMapsPayload(message: unknown): IncomingMapsPayload | null {
  if (!isRecord(message)) return null;

  if (message.type === 'GMAPLIST_DATA' && message.data) {
    return { data: message.data, meta: message.meta, diagnostics: message.diagnostics };
  }

  if (message.type === 'GMAPLIST_EXTENSION_DATA' && isRecord(message.payload) && message.payload.data) {
    return {
      data: message.payload.data,
      meta: message.payload.meta,
      diagnostics: message.payload.diagnostics,
    };
  }

  return null;
}

export default function App() {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [newPlacesCount, setNewPlacesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);

  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== 'undefined'
      ? (localStorage.getItem('maplist-theme') as Theme) || 'system'
      : 'system'
  );

  // Theme
  useEffect(() => {
    const root = window.document.documentElement;
    const apply = (t: 'light' | 'dark') =>
      t === 'dark' ? root.classList.add('dark') : root.classList.remove('dark');
    if (theme === 'system') {
      apply(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      apply(theme);
    }
    localStorage.setItem('maplist-theme', theme);
  }, [theme]);

  // Ingest parsed data — apply overrides, save meta, compute new count
  const ingestData = useCallback((result: ExtractedData) => {
    try {
      const overrides = loadOverrides(result.list_id);
      const newCount = countNewPlaces(result.places, result.list_id);
      const enriched = applyOverrides(result.places, overrides);
      setData(result);
      setPlaces(enriched);
      setNewPlacesCount(newCount);
      saveListMeta(result.list_id, result.list_title, result.places.length, result.places, result.list_source_url);
    } catch (e: any) {
      if (e.name === 'StorageQuotaExceededError') {
        setError(e.message);
      } else {
        setError('An unexpected error occurred while saving.');
      }
    }
  }, []);

  // Sync URL to list slug
  const pushListUrl = useCallback((listId: string) => {
    if (listId && window.location.pathname !== '/' + listId) {
      window.history.pushState({ listId }, '', '/' + listId);
    }
  }, []);

  // On mount: restore list from localStorage if URL contains a known list ID
  useEffect(() => {
    const slug = window.location.pathname.replace(/^\//, '').trim();
    if (slug && slug.length > 10) {
      const restored = restoreList(slug);
      if (restored) {
        const overrides = loadOverrides(slug);
        const enriched = applyOverrides(restored.places, overrides);
        setData({
          list_title: restored.list_title,
          list_source_url: restored.list_source_url,
          list_id: slug,
          places: enriched,
          ui_config: { sorting_options: [], filter_groups: [] },
        });
        setPlaces(enriched);
        setNewPlacesCount(0);
      }
    }
  }, []);

  // Signal to the bookmarklet (window.opener) that we are ready to receive data
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: 'GMAPLIST_READY' }, '*');
    }
  }, []);

  // On mount: if URL has a list slug, show the kanban immediately using stored overrides
  // (no places data stored — just show the import screen with the slug context)
  // The postMessage from bookmarklet will populate the kanban
  // But if the user refreshes mid-session the data is gone — show import screen
  useEffect(() => {
    const slug = window.location.pathname.replace(/^\//, '').trim();
    if (slug && slug.length > 10) {
      // Valid list ID in URL — switch to receiving mode so UI is ready
      setIsReceiving(true);
    }
  }, []);

  // Listen for postMessage from bookmarklet or extension app bridge
  useEffect(() => {
    setIsReceiving(true);
    const handler = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        const status = normalizeExtensionStatus(msg);
        if (status) {
          setExtensionStatus(status);
          console.info('[GMapLists] extension status', status);
          return;
        }

        const incoming = normalizeIncomingMapsPayload(msg);
        if (!incoming) return;
        setIsReceiving(false);
        setIsLoading(true);
        setError(null);
        if (incoming.diagnostics) {
          console.info('[GMapLists] received map payload', incoming.diagnostics);
          setExtensionStatus({
            status: 'payload',
            message: 'Maps payload received by app.',
            diagnostics: incoming.diagnostics,
            capturedAt: Date.now(),
          });
        }
        
        const raw = ")]}'\n" + JSON.stringify(incoming.data);
        
        const worker = new Worker(new URL('./services/parser.worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (e) => {
          if (e.data.action === 'PARSE_COMPLETE') {
            ingestData(e.data.data);
            pushListUrl(e.data.data.list_id);
          } else if (e.data.action === 'PARSE_ERROR') {
            setError(e.data.error);
          }
          setIsLoading(false);
          worker.terminate();
        };
        
        worker.onerror = (err) => {
          setError('Worker error: ' + err.message);
          setIsLoading(false);
          worker.terminate();
        };
        
        worker.postMessage({
          action: 'PARSE',
          payload: { rawData: raw, isJson: true, meta: incoming.meta }
        });
      } catch (e) {
        setError('Failed to parse map data: ' + String(e));
        setIsLoading(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [ingestData, pushListUrl]);

  // Handle manual paste fallback
  const handleExtract = useCallback(async (input: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const trimmed = input.trim();
      const isJson = trimmed.startsWith(')]}\'') || trimmed.startsWith('{"type":"GMAPLIST') || trimmed.startsWith('[[');
      
      const worker = new Worker(new URL('./services/parser.worker.ts', import.meta.url), { type: 'module' });
      
      worker.onmessage = (e) => {
        if (e.data.action === 'PARSE_COMPLETE') {
          ingestData(e.data.data);
          pushListUrl(e.data.data.list_id);
        } else if (e.data.action === 'PARSE_ERROR') {
          setError(e.data.error);
        }
        setIsLoading(false);
        worker.terminate();
      };
      
      worker.onerror = (err) => {
        setError('Worker error: ' + err.message);
        setIsLoading(false);
        worker.terminate();
      };
      
      worker.postMessage({
        action: 'PARSE',
        payload: { rawData: trimmed, isJson: isJson }
      });
    } catch (e) {
      setError("Failed to extract map link. " + String(e));
      setIsLoading(false);
    }
  }, [ingestData]);

  // Handle drag-and-drop category change
  const handleCategoryChange = useCallback((placeName: string, newCategory: string) => {
    if (!data) return;
    try {
      // Persist to localStorage first so it fails before UI update if quota hit
      saveOverride(data.list_id, placeName, newCategory);
      // Update in state
      setPlaces((prev) =>
        prev.map((p) =>
          p.place_name === placeName
            ? { ...p, primary_category: newCategory, is_override: true }
            : p
        )
      );
    } catch (e: any) {
      if (e.name === 'StorageQuotaExceededError') {
        setError(e.message);
      } else {
        setError('An unexpected error occurred while saving override.');
      }
    }
  }, [data]);

  // Reset back to import screen
  const handleReset = () => {
    setData(null);
    setPlaces([]);
    setNewPlacesCount(0);
    setError(null);
    setIsReceiving(true);
  };

  const themeIcon = theme === 'dark' ? <Moon size={15} /> : theme === 'light' ? <Sun size={15} /> : <Monitor size={15} />;
  const nextTheme = (): Theme => theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-zinc-950/90 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-4 h-12 flex items-center justify-between gap-4">
          {/* Left: logo + list info */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-sm font-bold text-zinc-900 dark:text-white tracking-tight flex-shrink-0">GMapList</span>
            {data && (
              <>
                <span className="text-zinc-300 dark:text-zinc-700">·</span>
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[200px]">
                  {data.list_title}
                </span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                  {places.length} places
                </span>
              </>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {data && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-all"
                title="Re-import a list"
              >
                <RotateCcw size={12} /> Re-import
              </button>
            )}
            <button
              onClick={() => setTheme(nextTheme())}
              className="p-2 rounded-lg text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 transition-all"
              title={`Theme: ${theme}`}
            >
              {themeIcon}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
              <div className="w-10 h-10 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-zinc-800 dark:text-white font-semibold text-lg">Processing your list...</p>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Fetching categories, ratings &amp; prices</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Kanban or import screen */}
        {data && places.length > 0 ? (
          <KanbanView
            data={data}
            places={places}
            onCategoryChange={handleCategoryChange}
            newPlacesCount={newPlacesCount}
          />
        ) : (
          <div className="flex items-start justify-center min-h-[calc(100vh-80px)] pt-16">
            <InputSection
              onExtract={handleExtract}
              isLoading={isLoading}
              isReceiving={isReceiving}
              extensionStatus={extensionStatus}
            />
          </div>
        )}
      </main>
    </div>
  );
}
