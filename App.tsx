import React, { useState, useMemo, useEffect } from 'react';
import { parseMapData } from './services/parserService';
import { ExtractedData, Place, SortOrder, ActiveFilters } from './types';
import { InputSection } from './components/InputSection';
import { PlaceCard } from './components/PlaceCard';
import { IconMapper } from './components/IconMapper';
import { ArrowUp, ArrowDown, RotateCcw, ExternalLink, Sun, Moon, Monitor, AlertTriangle, Download, FileSpreadsheet, Check, Map as MapIcon } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof Place | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // Theme Init
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('maplist-theme') as Theme) || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const applyTheme = (t: 'light' | 'dark') => {
      if (t === 'dark') root.classList.add('dark');
      else root.classList.remove('dark');
    };
    if (theme === 'system') {
      const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemIsDark ? 'dark' : 'light');
    } else {
      applyTheme(theme);
    }
    localStorage.setItem('maplist-theme', theme);
  }, [theme]);

  const handleExtract = async (input: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await parseMapData(input);
      setData(result);
      setActiveFilters({});
      setSortField(null);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Processing failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFilter = (field: string, value: string | boolean) => {
    setActiveFilters((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      let updated = exists ? current.filter((v) => v !== value) : [...current, value];
      if (updated.length === 0) {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [field]: updated };
    });
  };

  const toggleSort = (field: keyof Place) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const processedPlaces = useMemo(() => {
    if (!data) return [];
    let places = [...data.places];
    // Filter
    Object.entries(activeFilters).forEach(([field, values]) => {
      const typedValues = values as (string | boolean)[];
      if (typedValues.length > 0) {
        places = places.filter((p) => {
           const val = p[field as keyof Place];
           return typedValues.includes(val as any);
        });
      }
    });
    // Sort
    if (sortField) {
      places.sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return 0;
      });
    }
    return places;
  }, [data, activeFilters, sortField, sortOrder]);

  // --- Export Helpers (Simplified for brevity) ---
  const escapeCsv = (str: any) => {
    if (str === undefined || str === null) return '';
    const s = String(str);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const downloadCSV = () => {
    if (!processedPlaces.length) return;
    const headers = ['Name', 'Category', 'Type', 'Rating', 'Reviews', 'Price', 'Notes', 'Link'];
    const rows = processedPlaces.map(p => [
      p.place_name, p.primary_category, p.detailed_category, p.star_rating, p.review_count,
      p.price_range_code > 0 ? '$'.repeat(p.price_range_code) : '',
      p.user_notes || '', p.google_maps_link || ''
    ].map(escapeCsv).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maplist_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
  };

  const fallbackCopy = (text: string) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try {
      document.execCommand('copy');
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 3000);
      alert("Copied! Ready to paste into spreadsheet.");
      window.open('https://sheets.new', '_blank');
    } catch (e) { alert("Copy failed."); }
    document.body.removeChild(ta);
  };

  const exportToSheets = () => {
    if (!processedPlaces.length) return;
    const headers = ['Name', 'Category', 'Type', 'Rating', 'Reviews', 'Price', 'Notes', 'Link'];
    const rows = processedPlaces.map(p => [
      p.place_name, p.primary_category, p.detailed_category, p.star_rating, p.review_count,
      p.price_range_code > 0 ? '$'.repeat(p.price_range_code) : '',
      p.user_notes || '', p.google_maps_link || ''
    ].map(v => String(v||'').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
    const tsv = [headers.join('\t'), ...rows].join('\n');
    if (navigator.clipboard) {
      navigator.clipboard.writeText(tsv).then(() => {
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 3000);
        alert("Copied! Opening new sheet...");
        window.open('https://sheets.new', '_blank');
      }).catch(() => fallbackCopy(tsv));
    } else {
      fallbackCopy(tsv);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 selection:bg-brand-200 dark:selection:bg-brand-900">
      
      {/* Refined Glass Header */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-black/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="bg-brand-600 text-white p-1.5 rounded-lg">
               <MapIcon size={18} strokeWidth={2.5} />
             </div>
             <h1 className="text-lg font-bold tracking-tight">MapList</h1>
          </div>
          
          <div className="flex items-center gap-3">
             {data && (
                <button 
                  onClick={() => setData(null)}
                  className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">Scan Another</span>
                </button>
             )}

             <div className="flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800">
                {(['light', 'system', 'dark'] as Theme[]).map((t) => {
                  const icons = { light: Sun, system: Monitor, dark: Moon };
                  const Icon = icons[t];
                  return (
                    <button
                      key={t}
                      onClick={() => setTheme(t)}
                      className={`p-1.5 rounded-full transition-all ${theme === t ? 'bg-white dark:bg-zinc-800 text-brand-600 dark:text-brand-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                    >
                      <Icon size={14} />
                    </button>
                  )
                })}
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12">
        {!data ? (
          <InputSection onExtract={handleExtract} isLoading={isLoading} />
        ) : (
          <div className="animate-fade-in-up space-y-8">
            
            {/* Dashboard Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
              <div>
                <h2 className="text-3xl font-bold text-zinc-900 dark:text-white tracking-tight">{data.list_title || 'Extracted List'}</h2>
                <div className="mt-2 flex items-center gap-3 text-sm text-zinc-500">
                  <span className="font-medium">{processedPlaces.length} Places</span>
                  {data.list_source_url && (
                    <>
                      <span>•</span>
                      <a href={data.list_source_url} target="_blank" className="flex items-center gap-1 hover:text-brand-600 transition-colors">
                        Original Map <ExternalLink size={12} />
                      </a>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button onClick={downloadCSV} className="h-10 px-4 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all flex items-center gap-2">
                  <Download size={16} /> CSV
                </button>
                <button onClick={exportToSheets} className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20">
                  {copyStatus === 'copied' ? <Check size={16} /> : <FileSpreadsheet size={16} />}
                  {copyStatus === 'copied' ? 'Copied!' : 'Sheets'}
                </button>
              </div>
            </div>

            {/* Filter & Sort Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sort */}
              <div className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-1 overflow-x-auto scrollbar-hide">
                 <div className="px-3 flex items-center text-xs font-bold text-zinc-400 uppercase tracking-wider">Sort</div>
                 {data.ui_config.sorting_options.map(opt => {
                   const isActive = sortField === opt.field;
                   return (
                     <button
                       key={opt.field}
                       onClick={() => toggleSort(opt.field as keyof Place)}
                       className={`flex-1 min-w-[100px] px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                         isActive ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 shadow-sm' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                       }`}
                     >
                       <IconMapper iconName={opt.icon_svg_placeholder} className="w-4 h-4" />
                       {opt.label}
                       {isActive && (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                     </button>
                   )
                 })}
              </div>

              {/* Categories */}
              {/* Fixed TS error: unintentional comparison by casting to string */}
              {data.ui_config.filter_groups.filter(g => (g.field as string) !== 'accessibility').map(group => (
                <div key={group.field} className="bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex gap-1 overflow-x-auto scrollbar-hide">
                   <div className="px-3 flex items-center text-xs font-bold text-zinc-400 uppercase tracking-wider">Filter</div>
                   {group.unique_values.map(val => {
                      const isActive = (activeFilters[group.field] || []).includes(val);
                      return (
                        <button
                          key={String(val)}
                          onClick={() => toggleFilter(group.field as string, val)}
                          className={`flex-1 min-w-[80px] px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                            isActive ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md' : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                          }`}
                        >
                          {String(val)}
                        </button>
                      )
                   })}
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
               {processedPlaces.map((place, idx) => (
                 <div key={idx} className="animate-fade-in-up" style={{ animationDelay: `${idx * 30}ms` }}>
                    <PlaceCard place={place} />
                 </div>
               ))}
            </div>

            {processedPlaces.length === 0 && (
              <div className="text-center py-20">
                 <div className="inline-flex p-4 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 mb-4">
                    <MapIcon size={32} />
                 </div>
                 <p className="text-zinc-500">No places match your filters.</p>
                 <button onClick={() => setActiveFilters({})} className="mt-4 text-brand-600 hover:underline text-sm font-medium">Clear Filters</button>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}