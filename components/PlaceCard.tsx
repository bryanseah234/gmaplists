import React from 'react';
import { Place } from '../types';
import { Star, Users, DollarSign, Accessibility } from 'lucide-react';

interface PlaceCardProps {
  place: Place;
}

export const PlaceCard: React.FC<PlaceCardProps> = ({ place }) => {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 border border-gray-100 dark:border-gray-800 flex flex-col justify-between h-full group">
      <div>
        <div className="flex justify-between items-start mb-2">
          <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 tracking-wide uppercase">
            {place.detailed_category || place.primary_category}
          </span>
          {place.accessibility && (
             <div className="text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 p-1.5 rounded-full" title="Wheelchair Accessible">
                <Accessibility size={14} />
             </div>
          )}
        </div>
        
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1 leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{place.place_name}</h3>
        
        <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center mr-4 text-amber-500 font-medium">
            <Star size={16} className="fill-current mr-1" />
            {place.star_rating.toFixed(1)}
          </div>
          <div className="flex items-center mr-4">
            <Users size={16} className="mr-1 text-gray-400 dark:text-gray-500" />
            {place.review_count}
          </div>
          <div className="flex items-center text-gray-600 dark:text-gray-400 font-medium">
             {/* Render dollar signs based on price code if available, else text */}
             {place.price_range_code > 0 ? (
                <div className="flex">
                   {[...Array(4)].map((_, i) => (
                      <DollarSign 
                        key={i} 
                        size={14} 
                        className={i < place.price_range_code ? "text-gray-900 dark:text-gray-200" : "text-gray-300 dark:text-gray-700"} 
                      />
                   ))}
                </div>
             ) : (
                <span className="text-xs">{place.price_range}</span>
             )}
          </div>
        </div>
      </div>

      {place.user_notes && (
        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800">
          <p className="text-sm text-gray-600 dark:text-gray-400 italic">"{place.user_notes}"</p>
        </div>
      )}
    </div>
  );
};