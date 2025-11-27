import React, { useState, useEffect } from 'react';
import { Loader2, Map as MapIcon, ExternalLink, ArrowRight, AlertCircle, Sparkles, CheckCircle2, X, Copy } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../constants';
import { getCleanListUrl } from '../services/mapLinkService';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onExtract, isLoading }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [isValidUrl, setIsValidUrl] = useState(false);
  
  // New state for the "Clean" link
  const [cleanLink, setCleanLink] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  // Validate URL on change
  useEffect(() => {
    const valid = url.includes('google.com/') || url.includes('goo.gl/');
    setIsValidUrl(valid);
    if (!valid) setCleanLink(null);
  }, [url]);

  const handleNext = async () => {
    if (isValidUrl) {
      setIsResolving(true);
      // Attempt to get the optimized clean link
      const optimized = await getCleanListUrl(url);
      if (optimized) {
        setCleanLink(optimized);
      }
      setIsResolving(false);
      setStep(2);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent) return;
    try {
      await onExtract(pasteContent);
    } catch (err: any) {
      // Error handling in parent
    }
  };

  // Strictly encode the JS code so it doesn't break the href attribute with quotes
  const bookmarkletHref = `javascript:${encodeURIComponent(SCROLL_BOOKMARKLET_CODE)}`;

  return (
    <div className="w-full max-w-4xl mx-auto">
      
      {/* Hero Section / Initial State */}
      <div className={`transition-all duration-700 ease-in-out ${step === 1 ? 'translate-y-20 scale-100' : 'translate-y-0'}`}>
        
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-2xl bg-brand-600 text-white shadow-glow shadow-brand-500/30">
            <MapIcon size={32} strokeWidth={2} />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-zinc-900 dark:text-white mb-4 tracking-tight">
            Organize your Maps.
          </h1>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto leading-relaxed">
            Turn your chaotic Google Maps lists into a clean, sortable spreadsheet in seconds.
          </p>
        </div>

        <div className="relative max-w-2xl mx-auto">
          <div className={`bg-white dark:bg-zinc-900 p-2 rounded-2xl shadow-2xl shadow-zinc-200/50 dark:shadow-black/50 border border-zinc-200 dark:border-zinc-800 transition-all duration-300 ${step === 2 ? 'opacity-50 pointer-events-none scale-95 grayscale' : 'scale-100'}`}>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste your Google Maps link..."
                  className="w-full h-14 pl-5 pr-4 bg-zinc-50 dark:bg-zinc-950 border border-transparent focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 outline-none transition-all font-medium"
                  disabled={step === 2}
                  onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                />
                {url && !isValidUrl && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500 animate-in fade-in zoom-in">
                    <AlertCircle size={18} />
                  </div>
                )}
              </div>
              {step === 1 && (
                <button 
                  onClick={handleNext}
                  disabled={!isValidUrl || isResolving}
                  className="h-14 px-8 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-w-[140px] shadow-lg shadow-brand-600/20"
                >
                  {isResolving ? <Loader2 className="animate-spin" size={20} /> : <>Start <ArrowRight size={20} /></>}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Progressive Disclosure: The Workflow */}
      {step === 2 && (
        <div className="mt-16 animate-fade-in-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Step 1 Card */}
            <div className="group bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-soft hover:shadow-card transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold text-sm">1</span>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Open List</h3>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 min-h-[40px]">
                {cleanLink ? "Optimized view available. Use this for best results." : "Open your map in a new tab to start."}
              </p>
              <a 
                href={cleanLink || url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl font-medium transition-all ${
                  cleanLink 
                    ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900/30 border border-brand-200 dark:border-brand-800' 
                    : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700'
                }`}
              >
                {cleanLink ? <><Sparkles size={16} /> Clean View</> : <>Open Map <ExternalLink size={16} /></>}
              </a>
            </div>

            {/* Step 2 Card */}
            <div className="group bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-soft hover:shadow-card transition-all duration-300 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 font-bold text-sm">2</span>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Run Extractor</h3>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 min-h-[40px]">
                Drag this button to your bookmarks bar, then click it on the map tab.
              </p>
              <a 
                href={bookmarkletHref}
                onClick={(e) => e.preventDefault()}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 shadow-lg shadow-brand-500/20 cursor-grab active:cursor-grabbing transition-all"
              >
                <Sparkles size={16} className="fill-white/20" /> Extractor
              </a>
            </div>

            {/* Step 3 Card */}
            <div className="group bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200 dark:border-zinc-800 shadow-soft hover:shadow-card transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold text-sm">3</span>
                <h3 className="font-semibold text-zinc-900 dark:text-white">Paste Data</h3>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 min-h-[40px]">
                The extractor will copy the data. Paste it below.
              </p>
              <div className="w-full py-3 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/50 flex items-center justify-center text-zinc-400 dark:text-zinc-500 text-sm">
                Paste below ↓
              </div>
            </div>

          </div>

          {/* Paste Area */}
          <div className="mt-8 bg-white dark:bg-zinc-900 rounded-3xl p-2 border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <textarea
              className="w-full h-48 p-4 bg-zinc-50 dark:bg-black rounded-2xl border-none outline-none text-sm font-mono text-zinc-700 dark:text-zinc-300 resize-none focus:ring-2 focus:ring-brand-500/20 transition-all"
              placeholder="Right click > Paste (or Ctrl+V) extracted data here..."
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Actions */}
          <div className="mt-8 flex justify-center gap-4">
             <button 
               onClick={() => setStep(1)}
               className="h-12 w-40 rounded-xl bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
             >
               Start Over
             </button>
             <button
               onClick={handleSubmit}
               disabled={!pasteContent || isLoading}
               className="h-12 w-40 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/20 transition-all flex items-center justify-center gap-2"
             >
               {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Process List"}
             </button>
          </div>

        </div>
      )}
    </div>
  );
};