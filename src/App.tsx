import { useCallback, useEffect, useRef, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { LogOut, Mail, Monitor, Moon, RotateCcw, Sun } from "lucide-react";

import { WorkQueueView } from "./components/Places/WorkQueueView";
import { InputSection } from "./components/UI/InputSection";
import { APP_VERSION, EXPECTED_EXTENSION_VERSION } from "./config/version";
import { readStorage, writeStorage } from "./services/browserStorage";
import { AutoTagCategory } from "./services/categoryRules";
import {
  getSyncCountWarning,
  loadListSummaries,
  loadPlacesForList,
  saveCategoryOverride,
  setProgressDone,
  syncListToSupabase,
  SyncCountWarning,
  SyncResult,
} from "./services/gmaplistStore";
import { isSupabaseConfigured, supabase } from "./services/supabaseClient";
import { ExtractedData, ListSummary, Place } from "./types";

type Theme = "light" | "dark" | "system";

const THEME_STORAGE_KEY = "maplist-theme";
const SELECTED_LIST_STORAGE_KEY = "gmaplist-selected-list";
const SYNC_ATTEMPT_STORAGE_KEY = "gmaplists-sync-attempt";
const PROCESSED_PAYLOAD_STORAGE_KEY = "gmaplists-processed-payload";
const APP_REQUEST_LATEST_TYPE = "GMAPLIST_APP_REQUEST_LATEST";

type IncomingMapsPayload = {
  data: unknown;
  meta?: unknown;
  diagnostics?: unknown;
  capturedAt?: number;
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

type PersistedSyncAttempt = {
  status: "in_progress" | "failed";
  list_id: string;
  list_title: string;
  started_at: string;
  updated_at: string;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getPathListId(): string {
  if (typeof window === "undefined") return "";
  const slug = window.location.pathname.replace(/^\//, "").trim();
  return slug && slug.length > 10 ? decodeURIComponent(slug) : "";
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
    return {
      data: message.data,
      meta: message.meta,
      diagnostics: message.diagnostics,
      capturedAt: typeof message.capturedAt === "number" ? message.capturedAt : undefined,
    };
  }

  if (message.type === "GMAPLIST_EXTENSION_DATA" && isRecord(message.payload) && message.payload.data) {
    return {
      data: message.payload.data,
      meta: message.payload.meta,
      diagnostics: message.payload.diagnostics,
      capturedAt: typeof message.payload.capturedAt === "number" ? message.payload.capturedAt : undefined,
    };
  }

  return null;
}

function loadPersistedSyncAttempt(): PersistedSyncAttempt | null {
  const raw = readStorage(SYNC_ATTEMPT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedSyncAttempt>;
    if ((parsed.status === "in_progress" || parsed.status === "failed") && parsed.list_id && parsed.list_title && parsed.started_at && parsed.updated_at) {
      return parsed as PersistedSyncAttempt;
    }
  } catch {
    return null;
  }
  return null;
}

function writePersistedSyncAttempt(attempt: PersistedSyncAttempt): void {
  writeStorage(SYNC_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
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
  const [syncSummary, setSyncSummary] = useState<SyncResult | null>(null);
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
  const [pendingSync, setPendingSync] = useState<{ data: ExtractedData; warning: SyncCountWarning } | null>(null);
  const [syncingListId, setSyncingListId] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<PersistedSyncAttempt | null>(() => loadPersistedSyncAttempt());
  const syncInFlightRef = useRef<string | null>(null);

  const [theme, setTheme] = useState<Theme>(() =>
    typeof window !== "undefined"
      ? (readStorage(THEME_STORAGE_KEY) as Theme) || "system"
      : "system"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    const apply = (next: "light" | "dark") =>
      next === "dark" ? root.classList.add("dark") : root.classList.remove("dark");
    if (theme === "system") apply(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    else apply(theme);
    writeStorage(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const refreshLists = useCallback(async (preferredListId?: string) => {
    if (!session) return;
    const nextLists = await loadListSummaries();
    setLists(nextLists);

    const savedListId = readStorage(SELECTED_LIST_STORAGE_KEY) ?? "";
    const candidateListId = preferredListId || selectedListId || getPathListId() || savedListId;
    const nextSelected = nextLists.some((list) => list.list_id === candidateListId)
      ? candidateListId
      : nextLists[0]?.list_id || "";
    setSelectedListId(nextSelected);
    if (nextSelected) writeStorage(SELECTED_LIST_STORAGE_KEY, nextSelected);
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

  const formatError = useCallback((err: unknown, action: string): string => {
    console.error(`[gmaplists] ${action} failed`, err);
    if (err && typeof err === "object") {
      const values = err as Record<string, unknown>;
      const status = typeof values.status === "number" ? values.status : undefined;
      const code = typeof values.code === "string" ? values.code : undefined;
      const message = typeof values.message === "string" ? values.message : undefined;
      const details = typeof values.details === "string" ? values.details : undefined;
      const hint = typeof values.hint === "string" ? values.hint : undefined;
      if (status === 401 || code === "401") {
        return "Your session expired before the request reached Supabase. Sign out, sign back in, then run the sync again. No later sync steps were run after this error.";
      }
      return [
        `${action} failed.`,
        message,
        details ? `Details: ${details}` : null,
        hint ? `Hint: ${hint}` : null,
        code ? `Code: ${code}` : null,
        "If this happened during sync, rerun sync after fixing the error. The transactional RPC prevents partial list reconciliation writes.",
      ].filter(Boolean).join(" ");
    }
    return err instanceof Error ? `${action} failed. ${err.message}` : `${action} failed. ${String(err)}`;
  }, []);

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
        setSyncSummary(null);
        setIsLoading(false);
        setIsReceiving(false);
        setExtensionStatus(null);
        setAuthMessage(null);
        setPendingSync(null);
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

  useEffect(() => {
    if (!session) return;
    window.postMessage({ type: APP_REQUEST_LATEST_TYPE }, window.location.origin);
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

  const ingestData = useCallback(async (result: ExtractedData): Promise<boolean> => {
    try {
      if (!session) {
        setError("Sign in before syncing. The captured Maps payload was not saved.");
        return false;
      }
      if (syncInFlightRef.current) {
        setError(`A sync for ${syncInFlightRef.current} is already running. Wait for it to finish before opening another Maps list.`);
        return false;
      }
      syncInFlightRef.current = result.list_id;
      setSyncingListId(result.list_id);
      const warning = await getSyncCountWarning(result);
      if (warning) {
        setPendingSync({ data: result, warning });
        setError(null);
        return false;
      }
      const attempt: PersistedSyncAttempt = {
        status: "in_progress",
        list_id: result.list_id,
        list_title: result.list_title,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      writePersistedSyncAttempt(attempt);
      setSyncNotice(attempt);
      const resultSummary = await syncListToSupabase(result);
      writeStorage(SYNC_ATTEMPT_STORAGE_KEY, "");
      setSyncNotice(null);
      setSyncSummary(resultSummary);
      await refreshLists(result.list_id);
      return true;
    } catch (err) {
      const message = formatError(err, "Sync");
      if (result.list_id) {
        const failedAttempt: PersistedSyncAttempt = {
          status: "failed",
          list_id: result.list_id,
          list_title: result.list_title,
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          message,
        };
        writePersistedSyncAttempt(failedAttempt);
        setSyncNotice(failedAttempt);
      }
      setError(message);
      return false;
    } finally {
      syncInFlightRef.current = null;
      setSyncingListId(null);
    }
  }, [formatError, refreshLists, session]);

  const confirmPendingSync = useCallback(async () => {
    if (!pendingSync) return;
    if (syncInFlightRef.current) {
      setError(`A sync for ${syncInFlightRef.current} is already running. Wait for it to finish before confirming another payload.`);
      return;
    }
    setIsLoading(true);
    syncInFlightRef.current = pendingSync.data.list_id;
    setSyncingListId(pendingSync.data.list_id);
    try {
      const attempt: PersistedSyncAttempt = {
        status: "in_progress",
        list_id: pendingSync.data.list_id,
        list_title: pendingSync.data.list_title,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      writePersistedSyncAttempt(attempt);
      setSyncNotice(attempt);
      const resultSummary = await syncListToSupabase(pendingSync.data);
      writeStorage(SYNC_ATTEMPT_STORAGE_KEY, "");
      setSyncNotice(null);
      setSyncSummary(resultSummary);
      await refreshLists(pendingSync.data.list_id);
      setPendingSync(null);
    } catch (err) {
      const message = formatError(err, "Confirmed sync");
      const failedAttempt: PersistedSyncAttempt = {
        status: "failed",
        list_id: pendingSync.data.list_id,
        list_title: pendingSync.data.list_title,
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message,
      };
      writePersistedSyncAttempt(failedAttempt);
      setSyncNotice(failedAttempt);
      setError(message);
    } finally {
      syncInFlightRef.current = null;
      setSyncingListId(null);
      setIsLoading(false);
    }
  }, [formatError, pendingSync, refreshLists]);

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
        const payloadKey = incoming.capturedAt ? String(incoming.capturedAt) : "";
        if (payloadKey && readStorage(PROCESSED_PAYLOAD_STORAGE_KEY) === payloadKey) return;
        setIsReceiving(false);
        setIsLoading(true);
        setError(null);

        const worker = new Worker(new URL("./services/parser.worker.ts", import.meta.url), { type: "module" });
        worker.onmessage = async (workerEvent) => {
          if (workerEvent.data.action === "PARSE_COMPLETE") {
            try {
              const handled = await ingestData(workerEvent.data.data);
              if (handled && payloadKey) writeStorage(PROCESSED_PAYLOAD_STORAGE_KEY, payloadKey);
              pushListUrl(workerEvent.data.data.list_id);
            } finally {
              setIsLoading(false);
              worker.terminate();
            }
          } else if (workerEvent.data.action === "PARSE_ERROR") {
            setError(workerEvent.data.error);
            setIsLoading(false);
            worker.terminate();
          }
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
    try {
      await saveCategoryOverride(featureId, newCategory);
      setPlaces((prev) => prev.map((place) =>
        place.feature_id === featureId
          ? { ...place, primary_category: newCategory, detailed_category: "Manual override", is_override: true }
          : place
      ));
      await refreshLists(selectedListId);
    } catch (err) {
      setError(formatError(err, "Saving category override"));
      throw err;
    }
  }, [formatError, refreshLists, selectedListId]);

  const handleDoneChange = useCallback(async (featureId: string, done: boolean) => {
    if (!selectedListId) return;
    try {
      await setProgressDone(selectedListId, featureId, done);
      setPlaces((prev) => prev.map((place) => place.feature_id === featureId ? { ...place, done } : place));
      await refreshLists(selectedListId);
    } catch (err) {
      setError(formatError(err, "Saving progress"));
      throw err;
    }
  }, [formatError, refreshLists, selectedListId]);

  const handleSelectList = useCallback(async (listId: string) => {
    try {
      setSelectedListId(listId);
      writeStorage(SELECTED_LIST_STORAGE_KEY, listId);
      pushListUrl(listId);
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
    } catch (err) {
      setError(formatError(err, "Loading list"));
    }
  }, [formatError, lists, pushListUrl]);

  const handleReset = () => {
    setData(null);
    setPlaces([]);
    setSyncSummary(null);
    setError(null);
    setIsReceiving(true);
  };

  const themeIcon = theme === "dark" ? <Moon size={15} /> : theme === "light" ? <Sun size={15} /> : <Monitor size={15} />;
  const nextTheme = (): Theme => theme === "system" ? "light" : theme === "light" ? "dark" : "system";
  const extensionDiagnostics = extensionStatus?.diagnostics && typeof extensionStatus.diagnostics === "object" && !Array.isArray(extensionStatus.diagnostics)
    ? extensionStatus.diagnostics as Record<string, unknown>
    : {};
  const extensionVersion = typeof extensionDiagnostics.extensionVersion === "string" ? extensionDiagnostics.extensionVersion : "unknown";
  const hasExtensionVersionMismatch = extensionVersion !== "unknown" && extensionVersion !== EXPECTED_EXTENSION_VERSION;

  return (
    <div className="min-h-screen bg-zinc-50 transition-colors dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 px-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-sm font-bold tracking-tight text-zinc-900 dark:text-white">gmaplists</span>
            {data && <span className="truncate text-xs text-zinc-400">{data.list_title}</span>}
            <span className={`shrink-0 text-[10px] font-semibold ${hasExtensionVersionMismatch ? "text-amber-600 dark:text-amber-300" : "text-zinc-400"}`}>
              app {APP_VERSION} · ext {extensionVersion}
            </span>
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

      <main className="mx-auto max-w-6xl px-3 py-4">
        {isLoading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="rounded-lg bg-white p-6 shadow-2xl dark:bg-zinc-900">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-950 dark:border-zinc-700 dark:border-t-white" />
              <p className="mt-4 text-center text-sm font-semibold text-zinc-900 dark:text-white">Syncing list...</p>
              {syncingListId && <p className="mt-1 text-center text-xs text-zinc-500 dark:text-zinc-400">{syncingListId}</p>}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {pendingSync && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="font-bold">Sync count changed sharply. No data has been written for this payload.</p>
            <p className="mt-1">
              {pendingSync.warning.previous_count > 0
                ? `Last successful sync for ${pendingSync.warning.list_title} had ${pendingSync.warning.previous_count} active places.`
                : `There is no previous successful sync for ${pendingSync.warning.list_title}, and this first payload is unusually large.`}
              This payload has {pendingSync.warning.incoming_count} places ({pendingSync.warning.incoming_unique_count} unique, {pendingSync.warning.duplicate_count} duplicates),
              a {pendingSync.warning.percent_change}% change.
            </p>
            <p className="mt-1">If you intentionally changed the list this much, confirm. Otherwise reload the extension, click through Saved → the exact list again, and cancel this sync.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={confirmPendingSync} className="rounded-md bg-amber-900 px-3 py-2 text-xs font-bold text-white dark:bg-amber-200 dark:text-amber-950">
                Confirm sync anyway
              </button>
              <button onClick={() => setPendingSync(null)} className="rounded-md border border-amber-400 px-3 py-2 text-xs font-bold text-amber-900 dark:border-amber-600 dark:text-amber-100">
                Cancel
              </button>
            </div>
          </div>
        )}

        {syncNotice && (
          <div className="mb-4 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900 shadow-sm dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-100">
            <p className="font-bold">
              {syncNotice.status === "in_progress" ? "Previous sync may have been interrupted." : "Previous sync failed."}
            </p>
            <p className="mt-1">
              {syncNotice.list_title} ({syncNotice.list_id}) started at {new Date(syncNotice.started_at).toLocaleString()}.
              {syncNotice.status === "in_progress"
                ? " If you closed or reloaded the tab during sync, rerun the sync from the extension/app to confirm the database state."
                : ` ${syncNotice.message ?? "Rerun sync after fixing the issue."}`}
            </p>
            <button
              onClick={() => {
                writeStorage(SYNC_ATTEMPT_STORAGE_KEY, "");
                setSyncNotice(null);
              }}
              className="mt-3 rounded-md border border-sky-400 px-3 py-2 text-xs font-bold text-sky-900 dark:border-sky-600 dark:text-sky-100"
            >
              Dismiss
            </button>
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
                <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">Sign in to gmaplists</h1>
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
            <InputSection isReceiving={isReceiving} extensionStatus={extensionStatus} appVersion={APP_VERSION} expectedExtensionVersion={EXPECTED_EXTENSION_VERSION} />
          </div>
        )}
        {syncSummary && (
          <div className="fixed bottom-3 left-3 right-3 mx-auto max-w-sm rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-800 shadow-lg dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Synced {syncSummary.received_count} received · {syncSummary.unique_count} unique
            {syncSummary.received_count !== syncSummary.unique_count ? ` · ${syncSummary.received_count - syncSummary.unique_count} duplicate` : ""}
            {syncSummary.removed_count > 0 ? ` · ${syncSummary.removed_count} removed` : " · 0 removed"}
          </div>
        )}
      </main>
    </div>
  );
}
