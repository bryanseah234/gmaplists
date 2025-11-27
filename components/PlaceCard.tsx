import React from 'react';
import { Place } from '../types';
import { Star, MessageSquare, MapPin } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place }) => {
  return (
    <div className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800/60 p-5 hover:border-brand-200 dark:hover:border-brand-900 hover:shadow-soft transition-all duration-200 flex flex-col h-full relative overflow-hidden">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <span className="px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-[11px] font-semibold uppercase tracking-wider">
          {place.detailed_category || place.primary_category}
        </span>
        
        {place.google_maps_link && (
          <a 
            href={place.google_maps_link}
            target="_blank" 
            rel="noreferrer"
            className="text-zinc-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            title="View on Maps"
          >
            <MapPin size={16} />
          </a>
        )}
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white leading-snug mb-1 line-clamp-2 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {place.place_name}
        </h3>

        {/* Metrics */}
        <div className="flex items-center gap-4 mt-3 text-sm">
          {place.star_rating > 0 && (
            <div className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-200">
              <Star size={14} className="fill-amber-400 text-amber-400" />
              {place.star_rating}
            </div>
          )}
          
          {place.review_count > 0 && (
            <div className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <MessageSquare size={14} />
              {place.review_count.toLocaleString()}
            </div>
          )}

          {place.price_range_code > 0 && (
             <div className="flex gap-0.5">
                {[...Array(4)].map((_, i) => (
                  <span key={i} className={`text-xs font-bold ${i < place.price_range_code ? 'text-zinc-900 dark:text-white' : 'text-zinc-200 dark:text-zinc-800'}`}>$</span>
                ))}
             </div>
          )}
        </div>
      </div>

      {/* Notes Footer */}
      {place.user_notes && (
        <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-xs text-zinc-500 dark:text-zinc-500 leading-relaxed line-clamp-3 italic">
            "{place.user_notes}"
          </p>
        </div>
      )}
    </div>
  );
};