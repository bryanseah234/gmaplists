
import React, { useState, useEffect } from 'react';
import { Bookmark, Copy, MousePointerClick, CheckCircle2, Loader2, Map as MapIcon, ExternalLink, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';
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

  // Only the link tag structure itself is dangerously set to allow the javascript: protocol 
  // (React 19 blocks it in standard JSX), but the *content* of the href is safe.
  const bookmarkletHtml = `
    <a href="${bookmarkletHref}" 
       class="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold py-3 px-4 rounded-xl hover:bg-indigo-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-grab active:cursor-grabbing shadow-sm w-full justify-center"
       title="Drag Extractor to your bookmarks bar!"
       onclick="return false;">
       <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="fill-indigo-600 dark:fill-indigo-400"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>
       Extractor
    </a>
  `;

  return (
    <div className="max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-500">
        
        {/* Step 1: URL Input */}
        <div className={`p-8 transition-all duration-500 ${step === 2 ? 'opacity-50 pointer-events-none bg-gray-50 dark:bg-gray-950/50' : ''}`}>
          <div className="flex flex-col md:flex-row md:items-center gap-6">
             <div className="flex-shrink-0 inline-flex items-center justify-center w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl text-indigo-600 dark:text-indigo-400">
                <MapIcon size={32} />
             </div>
             <div className="flex-1">
               <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Start with your Map Link</h2>
               <p className="text-gray-500 dark:text-gray-400 mb-4">
                 Paste the link to the Google Maps list you want to organize (e.g., <code>https://maps.app.goo.gl/...</code>).
               </p>
               <div className="flex gap-3">
                 <input 
                    type="text" 
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste link here..."
                    className="flex-1 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white outline-none transition-all"
                    disabled={step === 2}
                 />
                 {step === 1 && (
                   <button 
                      onClick={handleNext}
                      disabled={!isValidUrl || isResolving}
                      className={`px-6 py-3 rounded-xl font-semibold text-white transition-all flex items-center gap-2 ${
                        isValidUrl 
                          ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none' 
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                   >
                      {isResolving ? <Loader2 className="animate-spin h-5 w-5" /> : <>Next <ArrowRight size={18} /></>}
                   </button>
                 )}
               </div>
               {!isValidUrl && url.length > 5 && (
                 <p className="text-red-500 text-xs mt-2 flex items-center gap-1">
                   <AlertCircle size={12} /> Please enter a valid Google Maps link
                 </p>
               )}
             </div>
          </div>
        </div>

        {/* Step 2: The Wizard */}
        {step === 2 && (
          <div className="border-t border-gray-100 dark:border-gray-800 animate-in slide-in-from-bottom-10 duration-500">
            
            <div className="p-8 space-y-8">
              
              {/* Instruction Header */}
              <div className="text-center mb-8">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Ready to Extract</h3>
                <p className="text-gray-500 dark:text-gray-400">Follow these 3 simple steps to get your data.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Action 1: Open Link */}
                <div className={`rounded-2xl p-5 border flex flex-col items-center text-center ${cleanLink ? 'bg-indigo-50/50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800/30' : 'bg-gray-50/50 dark:bg-gray-800/20 border-gray-100 dark:border-gray-800'}`}>
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mb-3 ${cleanLink ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300' : 'bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>1</div>
                   <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Open Map</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex-1">
                     {cleanLink ? "We found an optimized view. Use this for best results." : "Open your list in a new tab to prepare for scrolling."}
                   </p>
                   
                   <a 
                     href={cleanLink || url} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className={`w-full inline-flex items-center justify-center gap-2 font-semibold py-2.5 rounded-xl transition-colors text-sm ${
                        cleanLink 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md shadow-indigo-200 dark:shadow-indigo-900/20' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                     }`}
                   >
                     {cleanLink ? <><Sparkles size={14} /> Open Clean View</> : <>Open Map <ExternalLink size={14} /></>}
                   </a>
                   {cleanLink && (
                     <div className="mt-2">
                        <a href={url} target="_blank" rel="noreferrer" className="text-[10px] text-gray-400 hover:underline">
                           Or open standard view
                        </a>
                     </div>
                   )}
                </div>

                {/* Action 2: Bookmarklet */}
                <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl p-5 border border-indigo-100 dark:border-indigo-800/30 flex flex-col items-center text-center relative">
                   <div className="absolute -top-3 -right-3 bg-indigo-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm animate-bounce">DRAG ME</div>
                   <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold mb-3">2</div>
                   <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Install Extractor</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex-1">Drag to bookmarks bar. Click it when on the map tab.</p>
                   
                   {/* Dangerous HTML Injection to bypass React blocking javascript: protocol. */}
                   <div className="w-full" dangerouslySetInnerHTML={{ __html: bookmarkletHtml }} />
                </div>

                {/* Action 3: Paste */}
                <div className="bg-green-50/50 dark:bg-green-900/10 rounded-2xl p-5 border border-green-100 dark:border-green-800/30 flex flex-col items-center text-center">
                   <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 flex items-center justify-center font-bold mb-3">3</div>
                   <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Paste Data</h4>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex-1">The extractor will copy the data automatically.</p>
                   <div className="w-full h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 text-xs">
                      Paste below &darr;
                   </div>
                </div>

              </div>

              {/* Large Paste Area */}
              <div className="mt-6">
                 <textarea
                    className="block w-full p-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 transition-all duration-300 min-h-[150px] text-xs font-mono resize-none shadow-inner"
                    placeholder="Right click > Paste (or Ctrl+V) the extracted data here..."
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    disabled={isLoading}
                 />
                 <div className="mt-4 flex justify-between items-center">
                    <button 
                      onClick={() => setStep(1)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                    >
                      Back to start
                    </button>
                    <button
                      onClick={(e) => handleSubmit(e)}
                      disabled={isLoading || !pasteContent}
                      className={`px-8 py-3 rounded-xl font-bold text-white transition-all duration-300 flex items-center gap-2 ${
                        isLoading || !pasteContent
                          ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 hover:scale-105 active:scale-95'
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
