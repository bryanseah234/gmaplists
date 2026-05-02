# PRD: gmaplists

## Overview
A React + TypeScript web app that parses exported Google Maps list data (copy-pasted from a Maps list page) and renders it as a sortable, filterable place card grid. Supports CSV/JSON export, dark/light/system themes, and a mobile splash screen. Useful for anyone who wants to work with their saved Google Maps places in a cleaner interface.

## Goals
- Parse pasted Google Maps list text/HTML into structured `Place` objects
- Display places as cards with name, rating, category, address
- Sort by any field (rating, name, etc.) ascending/descending
- Filter by place type/category
- Export data as CSV or JSON
- Dark/light/system theme with localStorage persistence
- Mobile-friendly with splash screen on small screens

## Non-Goals
- Google Maps API integration (no API key required — uses pasted text)
- Navigation or directions
- Real-time data sync with Google Maps
- Saving lists to server

## User Stories
- As a traveler, I want to paste my "Tokyo Trip" Google Maps list and see all places in a sortable grid.
- As a foodie, I want to filter my saved restaurants by cuisine type.
- As an analyst, I want to export my saved places to CSV for further analysis.

## Tech Stack
- **Language**: TypeScript / React
- **Build**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Libraries**: (likely) custom parser in `services/parserService`

## Architecture
```
gmaplists/
├── App.tsx                      # Root — state, parsing, sorting, filtering
├── index.tsx                    # Entry point
├── constants.ts                 # Field names, sort options, etc.
├── types.ts                     # ExtractedData, Place, SortOrder, ActiveFilters
├── components/
│   ├── InputSection.tsx          # Textarea/paste input + parse trigger
│   ├── PlaceCard.tsx             # Individual place display card
│   ├── IconMapper.tsx            # Maps place category to Lucide icon
│   └── MobileSplash.tsx          # Mobile landing screen
└── services/
    └── parserService.ts          # parseMapData() — text → ExtractedData
```

**State in App.tsx:**
- `data: ExtractedData | null` — parsed places
- `isLoading, error` — parse state
- `sortField, sortOrder` — current sort
- `activeFilters: ActiveFilters` — active category filters
- `theme: 'light' | 'dark' | 'system'` — persisted to localStorage

## Features (detailed)

### Parsing (`parseMapData`)
- Accepts raw text pasted from a Google Maps list page
- Extracts: name, rating, category/type, address, link
- Returns `ExtractedData` with array of `Place` objects

### Place Card Display
- Name, star rating, category badge, address
- Link to open in Google Maps
- Category icon via `IconMapper`

### Sorting
- Sort by any `Place` field
- Toggle ascending/descending with `ArrowUp`/`ArrowDown` icons
- Reset sort with `RotateCcw`

### Filtering
- Filter by place category/type via active filter chips
- Multiple filters can be active simultaneously (`ActiveFilters` dict)

### Export
- CSV export with `FileSpreadsheet` icon
- JSON copy to clipboard with `Check` feedback

### Theme
- Light / Dark / System options
- System: reads `window.matchMedia('(prefers-color-scheme: dark)')`
- Persisted: `localStorage.setItem('maplist-theme', theme)`
- Applied via `.dark` class on `documentElement`

## Deployment / Run
```bash
npm install
npm run dev
```

## Constraints & Notes
- **No API**: all data comes from user paste — no authentication or API keys needed
- **Parser fragility**: depends on Google Maps HTML/text format; Google may change their export format, breaking the parser
- **Mobile splash**: `MobileSplash` component shown on narrow viewports — full functionality on desktop
- **Data freshness**: pasted data is a snapshot; doesn't auto-update when Google Maps list changes
