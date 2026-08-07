import React, { useState } from 'react';
import {
  Download,
  ExternalLink,
  Loader2,
  Map as MapIcon,
  Radio,
  Send,
} from 'lucide-react';

interface InputSectionProps {
  isReceiving: boolean;
  extensionStatus?: {
    status: string;
    message?: string;
    diagnostics?: unknown;
    capturedAt?: number;
  } | null;
}

const EXTENSION_ZIP_URL = 'https://github.com/hongyime/gmaplists/archive/refs/heads/main.zip';
const APP_OPEN_MAPS_URL_TYPE = 'GMAPLIST_APP_OPEN_MAPS_URL';

function getDiagnosticSummary(diagnostics: unknown): string | null {
  if (!diagnostics || typeof diagnostics !== 'object' || Array.isArray(diagnostics)) return null;

  const values = diagnostics as Record<string, unknown>;
  const placeCount = typeof values.placeCount === 'number' ? values.placeCount : undefined;
  const total = typeof values.total === 'number' ? values.total : undefined;
  const page = typeof values.page === 'number' ? values.page : undefined;
  const fetched = typeof values.fetched === 'number' ? values.fetched : undefined;
  const metaCount = typeof values.metaCount === 'number' ? values.metaCount : undefined;

  return [
    page != null ? `page ${page}` : null,
    fetched != null ? `${fetched} fetched` : null,
    placeCount != null ? `${placeCount} places` : null,
    total != null && total !== placeCount ? `${total} total` : null,
    metaCount != null && metaCount !== placeCount ? `${metaCount} links` : null,
  ].filter(Boolean).join(' · ') || null;
}

function getStatusTone(status?: string) {
  if (status === 'payload') {
    return {
      shell: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30',
      icon: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
      text: 'text-emerald-800 dark:text-emerald-200',
    };
  }

  if (status === 'loading' || status === 'connected' || status === 'reconnecting') {
    return {
      shell: 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30',
      icon: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
      text: 'text-sky-800 dark:text-sky-200',
    };
  }

  if (status === 'error') {
    return {
      shell: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30',
      icon: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300',
      text: 'text-red-800 dark:text-red-200',
    };
  }

  return {
    shell: 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
    icon: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
    text: 'text-zinc-700 dark:text-zinc-300',
  };
}

export const InputSection: React.FC<InputSectionProps> = ({
  isReceiving,
  extensionStatus,
}) => {
  const [mapsUrl, setMapsUrl] = useState('');
  const [submittedUrl, setSubmittedUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const statusTone = getStatusTone(extensionStatus?.status);
  const isLoadingStatus = extensionStatus?.status === 'loading' || isReceiving;

  const openMapsUrl = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = mapsUrl.trim();

    if (!trimmed) {
      setUrlError('Paste a Google Maps list URL first.');
      return;
    }

    try {
      const url = new URL(trimmed);
      const host = url.hostname.replace(/^www\./, '').toLowerCase();
      const isMapsUrl = host === 'google.com' || host.endsWith('.google.com') || host === 'maps.app.goo.gl';

      if (!isMapsUrl) {
        setUrlError('Paste a Google Maps or maps.app.goo.gl URL.');
        return;
      }
    } catch {
      setUrlError('Paste a valid URL.');
      return;
    }

    setUrlError(null);
    setSubmittedUrl(trimmed);
    window.postMessage({ type: APP_OPEN_MAPS_URL_TYPE, url: trimmed }, window.location.origin);
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
      <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950">
                <MapIcon size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">GMapList</h1>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Extract a Google Maps list, sort places into practical groups, then copy phone-ready links for mobile tagging.
                </p>
              </div>
            </div>

            <form onSubmit={openMapsUrl} className="mt-5 flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="maps-url">Google Maps list URL</label>
              <input
                id="maps-url"
                value={mapsUrl}
                onChange={(event) => setMapsUrl(event.currentTarget.value)}
                placeholder="Paste Google Maps list link or maps.app.goo.gl short link"
                className="h-11 min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
              >
                <Send size={15} />
                Open Maps Tab
              </button>
            </form>

            {urlError ? (
              <p className="mt-2 text-xs font-medium text-red-600 dark:text-red-300">{urlError}</p>
            ) : submittedUrl ? (
              <p className="mt-2 truncate text-xs text-zinc-500 dark:text-zinc-400">
                Requested tab: {submittedUrl}
              </p>
            ) : null}
          </div>

          <div className={`w-full rounded-lg border px-4 py-3 lg:w-[340px] ${statusTone.shell}`}>
            <div className="flex items-start gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${statusTone.icon}`}>
                {isLoadingStatus ? <Loader2 size={17} className="animate-spin" /> : <Radio size={17} />}
              </div>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${statusTone.text}`}>
                  {extensionStatus?.status === 'payload' ? 'Capture ready' : 'Extension capture'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {extensionStatus?.message ?? 'Install and reload the unpacked extension, then paste a Maps list link above.'}
                </p>
                <p className="mt-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {getDiagnosticSummary(extensionStatus?.diagnostics) ?? (isLoadingStatus ? 'Waiting for Maps data...' : 'No capture yet')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">1</div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Download extension ZIP</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Download the GitHub ZIP, unzip it, then use Chrome's Load unpacked button on the extension folder.
          </p>
          <a
            href={EXTENSION_ZIP_URL}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            <Download size={14} />
            Download ZIP
          </a>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">2</div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Load unpacked</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Open chrome://extensions, enable Developer mode, click Load unpacked, then choose the unzipped extension directory.
          </p>
          <a
            href="chrome://extensions"
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500"
          >
            <ExternalLink size={14} />
            chrome://extensions
          </a>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-zinc-100 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">3</div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">Open one list tab</h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            Paste the list link here or in the extension popup. The extension opens a focused Maps tab and sends the captured list back here.
          </p>
          <p className="mt-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            Keep this deployed app tab open while Maps loads.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm font-semibold text-zinc-950 dark:text-white">Need the logs?</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          Click the GMapLists extension icon. The popup now shows the status pill, current progress, and the latest extension logs.
        </p>
      </section>
    </div>
  );
};
