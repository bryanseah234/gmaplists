import React, { useState, useMemo, useEffect } from 'react';
import { extractMapData } from './services/geminiService';
import { ExtractedData, Place, SortOrder, ActiveFilters } from './types';
import { InputSection } from './components/InputSection';
import { PlaceCard } from './components/PlaceCard';
import { IconMapper } from './components/IconMapper';
import { ArrowUp, ArrowDown, Map as MapIcon, RotateCcw, ExternalLink, Sun, Moon, Monitor, AlertTriangle } from 'lucide-react';

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

  // Listen for system changes if mode is system
  useEffect(() => {
    if (theme !== 'system') return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const root = window.document.documentElement;
      if (e.matches) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const handleExtract = async (input: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await extractMapData(input);
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
           // Exact match check
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

  return (
    <div className="min-h-screen bg-[#F5F5F7] dark:bg-gray-950 text-gray-900 dark:text-gray-100 pb-20 font-sans transition-colors duration-300">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-sm">
               <MapIcon size={20} />
             </div>
             <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">MapList</h1>
          </div>
          
          <div className="flex items-center gap-3">
             {/* Theme Toggle */}
             <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
                <button
                   onClick={() => setTheme('light')}
                   className={`p-1.5 rounded-md transition-all ${theme === 'light' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                   title="Light Mode"
                >
                   <Sun size={16} />
                </button>
                <button
                   onClick={() => setTheme('system')}
                   className={`p-1.5 rounded-md transition-all ${theme === 'system' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                   title="System Default"
                >
                   <Monitor size={16} />
                </button>
                <button
                   onClick={() => setTheme('dark')}
                   className={`p-1.5 rounded-md transition-all ${theme === 'dark' ? 'bg-white dark:bg-gray-700 text-indigo-600 shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                   title="Dark Mode"
                >
                   <Moon size={16} />
                </button>
             </div>

             {data && (
                <button 
                  onClick={() => setData(null)}
                  className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <RotateCcw size={14} />
                  <span className="hidden sm:inline">Scan Another</span>
                </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!data ? (
          <div className="mt-8 sm:mt-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
             <InputSection onExtract={handleExtract} isLoading={isLoading} />
             {error && (
                <div className="max-w-3xl mx-auto mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl flex items-start text-red-700 dark:text-red-300 shadow-sm animate-in zoom-in-95 duration-300">
                   <div className="mr-3 mt-0.5 text-red-500 dark:text-red-400 shrink-0">
                      <AlertTriangle size={20} />
                   </div>
                   <div className="flex-1">
                     <p className="font-bold text-sm">Extraction Error</p>
                     <p className="text-sm opacity-90 mt-1 whitespace-pre-wrap leading-relaxed">{error}</p>
                     <p className="text-xs opacity-70 mt-2">Tip: Ensure you scrolled to the bottom of your list and copied the entire text selection.</p>
                   </div>
                </div>
             )}
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Title Section */}
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2 tracking-tight">{data.list_title || 'Extracted List'}</h2>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                   <span>Found {data.places.length} places</span>
                   <span className="w-1 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></span>
                   <span>Showing {processedPlaces.length}</span>
                </div>
              </div>
              {data.list_source_url && (
                <a 
                  href={data.list_source_url} 
                  target="_blank" 
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 px-4 py-2 rounded-xl transition-colors"
                >
                  Open Original Map <ExternalLink size={14} />
                </a>
              )}
            </div>

            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row gap-8">
              
              {/* Sidebar / Filters (Left on desktop, top on mobile) */}
              <div className="w-full lg:w-72 flex-shrink-0 space-y-6">
                 
                 {/* Sorting */}
                 <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                    <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Sort By</h3>
                    <div className="space-y-1">
                       {data.ui_config.sorting_options.map((opt) => {
                          const isActive = sortField === opt.field;
                          return (
                            <button
                              key={opt.field}
                              onClick={() => toggleSort(opt.field as keyof Place)}
                              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                                isActive 
                                  ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 shadow-sm' 
                                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <IconMapper iconName={opt.icon_svg_placeholder} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500"} />
                                {opt.label}
                              </div>
                              {isActive && (
                                 <span className="bg-indigo-100 dark:bg-indigo-900/70 p-1 rounded-full text-indigo-600 dark:text-indigo-400">
                                    {sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                                 </span>
                              )}
                            </button>
                          );
                       })}
                    </div>
                 </div>

                 {/* Filter Groups */}
                 {data.ui_config.filter_groups.map((group) => (
                    <div key={group.field} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 transition-colors">
                        <div className="flex items-center gap-2 mb-4">
                           <IconMapper iconName={group.icon_svg_placeholder} className="text-gray-400 dark:text-gray-500" />
                           <h3 className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{group.label}</h3>
                        </div>
                        <div className="flex flex-wrap gap-2">
                           {group.unique_values.map((val) => {
                              const valStr = String(val);
                              const isSelected = (activeFilters[group.field] || []).includes(val);
                              return (
                                <button
                                  key={valStr}
                                  onClick={() => toggleFilter(group.field as string, val)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 dark:shadow-indigo-900/50'
                                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                  }`}
                                >
                                  {valStr === 'true' ? 'Yes' : valStr === 'false' ? 'No' : valStr}
                                </button>
                              );
                           })}
                        </div>
                    </div>
                 ))}

              </div>

              {/* Main Grid */}
              <div className="flex-1">
                 {processedPlaces.length === 0 ? (
                    <div className="bg-white dark:bg-gray-900 rounded-3xl p-12 text-center border border-gray-100 dark:border-gray-800 shadow-sm transition-colors">
                       <div className="inline-flex items-center justify-center p-4 bg-gray-50 dark:bg-gray-800 rounded-full mb-4 text-gray-400">
                          <MapIcon size={32} />
                       </div>
                       <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">No places match your filters</h3>
                       <p className="text-gray-500 dark:text-gray-400">Try adjusting your selection or search criteria.</p>
                       <button 
                          onClick={() => setActiveFilters({})}
                          className="mt-6 text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                       >
                          Clear all filters
                       </button>
                    </div>
                 ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                       {processedPlaces.map((place, idx) => (
                          <div key={idx} className="animate-in fade-in zoom-in-95 duration-500 fill-mode-backwards" style={{ animationDelay: `${idx * 50}ms` }}>
                             <PlaceCard place={place} />
                          </div>
                       ))}
                    </div>
                 )}
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
