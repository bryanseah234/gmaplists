export interface Place {
  place_name: string;
  primary_category: string;
  detailed_category: string;
  star_rating: number;
  review_count: number;
  price_range: string;
  price_range_code: number;
  accessibility: boolean;
  user_notes?: string;
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

export interface UIConfig {
  sorting_options: SortingOption[];
  filter_groups: FilterGroup[];
}

export interface ExtractedData {
  list_title: string;
  list_source_url: string;
  ui_config: UIConfig;
  places: Place[];
}

export type SortOrder = 'asc' | 'desc';

export interface ActiveFilters {
  [key: string]: (string | boolean)[];
}