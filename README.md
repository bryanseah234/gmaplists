# GMapLists

A privacy-first, client-side React Single Page Application (SPA) that transforms raw Google Maps list exports and copied text into a structured, drag-and-drop Kanban board.

## Project Overview
GMapLists operates entirely in the browser. It uses deterministic Regex and JSON mapping to ingest unstructured Google Maps data via a bookmarklet or clipboard paste. Places are heuristically categorized (Food, Snack, Drink, See, Shop) and rendered into a highly interactive, differential Kanban interface powered by `@dnd-kit`.

There is **no backend, no database, and no telemetry**. All user data and category overrides are persisted securely in local browser storage (`localStorage`).

## Prerequisites
- Node.js (v20+ recommended)
- npm (v10+)
- Git

## Environment Configuration
Because GMapLists is a pure client-side application with no external backend or authenticated third-party proxies, **there are no `.env` variables required to build or run this project.** 

The application is completely self-contained.

## Installation & Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/gmaplists.git
   cd gmaplists
   ```

2. **Install dependencies:**
   We enforce strict version pinning to guarantee deterministic builds.
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:5173`.

## Usage & Testing

### Running the Test Suite
The critical parsing matrices are protected by a blazing-fast Vitest unit testing suite.
```bash
# Run the tests once
npm run test

# Run the tests in watch mode during development
npm run test:watch
```

### Building for Production
The application is optimized for static hosting (Vercel, Netlify, GitHub Pages).
```bash
npm run build
```
This will output the highly minified, WebWorker-optimized production bundles into the `/dist` directory.

### Core Architecture Notes for Contributors
- **Parser Engine**: Look in `src/services/apiParserService.ts` for the `GCID_MAP` if you need to adjust how Google's internal place types map to the Kanban columns.
- **WebWorker**: All heavy parsing is offloaded to `src/services/parser.worker.ts` to prevent main-thread locking.
- **Storage**: `src/services/storageService.ts` handles the differential sync logic and local persistence.
