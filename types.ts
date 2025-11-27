/**
 * Represents a single extracted place from the Google Maps list.
 */
export interface Place {
  /** The name of the location (e.g., "Hakata Ikkousha Ramen") */
  place_name: string;
  /** The broad category bucket: "Food", "Drink", "See", "Shop" */
  primary_category: string;
  /** The specific type extracted from text (e.g., "Ramen", "Park") */
  detailed_category: string;
  /** Star rating (0.0 to 5.0) */
  star_rating: number;
  /** Number of reviews */
  review_count: number;
  /** The visual price string (e.g., "$", "$$", "$$$") */
  price_range: string;
  /** Numeric representation of price (1, 2, 3, 4) for sorting */
  price_range_code: number;
  /** Any user-added notes (e.g., "Visited") */
  user_notes?: string;
  /** Direct link to the place on Google Maps */
  google_maps_link?: string;
}

/**
 * Configuration for a sorting button.
 */
export interface SortingOption {
  field: keyof Place;
  label: string;
  icon_svg_placeholder: string;
}

/**
 * Configuration for a filter group (e.g., Categories).
 */
export interface FilterGroup {
  field: keyof Place;
  label: string;
  icon_svg_placeholder: string;
  unique_values: (string | boolean)[];
}

/**
 * The structure returned by the parser service.
 */
export interface ExtractedData {
  list_title: string;
  list_source_url: string;
  ui_config: UIConfig;
  places: Place[];
}

export interface UIConfig {
  sorting_options: SortingOption[];
  filter_groups: FilterGroup[];
}

export type SortOrder = 'asc' | 'desc';

export interface ActiveFilters {
  [key: string]: (string | boolean)[];
}