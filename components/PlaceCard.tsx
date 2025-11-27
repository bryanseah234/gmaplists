import React from 'react';
import { Place } from '../types';
import { Star, Users, DollarSign, MapPin } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-[1.25rem] p-6 shadow-apple hover:shadow-apple-hover transition-all duration-300 border border-gray-100 dark:border-gray-800 flex flex-col justify-between h-full group hover:-translate-y-1">
      <div>
        <div className="flex justify-between items-start mb-3">
          <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 tracking-wider uppercase border border-blue-100 dark:border-blue-800/50">
            {place.detailed_category || place.primary_category}
          </span>
          {place.google_maps_link && (
             <a 
               href={place.google_maps_link}
               target="_blank"
               rel="noreferrer"
               className="text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors p-1.5 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30"
               title="View on Google Maps"
             >
                <MapPin size={18} />
             </a>
          )}
        </div>
        
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
          {place.place_name}
        </h3>
        
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-5 gap-4">
          {place.star_rating > 0 && (
            <div className="flex items-center text-amber-500 font-bold">
              <Star size={14} className="fill-current mr-1.5" />
              {place.star_rating.toFixed(1)}
            </div>
          )}
          {place.review_count > 0 && (
            <div className="flex items-center text-gray-400 dark:text-gray-500 text-xs">
              <Users size={14} className="mr-1.5" />
              {place.review_count.toLocaleString()}
            </div>
          )}
          {place.price_range_code > 0 && (
            <div className="flex items-center text-gray-400 dark:text-gray-500">
               <div className="flex -space-x-0.5">
                  {[...Array(4)].map((_, i) => (
                     <span key={i} className={`text-xs ${i < place.price_range_code ? "text-gray-900 dark:text-white font-bold" : "text-gray-200 dark:text-gray-700"}`}>$</span>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>

      {place.user_notes && (
        <div className="mt-auto pt-4 border-t border-gray-50 dark:border-gray-800">
          <p className="text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed line-clamp-3">
            <span className="font-semibold text-gray-400 dark:text-gray-500 not-italic mr-1">Note:</span> 
            {place.user_notes}
          </p>
        </div>
      )}
    </div>
  );
};