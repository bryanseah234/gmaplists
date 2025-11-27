import React, { useState, useEffect } from 'react';
import { Loader2, Map as MapIcon, ExternalLink, ArrowRight, AlertCircle, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
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
    setCleanLink(null); // Reset clean link when URL changes
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

  const bookmarkletHtml = `
    <a href="${bookmarkletHref}" 
       class="inline-flex items-center gap-2 bg-blue-50 dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-bold py-3 px-5 rounded-xl hover:bg-blue-100 dark:hover:bg-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all cursor-grab active:cursor-grabbing shadow-sm w-full justify-center"
       title="Drag Extractor to your bookmarks bar!"
       onclick="return false;">
       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fill-blue-600 dark:fill-blue-400"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
       Extractor
    </a>
  `;

  return (
    <div className="max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-white dark:bg-gray-900 rounded-[2rem] shadow-apple border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-500">
        
        {/* Step 1: URL Input */}
        <div className={`p-8 sm:p-10 transition-all duration-500 ${step === 2 ? 'opacity-50 pointer-events-none bg-gray-50 dark:bg-gray-950/50 grayscale' : ''}`}>
          <div className="flex flex-col md:flex-row md:items-center gap-8">
             <div className="flex-shrink-0 inline-flex items-center justify-center w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-3xl text-blue-500 dark:text-blue-400 shadow-inner">
                <MapIcon size={40} strokeWidth={1.5} />
             </div>
             <div className="flex-1">
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Start with your Map Link</h2>
               <p className="text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
                 Paste the link to the Google Maps list you want to organize (e.g., <code>https://maps.app.goo.gl/...</code>).
               </p>
               <div className="flex flex-col sm:flex-row gap-3">
                 <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste link here..."
                    className="flex-1 p-3.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 dark:text-white outline-none transition-all shadow-sm font-medium"
                    disabled={step === 2}
                 />
                 {step === 1 && (
                   <button 
                      onClick={handleNext}
                      disabled={!isValidUrl || isResolving}
                      className={`px-8 py-3.5 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                        isValidUrl 
                          ? 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transform hover:-translate-y-0.5' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                   >
                      {isResolving ? <Loader2 className="animate-spin h-5 w-5" /> : <>Next <ArrowRight size={20} /></>}
                   </button>
                 )}
               </div>
               {!isValidUrl && url.length > 5 && (
                 <p className="text-red-500 text-sm mt-3 flex items-center gap-1.5 font-medium">
                   <AlertCircle size={14} /> Please enter a valid Google Maps link
                 </p>
               )}
             </div>
          </div>
        </div>

        {/* Step 2: The Wizard */}
        {step === 2 && (
          <div className="border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-10 duration-500 bg-white dark:bg-gray-900">
            
            <div className="p-8 sm:p-10 space-y-10">
              
              {/* Instruction Header */}
              <div className="text-center max-w-lg mx-auto">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Ready to Extract</h3>
                <p className="text-gray-500 dark:text-gray-400">Follow these 3 simple steps to get your data.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Action 1: Open Link */}
                <div className={`rounded-2xl p-6 border flex flex-col items-center text-center transition-colors ${cleanLink ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800/30' : 'bg-gray-50/50 dark:bg-gray-800/20 border-gray-100 dark:border-gray-800'}`}>
                   <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg mb-4 shadow-sm ${cleanLink ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-100 dark:border-gray-600'}`}>1</div>
                   <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Open Map</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 flex-1 leading-relaxed">
                     {cleanLink ? "Optimized view found. Use this for 100% accuracy." : "Open your list in a new tab to prepare for scrolling."}
                   </p>
                   
                   <a 
                     href={cleanLink || url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`w-full inline-flex items-center justify-center gap-2 font-bold py-3 rounded-xl transition-all text-sm ${
                        cleanLink 
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-200 dark:shadow-blue-900/20 transform hover:-translate-y-0.5' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm'
                     }`}
                   >
                     {cleanLink ? <><Sparkles size={16} /> Open Clean View</> : <>Open Map <ExternalLink size={16} /></>}
                   </a>
                </div>

                {/* Action 2: Bookmarklet */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl p-6 border border-blue-100 dark:border-blue-800/30 flex flex-col items-center text-center relative">
                   <div className="absolute -top-3 -right-3 bg-blue-600 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-md animate-bounce uppercase tracking-wide">Drag Me</div>
                   <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-lg mb-4 shadow-sm">2</div>
                   <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Install Extractor</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 flex-1 leading-relaxed">Drag this button to your bookmarks bar. Click it on the map tab.</p>
                   
                   <div className="w-full" dangerouslySetInnerHTML={{ __html: bookmarkletHtml }} />
                </div>

                {/* Action 3: Paste */}
                <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-2xl p-6 border border-emerald-100 dark:border-emerald-800/30 flex flex-col items-center text-center">
                   <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold text-lg mb-4 shadow-sm">3</div>
                   <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Paste Data</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 flex-1 leading-relaxed">The extractor will copy the data automatically for you.</p>
                   <div className="w-full py-3 flex items-center justify-center bg-white/80 dark:bg-gray-800 rounded-xl text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 text-xs font-medium cursor-default select-none">
                      Paste below &darr;
                   </div>
                </div>

              </div>

              {/* Large Paste Area */}
              <div className="mt-8">
                 <textarea
                    className="block w-full p-5 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white dark:focus:bg-gray-900 transition-all duration-300 min-h-[180px] text-sm font-mono resize-none shadow-inner"
                    placeholder="Right click > Paste (or Ctrl+V) the extracted data here..."
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    disabled={isLoading}
                 />
                 <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button 
                      onClick={() => setStep(1)}
                      className="w-full sm:w-48 px-6 py-4 rounded-2xl font-bold text-white bg-red-500 hover:bg-red-600 transition-all duration-300 shadow-lg shadow-red-200 dark:shadow-none flex items-center justify-center gap-2 hover:scale-105 active:scale-95"
                    >
                      <XCircle size={20} /> Start Over
                    </button>
                    <button
                      onClick={(e) => handleSubmit(e)}
                      disabled={isLoading || !pasteContent}
                      className={`w-full sm:w-48 px-6 py-4 rounded-2xl font-bold text-white transition-all duration-300 flex items-center justify-center gap-2 ${
                        isLoading || !pasteContent
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 hover:scale-105 active:scale-95'
                      }`}
                    >
                      {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                      Process List
                    </button>
                 </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};