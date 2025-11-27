import React, { useEffect, useState } from 'react';
import { Map as MapIcon, Monitor, Smartphone } from 'lucide-react';

export const MobileSplash: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      // Check if width is less than 1024px (Tablets and Phones)
      setIsMobile(window.innerWidth < 1024);
    };

    // Check initially
    checkDevice();

    // Check on resize
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  if (!isMobile) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="bg-brand-600/10 p-4 rounded-2xl mb-6 ring-1 ring-brand-500/20">
        <MapIcon size={48} className="text-brand-500" strokeWidth={1.5} />
      </div>
      
      <h1 className="text-2xl font-bold tracking-tight mb-3">
        Desktop Experience Required
      </h1>
      
      <p className="text-zinc-400 max-w-md leading-relaxed mb-8">
        GMapList is a powerful data tool designed for large displays and multitasking. 
        Please open this link on your computer for the best experience.
      </p>

      <div className="flex items-center gap-4 text-sm font-medium text-zinc-500 bg-zinc-900/50 px-6 py-3 rounded-full border border-zinc-800">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-red-500" />
          <span className="line-through decoration-red-500/50">Mobile</span>
        </div>
        <div className="w-px h-4 bg-zinc-700"></div>
        <div className="flex items-center gap-2">
          <Monitor size={16} className="text-emerald-500" />
          <span className="text-emerald-500">Desktop</span>
        </div>
      </div>
    </div>
  );
};