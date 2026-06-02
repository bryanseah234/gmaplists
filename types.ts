export interface Place {
  place_name: string;
  /** Food | Snack | Drink | See | Shop | Uncategorised */
  primary_category: string;
  /** Google's own label e.g. "Ramen restaurant", "Cocktail bar" */
  detailed_category: string;
  star_rating: number;
  review_count: number;
  price_range: string;
  price_range_code: number;
  user_notes?: string;
  google_maps_link?: string;
  /** Unix seconds when place was added to the list */
  added_at?: number;
  /** True when user has manually dragged this card to a different column */
  is_override: boolean;
  /** The list ID this place belongs to (for localStorage keying) */
  list_id?: string;
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

