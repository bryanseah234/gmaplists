import React, { useState, useMemo, useEffect } from 'react';
import { parseMapData } from './services/parserService';
import { ExtractedData, Place, SortOrder, ActiveFilters } from './types';
import { InputSection } from './components/InputSection';
import { PlaceCard } from './components/PlaceCard';
import { IconMapper } from './components/IconMapper';
import { ArrowUp, ArrowDown, Map as MapIcon, RotateCcw, ExternalLink, Sun, Moon, Monitor, AlertTriangle, Download, FileSpreadsheet, Check } from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';

export default function App() {
  const [data, setData] = useState<ExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sorting State
  const [sortField, setSortField] = useState<keyof Place | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // Filter State
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({});

  // Export State
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');

  // Theme State
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maplist-theme');
      return (saved as Theme) || 'system';
    }
    return 'system';
  });

  // Apply Theme strictly
  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (targetTheme: 'light' | 'dark') => {
      if (targetTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
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
      // Use manual parser instead of AI
      const result = await parseMapData(input);
      setData(result);
      // Reset filters on new data
      setActiveFilters({});
      setSortField(null);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred while processing your data.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleFilter = (field: string, value: string | boolean) => {
    setActiveFilters((prev) => {
      const current = prev[field] || [];
      const exists = current.includes(value);
      
      let updated;
      if (exists) {
        updated = current.filter((v) => v !== value);
      } else {
        updated = [...current, value];
      }

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
      setSortOrder('desc'); // Default to high-to-low for most metrics
    }
  };

  // Derived Data: Filtered & Sorted
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

        // Handle types slightly safely
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

  // --- Export Functions ---

  const escapeCsv = (str: string | number | boolean | undefined) => {
    if (str === undefined || str === null) return '';
    const stringValue = String(str);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const downloadCSV = () => {
    if (!processedPlaces.length) return;
    
    const headers = ['Name', 'Category', 'Specific Type', 'Rating', 'Reviews', 'Price', 'Price Level', 'Notes', 'Link'];
    const rows = processedPlaces.map(p => [
      p.place_name,
      p.primary_category,
      p.detailed_category,
      p.star_rating,
      p.review_count,
      p.price_range_code > 0 ? '$'.repeat(p.price_range_code) : '',
      p.price_range_code || '',
      p.user_notes || '',
      p.google_maps_link || ''
    ].map(escapeCsv).join(','));
    
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `maplist_export_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Robust fallback copy
  const fallbackCopyTextToClipboard = (text: string) => {
    var textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      var successful = document.execCommand('copy');
      if(successful) {
         setCopyStatus('copied');
         setTimeout(() => setCopyStatus('idle'), 3000);
         alert("Data copied! Open your spreadsheet and press Ctrl+V.");
         window.open('https://sheets.new', '_blank');
      } else {
         alert("Fallback copy failed.");
      }
    } catch (err) {
      alert("Failed to copy");
    }
    document.body.removeChild(textArea);
  }

  const exportToSheets = () => {
    if (!processedPlaces.length) return;

    const headers = ['Name', 'Category', 'Specific Type', 'Rating', 'Reviews', 'Price', 'Price Level', 'Notes', 'Link'];
    const rows = processedPlaces.map(p => [
      p.place_name,
      p.primary_category,
      p.detailed_category,
      p.star_rating,
      p.review_count,
      p.price_range_code > 0 ? '$'.repeat(p.price_range_code) : '',
      p.price_range_code || '',
      p.user_notes || '',
      p.google_maps_link || ''
    ].map(val => String(val || '').replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));

    const tsvContent = [headers.join('\t'), ...rows].join('\n');
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tsvContent).then(() => {
          setCopyStatus('copied');
          alert("Data copied to clipboard!\n\n1. A new Google Sheet will open.\n2. Click cell A1.\n3. Press Ctrl+V to paste.");
          const win = window.open('https://sheets.new', '_blank');
          if (win) win.focus();
          setTimeout(() => setCopyStatus('idle'), 3000);
      }).catch(err => {
          fallbackCopyTextToClipboard(tsvContent);
      });
    } else {
      fallbackCopyTextToClipboard(tsvContent);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20 font-sans transition-colors duration-300">
      {/* Header - Glassmorphism */}
      <header className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl sticky top-0 z-20 border-b border-gray-200/50 dark:border-gray-800/50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Brand */}
          <div className="flex items-center gap-2.5">
             <div className="bg-blue-500 text-white p-1.5 rounded-xl shadow-sm shadow-blue-200 dark:shadow-none">
               <MapIcon size={20} strokeWidth={2.5} />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">MapList</h1>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center gap-4">
             {data && (
                <button 
                  onClick={() => setData(null)}
                  className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">Scan Another</span>
                </button>
             )}

             {/* Segmented Theme Toggle */}
             <div className="flex items-center bg-gray-200/50 dark:bg-gray-800/50 rounded-full p-1 border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm">
                <button
                   onClick={() => setTheme('light')}
                   className={`p-1.5 rounded-full transition-all duration-200 ${theme === 'light' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                   title="Light Mode"
                >
                   <Sun size={14} />
                </button>
                <button
                   onClick={() => setTheme('system')}
                   className={`p-1.5 rounded-full transition-all duration-200 ${theme === 'system' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                   title="System Default"
                >
                   <Monitor size={14} />
                </button>
                <button
                   onClick={() => setTheme('dark')}
                   className={`p-1.5 rounded-full transition-all duration-200 ${theme === 'dark' ? 'bg-white dark:bg-gray-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                   title="Dark Mode"
                >
                   <Moon size={14} />
                </button>
             </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!data ? (
          <div className="mt-8 sm:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
             <InputSection onExtract={handleExtract} isLoading={isLoading} />
             {error && (
                <div className="max-w-3xl mx-auto mt-6 p-4 bg-red-50/80 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 rounded-2xl flex items-start text-red-600 dark:text-red-300 shadow-sm backdrop-blur-sm animate-in zoom-in-95 duration-300">
                   <div className="mr-3 mt-0.5 text-red-500 dark:text-red-400 shrink-0">
                      <AlertTriangle size={20} />
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-sm">Extraction Error</p>
                     <p className="text-sm opacity-90 mt-1 whitespace-pre-wrap leading-relaxed">{error}</p>
                   </div>
                </div>
             )}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Title Section */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{data.list_title || 'Extracted List'}</h2>
                <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                   <span className="bg-white dark:bg-gray-800 px-2.5 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm text-gray-700 dark:text-gray-200">{data.places.length} items</span>
                   {data.list_source_url && (
                    <>
                      <span className="text-gray-300 dark:text-gray-600">•</span>
                      <a 
                        href={data.list_source_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        View Map <ExternalLink size={12} />
                      </a>
                    </>
                   )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={downloadCSV}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 px-5 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md"
                >
                  <Download size={16} />
                  CSV
                </button>
                <button
                  onClick={exportToSheets}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#1DA362] hover:bg-[#178c52] px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-green-200 dark:shadow-none hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
                >
                  {copyStatus === 'copied' ? <Check size={16} /> : <FileSpreadsheet size={16} />}
                  {copyStatus === 'copied' ? 'Copied!' : 'Copy for Sheets'}
                </button>
              </div>
            </div>

            {/* Unified Controls Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Sort Pills */}
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-apple border border-gray-100 dark:border-gray-800/50">
                 <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-1">Sort By</h3>
                 </div>
                 <div className="flex flex-wrap gap-2">
                    {data.ui_config.sorting_options.map((opt) => {
                       const isActive = sortField === opt.field;
                       return (
                         <button
                           key={opt.field}
                           onClick={() => toggleSort(opt.field as keyof Place)}
                           className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex items-center gap-2 border ${
                             isActive 
                               ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-200 dark:shadow-blue-900/30' 
                               : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                           }`}
                         >
                           <IconMapper iconName={opt.icon_svg_placeholder} className={isActive ? "text-white/90" : "text-gray-400 dark:text-gray-500"} />
                           {opt.label}
                           {isActive && (
                              <span className="ml-1 text-white/90">
                                 {sortOrder === 'asc' ? <ArrowUp size={14} strokeWidth={3} /> : <ArrowDown size={14} strokeWidth={3} />}
                              </span>
                           )}
                         </button>
                       );
                    })}
                 </div>
              </div>

              {/* Filter Pills */}
              {data.ui_config.filter_groups.map((group) => (
                 <div key={group.field} className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-apple border border-gray-100 dark:border-gray-800/50">
                     <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider ml-1">{group.label}</h3>
                     </div>
                     <div className="flex flex-wrap gap-2">
                        {group.unique_values.map((val) => {
                           const valStr = String(val);
                           const isSelected = (activeFilters[group.field] || []).includes(val);
                           return (
                             <button
                               key={valStr}
                               onClick={() => toggleFilter(group.field as string, val)}
                               className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                                 isSelected
                                   ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-200 dark:shadow-blue-900/30'
                                   : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                               }`}
                             >
                               {valStr}
                             </button>
                           );
                        })}
                     </div>
                 </div>
              ))}

            </div>

            {/* Main Grid */}
            <div className="w-full min-h-[50vh]">
               {processedPlaces.length === 0 ? (
                  <div className="bg-white dark:bg-gray-900 rounded-3xl p-16 text-center border border-gray-100 dark:border-gray-800 shadow-sm">
                     <div className="inline-flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-800 rounded-full mb-6 text-gray-300 dark:text-gray-600">
                        <MapIcon size={48} strokeWidth={1.5} />
                     </div>
                     <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No places found</h3>
                     <p className="text-gray-500 dark:text-gray-400 max-w-xs mx-auto">Try selecting different categories or sorting options.</p>
                     <button 
                        onClick={() => setActiveFilters({})}
                        className="mt-8 text-blue-600 dark:text-blue-400 font-semibold hover:underline decoration-2 underline-offset-4"
                     >
                        Clear all filters
                     </button>
                  </div>
               ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                     {processedPlaces.map((place, idx) => (
                        <div key={idx} className="animate-in fade-in zoom-in-95 duration-500 fill-mode-backwards" style={{ animationDelay: `${Math.min(idx * 50, 1000)}ms` }}>
                           <PlaceCard place={place} />
                        </div>
                     ))}
                  </div>
               )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}