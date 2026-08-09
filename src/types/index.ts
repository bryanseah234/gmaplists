export interface Place {
  place_name: string;
  /** Unsorted | Food | Snack | Drink | See | Shop */
  primary_category: string;
  /** Google's own label e.g. "Ramen restaurant", "Cocktail bar" */
  detailed_category: string;
  star_rating: number;
  review_count: number;

  user_notes?: string;
  google_maps_link?: string;
  price_level?: string;
  lat?: number;
  lng?: number;
  address?: string;
  /** Full place/address label from getlist [1][2], when present */
  place_label?: string;
  phone?: string;
  website?: string;
  /** Google Places ID e.g. ChIJ... */
  google_place_id?: string;
  business_status?: string;
  /** Unix seconds when place was added to the list */
  added_at?: number;
  /** Hex place ID e.g. 0x31da...:0xb565... for reliable Maps links */
  hex_place_id?: string;
  /** Stable Google Maps feature tuple joined as "id0:id1"; used for static tags */
  feature_id?: string;
  /** True after this place has been tagged manually in Google Maps for the selected list */
  done?: boolean;
  done_at?: string;
  resolved_reason?: string;
  resolved_confidence?: "high" | "medium" | "low";
  /** True when the displayed category comes from a manual correction */
  is_override: boolean;
}

export interface ListSummary {
  list_id: string;
  name: string;
  last_synced: string | null;
  total_count: number;
  done_count: number;
  remaining_count: number;
  unclassified_count: number;
}

export interface SortingOption {
  field: keyof Place;
  label: string;
  icon_svg_placeholder: string;
}

export interface FilterGroup {
  field: keyof Place;
  label: string;
  icon_svg_placeholder: string;
  unique_values: (string | boolean)[];
}

export interface ExtractedData {
  list_title: string;
  list_source_url: string;
  list_id: string;
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

export const COLUMNS: { id: string; label: string; emoji: string }[] = [
  { id: "Unsorted", label: "Unsorted", emoji: "❓" },
  { id: "Food",          label: "Food",           emoji: "🍽" },
  { id: "Snack",         label: "Snack",          emoji: "🧁" },
  { id: "Drink",         label: "Drink",          emoji: "🍹" },
  { id: "See",           label: "See",            emoji: "👁" },
  { id: "Shop",          label: "Shop",           emoji: "🛍" },
];
