import { useCallback, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { LogOut, Mail, Monitor, Moon, RotateCcw, Sun } from "lucide-react";

import { WorkQueueView } from "./components/Places/WorkQueueView";
import { InputSection } from "./components/UI/InputSection";
import { AutoTagCategory } from "./services/categoryRules";
import {
  loadListSummaries,
  loadPlacesForList,
  saveCategoryOverride,
  setProgressDone,
  syncListToSupabase,
} from "./services/gmaplistStore";
import { isSupabaseConfigured, supabase } from "./services/supabaseClient";
import { ExtractedData, ListSummary, Place } from "./types";

type Theme = "light" | "dark" | "system";

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

type ExtensionLogEntry = {
  level?: string;
  message?: string;
  details?: unknown;
  capturedAt?: number;
  pageUrl?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeExtensionStatus(message: unknown): ExtensionStatus | null {
  if (!isRecord(message) || message.type !== "GMAPLIST_EXTENSION_STATUS") return null;
  return {
    status: typeof message.status === "string" ? message.status : "unknown",
    message: typeof message.message === "string" ? message.message : undefined,
    diagnostics: message.diagnostics,
    capturedAt: typeof message.capturedAt === "number" ? message.capturedAt : undefined,
  };
}

function normalizeIncomingMapsPayload(message: unknown): IncomingMapsPayload | null {
  if (!isRecord(message)) return null;

  if (message.type === "GMAPLIST_DATA" && message.data) {
    return { data: message.data, meta: message.meta, diagnostics: message.diagnostics };
  }

  if (message.type === "GMAPLIST_EXTENSION_DATA" && isRecord(message.payload) && message.payload.data) {
    return {
      data: message.payload.data,
      meta: message.payload.meta,
      diagnostics: message.payload.diagnostics,
    };
  }

  return null;
}

function normalizeExtensionLogs(message: unknown): ExtensionLogEntry[] | null {
  if (!isRecord(message) || message.type !== "GMAPLIST_EXTENSION_LOGS") return null;

  const logs = Array.isArray(message.logs) ? message.logs : [];
  return logs.filter(isRecord).map((entry) => ({
    level: typeof entry.level === "string" ? entry.level : undefined,
    message: typeof entry.message === "string" ? entry.message : undefined,
    details: entry.details,
    capturedAt: typeof entry.capturedAt === "number" ? entry.capturedAt : undefined,
    pageUrl: typeof entry.pageUrl === "string" ? entry.pageUrl : undefined,
  }));
}

export default function App() {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [lists, setLists] = useState<ListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [newPlacesCount, setNewPlacesCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authResolved, setAuthResolved] = useState(!supabase);
  const [email, setEmail] = useState("");
  const [authCooldown, setAuthCooldown] = useState(0);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [extensionStatus, setExtensionStatus] = useState<ExtensionStatus | null>(null);
  const [_extensionLogs, setExtensionLogs] = useState<ExtensionLogEntry[]>([]);

  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined"
      ? (localStorage.getItem("maplist-theme") as Theme) || "system"
      : "system"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const apply = (next: "light" | "dark") =>
      next === "dark" ? root.classList.add("dark") : root.classList.remove("dark");
    if (theme === "system") apply(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    else apply(theme);
    localStorage.setItem("maplist-theme", theme);
  }, [theme]);

  const refreshLists = useCallback(async (preferredListId?: string) => {
    if (!session) return;
    const nextLists = await loadListSummaries();
    setLists(nextLists);

    const nextSelected = preferredListId || selectedListId || nextLists[0]?.list_id || "";
    setSelectedListId(nextSelected);
    if (!nextSelected) return;

    const listPlaces = await loadPlacesForList(nextSelected);
    const list = nextLists.find((item) => item.list_id === nextSelected);
    setPlaces(listPlaces);
    setData({
      list_id: nextSelected,
      list_title: list?.name ?? "Google Maps list",
      list_source_url: "",
      places: listPlaces,
      ui_config: { sorting_options: [], filter_groups: [] },
    });
  }, [selectedListId, session]);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth
      .getSession()
      .then(({ data: authData }) => setSession(authData.session))
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setAuthResolved(true));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthResolved(true);
      if (!nextSession) {
        setLists([]);
        setPlaces([]);
        setData(null);
        setSelectedListId("");
        setNewPlacesCount(0);
        setIsLoading(false);
        setIsReceiving(false);
        setExtensionStatus(null);
        setAuthMessage(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (authCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setAuthCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authCooldown]);

  useEffect(() => {
    if (!session) return;
    refreshLists().catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, [session]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setAuthMessage(null);
    if (!supabase) {
      setError("Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: window.location.origin,
      },
    });
    if (authError) {
      const message = authError.message.toLowerCase().includes("rate limit")
        ? "Email rate limit hit. Wait a minute, then request one new magic link."
        : authError.message;
      setError(message);
      if (authError.message.toLowerCase().includes("rate limit")) setAuthCooldown(60);
    } else {
      setAuthCooldown(60);
      setAuthMessage("Magic link sent. Check your email.");
    }
  };

  const signOut = async () => {
    await supabase?.auth.signOut();
  };

  const ingestData = useCallback(async (result: ExtractedData) => {
    try {
      if (!session) {
        setError("Sign in before syncing. The captured Maps payload was not saved.");
        return;
      }
      await syncListToSupabase(result);
      setNewPlacesCount(result.places.length);
      await refreshLists(result.list_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected sync error occurred.");
    }
  }, [refreshLists, session]);

  const pushListUrl = useCallback((listId: string) => {
    if (listId && window.location.pathname !== "/" + listId) {
      window.history.pushState({ listId }, "", "/" + listId);
    }
  }, []);

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ type: "GMAPLIST_READY" }, "*");
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    const slug = window.location.pathname.replace(/^\//, "").trim();
    if (slug && slug.length > 10) setIsReceiving(true);
  }, [session]);

  useEffect(() => {
    if (!session) {
      setIsReceiving(false);
      return;
    }
    setIsReceiving(true);
    const handler = (event: MessageEvent) => {
      try {
        const msg = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        const status = normalizeExtensionStatus(msg);
        if (status) {
          setExtensionStatus(status);
          return;
        }

        const logs = normalizeExtensionLogs(msg);
        if (logs) {
          setExtensionLogs((prev) => {
            const next = logs.length === 1 ? prev.concat(logs) : logs;
            return next.slice(-200);
          });
          return;
        }

        const incoming = normalizeIncomingMapsPayload(msg);
        if (!incoming) return;
        setIsReceiving(false);
        setIsLoading(true);
        setError(null);

        const worker = new Worker(new URL("./services/parser.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = (workerEvent) => {
          if (workerEvent.data.action === "PARSE_COMPLETE") {
            ingestData(workerEvent.data.data);
            pushListUrl(workerEvent.data.data.list_id);
          } else if (workerEvent.data.action === "PARSE_ERROR") {
            setError(workerEvent.data.error);
          }
          setIsLoading(false);
          worker.terminate();
        };
        worker.onerror = (err) => {
          setError("Worker error: " + err.message);
          setIsLoading(false);
          worker.terminate();
        };
        worker.postMessage({
          action: "PARSE",
          payload: { rawData: ")]}'\n" + JSON.stringify(incoming.data), isJson: true, meta: incoming.meta },
        });
      } catch (err) {
        setError("Failed to parse map data: " + String(err));
        setIsLoading(false);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [ingestData, pushListUrl, session]);

  const handleCategoryChange = useCallback(async (featureId: string, newCategory: AutoTagCategory) => {
    await saveCategoryOverride(featureId, newCategory);
    setPlaces((prev) => prev.map((place) =>
      place.feature_id === featureId
        ? { ...place, primary_category: newCategory, detailed_category: "Manual override", is_override: true }
        : place
    ));
    await refreshLists(selectedListId);
  }, [refreshLists, selectedListId]);

  const handleDoneChange = useCallback(async (featureId: string, done: boolean) => {
    if (!selectedListId) return;
    await setProgressDone(selectedListId, featureId, done);
    setPlaces((prev) => prev.map((place) => place.feature_id === featureId ? { ...place, done } : place));
    await refreshLists(selectedListId);
  }, [refreshLists, selectedListId]);

  const handleSelectList = useCallback(async (listId: string) => {
    setSelectedListId(listId);
    const listPlaces = await loadPlacesForList(listId);
    const list = lists.find((item) => item.list_id === listId);
    setPlaces(listPlaces);
    setData({
      list_id: listId,
      list_title: list?.name ?? "Google Maps list",
      list_source_url: "",
      places: listPlaces,
      ui_config: { sorting_options: [], filter_groups: [] },
    });
  }, [lists]);

  const handleReset = () => {
    setData(null);
    setPlaces([]);
    setNewPlacesCount(0);
    setError(null);
    setIsReceiving(true);
  };

  const themeIcon = theme === "dark" ? <Moon size={15} /> : theme === "light" ? <Sun size={15} /> : <Monitor size={15} />;
  const nextTheme = (): Theme => theme === "system" ? "light" : theme === "light" ? "dark" : "system";

  return (
    <div className="min-h-screen bg-zinc-50 transition-colors dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-sm font-bold tracking-tight text-zinc-900 dark:text-white">gmaplist</span>
            {data && <span className="truncate text-xs text-zinc-400">{data.list_title}</span>}
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button onClick={handleReset} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white">
                <RotateCcw size={12} /> Sync
              </button>
            )}
            {session && (
              <button onClick={signOut} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white">
                <LogOut size={12} /> Sign out
              </button>
            )}
            <button onClick={() => setTheme(nextTheme())} className="rounded-lg border border-zinc-200 p-2 text-zinc-500 transition hover:border-zinc-400 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-400 dark:hover:text-white" title={`Theme: ${theme}`}>
              {themeIcon}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4">
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-white" />
              <p className="mt-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">Syncing list...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {!authResolved ? (
          <div className="flex min-h-[calc(100vh-80px)] items-center justify-center py-8">
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              Checking session...
            </div>
          </div>
        ) : session && selectedListId ? (
          <WorkQueueView
            lists={lists}
            selectedListId={selectedListId}
            places={places}
            onSelectList={handleSelectList}
            onCategoryChange={handleCategoryChange}
            onDoneChange={handleDoneChange}
            onRefresh={() => refreshLists(selectedListId)}
          />
        ) : !session ? (
          <div className="flex min-h-[calc(100vh-80px)] items-center justify-center py-8">
            <form onSubmit={signIn} className="grid w-full max-w-md gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div>
                <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">Sign in to gmaplist</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Email magic link only. Sync is disabled while signed out.</p>
              </div>
              <label htmlFor="email" className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
              <button
                disabled={authCooldown > 0 || !email.trim()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-950"
              >
                <Mail size={16} /> Send magic link
              </button>
              {authCooldown > 0 && <p className="text-xs text-zinc-500 dark:text-zinc-400">You can request another link in {authCooldown}s.</p>}
              {!isSupabaseConfigured && <p className="text-xs text-red-600">Missing Supabase environment variables.</p>}
              {authMessage && <p className="text-xs text-emerald-600">{authMessage}</p>}
            </form>
          </div>
        ) : (
          <div className="flex min-h-[calc(100vh-80px)] items-start justify-center pt-16">
            <InputSection isReceiving={isReceiving} extensionStatus={extensionStatus} />
          </div>
        )}
        {session && lists.length === 0 && !data && (
          <div className="mt-6">
            <InputSection isReceiving={isReceiving} extensionStatus={extensionStatus} />
          </div>
        )}
        {newPlacesCount > 0 && (
          <div className="fixed bottom-3 left-3 right-3 mx-auto max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Synced {newPlacesCount} places.
          </div>
        )}
      </main>
    </div>
  );
}
