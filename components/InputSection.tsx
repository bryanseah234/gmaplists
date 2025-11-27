import React, { useState } from 'react';
import { Bookmark, Copy, MousePointerClick, CheckCircle2, Loader2, Map as MapIcon } from 'lucide-react';
import { SCROLL_BOOKMARKLET_CODE } from '../constants';

interface InputSectionProps {
  onExtract: (input: string) => Promise<void>;
  isLoading: boolean;
}

export const InputSection: React.FC<InputSectionProps> = ({ onExtract, isLoading }) => {
  const [inputVal, setInputVal] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal) return;
    try {
      await onExtract(inputVal);
    } catch (err: any) {
      // Error handling is done in parent, but we can add local UI feedback if needed
    }
  };

  return (
    <div className="max-w-3xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 border border-gray-100 dark:border-gray-800 text-center relative overflow-hidden transition-all duration-500">
        
        {/* Header Icon */}
        <div className="inline-flex items-center justify-center p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl mb-6 text-indigo-600 dark:text-indigo-400">
          <MapIcon size={28} />
        </div>
        
        {/* Header */}
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3 tracking-tight">Import Google Maps List</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-8 text-lg px-4 max-w-lg mx-auto">
          Use our smart bookmarklet to automatically scroll your list and copy the data for visualization.
        </p>

        {/* Input Form Content */}
        <div className="text-left space-y-8 animate-in fade-in zoom-in-95 duration-300">
          
          {/* Step 1: The Drag Target */}
          <div className="bg-indigo-50/50 dark:bg-indigo-950/30 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row items-center gap-6 transition-colors">
            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 font-bold text-xl">1</div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Install the Scroller</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Drag this button to your browser's Bookmarks Bar.</p>
              
              {/* The Bookmarklet Button */}
              <a 
                href={SCROLL_BOOKMARKLET_CODE}
                className="inline-flex items-center gap-2 bg-white dark:bg-gray-800 border-2 border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 font-bold py-3 px-6 rounded-xl hover:bg-indigo-50 dark:hover:bg-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-all cursor-grab active:cursor-grabbing shadow-sm"
                onClick={(e) => e.preventDefault()} // Prevent click, meant for drag
                title="Drag me to your bookmarks bar!"
              >
                 <Bookmark size={18} className="fill-indigo-600 dark:fill-indigo-400" />
                 MapList Scroller
              </a>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 italic">Don't see the bar? Press Ctrl+Shift+B (Cmd+Shift+B)</p>
            </div>
          </div>

          {/* Step 2: Usage */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-center gap-6 shadow-sm transition-colors">
             <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-xl">2</div>
             <div className="flex-1">
               <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Run on Google Maps</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400">
                 Go to your Google Maps list tab and click the <strong>"MapList Scroller"</strong> bookmark you just created. 
               </p>
               <div className="flex gap-2 mt-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs rounded-md">
                    <MousePointerClick size={12} /> Auto-scrolls to bottom
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs rounded-md">
                    <Copy size={12} /> Auto-copies text
                  </span>
               </div>
             </div>
          </div>

           {/* Step 3: Paste */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row items-start gap-6 shadow-sm transition-colors">
             <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-bold text-xl">3</div>
             <div className="flex-1 w-full">
               <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Paste Data Here</h3>
               <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                 Once the alert says "Done!", paste the content below.
               </p>
               <textarea
                  className="block w-full p-4 bg-gray-50 dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-0 focus:border-indigo-500 focus:bg-white dark:focus:bg-gray-900 transition-all duration-300 min-h-[120px] text-xs font-mono resize-none"
                  placeholder="Paste the copied text here..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  disabled={isLoading}
               />
               <div className="mt-4 flex justify-end">
                  <button
                    onClick={(e) => handleSubmit(e)}
                    disabled={isLoading || !inputVal}
                    className={`px-6 py-3 rounded-xl font-semibold text-white transition-all duration-300 flex items-center gap-2 ${
                      isLoading || !inputVal
                        ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-none'
                    }`}
                  >
                    {isLoading ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                    Process List
                  </button>
               </div>
             </div>
          </div>

        </div>

      </div>
    </div>
  );
};