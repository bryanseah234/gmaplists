# PRD: GMapList

## Overview
A client-side React + TypeScript web application that parses exported Google Maps list data (ingested via a JavaScript bookmarklet) and renders it as a structured, drag-and-drop Kanban board. It supports dark/light/system themes and per-list local storage persistence. The app allows users to overcome the interface limitations of standard map views by organizing their scattered pins into clean, actionable columns.

## Goals
- Parse Google Maps list data automatically intercepted by a bookmarklet.
- Display places as draggable cards within a Kanban board.
- Automatically categorize places into predefined buckets (Food, Snack, Drink, See, Shop, Unsorted).
- Allow users to override automatic categorization by dragging cards between columns.
- Persist manual overrides and list metadata to `localStorage`.
- Highlight "new places" added since the last time a specific list was imported.
- Dark/light/system theme with localStorage persistence.
- Mobile-friendly splash screen.

## Non-Goals
- Google Maps API integration (No API key required — uses purely client-side parsing).
- Server-side database persistence (All data stays in the browser).
- Advanced Sorting / Filtering via chips (Visual sorting is handled purely by Kanban columns).
- Data Export (CSV/JSON generation is out of scope).
- Real-time two-way data sync with Google Maps.

## Tech Stack
- **Framework**: React 18+
- **Language**: TypeScript
- **Build**: Vite
- **Styling**: Tailwind CSS v4
- **Icons**: Lucide React
- **Drag-and-Drop**: `@dnd-kit/core`

## Architecture & Data Flow
```
gmaplists/
├── src/
│   ├── App.tsx                      # Root state (theme, lists, overrides)
│   ├── main.tsx                     # Entry point
│   ├── config/constants.ts          # Core bookmarklet code
│   ├── types/index.ts               # ExtractedData, Place definitions
│   ├── components/
│   │   ├── UI/                      # Shared inputs, modals, basic cards
│   │   └── Kanban/                  # Board, Columns, and Draggable Cards
│   └── services/
│       ├── apiParserService.ts      # Core logic parsing GMaps JSON payloads
│       ├── parserService.ts         # Fallback regex parsing engine
│       ├── storageService.ts        # localStorage read/write operations
│       └── mapLinkService.ts        # Map link generator
```

**State in App.tsx:**
- `data: ExtractedData | null` — parsed list metadata.
- `places: Place[]` — the enriched places array (combining raw parsed data with manual overrides).
- `newPlacesCount: number` — differential count of places added since last sync.
- `isLoading, isReceiving, error` — ingestion and parsing UI states.
- `theme: 'light' | 'dark' | 'system'` — persisted to localStorage.

## Features (detailed)

### Data Ingestion & Parsing
- Users run the `SCROLL_BOOKMARKLET_CODE` on a Google Maps list page.
- The bookmarklet scrapes the DOM, builds a JSON payload, and sends it to the app via `window.opener.postMessage`.
- `apiParserService` digests the JSON payload and cross-references Google's internal category IDs (`gcid`) to place them in 5 distinct categories.

### Kanban Board
- A 6-column layout (Unsorted, Food, Snack, Drink, See, Shop).
- Users can drag cards between columns using `@dnd-kit`.
- Moving a card triggers a `saveOverride` in `storageService`.

### Local Persistence
- `storageService.ts` maintains a registry of lists keyed by the list ID.
- Saves the timestamp of the last import (`last_synced`).
- Saves an object map of user-defined overrides (`{ "Place Name": "New Category" }`).
- Throws a `StorageQuotaExceededError` if the browser limits are reached, which is gracefully handled by the UI.

## Deployment / Run
```bash
npm install
npm run dev
```
Production build uses `tsc && vite build`.

## Constraints & Notes
- **No API**: All data comes from user ingestion.
- **Parser fragility**: Depends on Google Maps payload structures. If Google changes their web app format, the `apiParserService` will need updates.
- **Data freshness**: Data is only as fresh as the last bookmarklet run. The app identifies newly added places by diffing `added_at` against the stored `last_synced` value.
