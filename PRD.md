# Product Requirements Document (PRD)

## 1. Executive Summary
This application is a privacy-first, client-side React Single Page Application (SPA) designed to transform raw Google Maps list data into a structured, drag-and-drop Kanban board. By utilizing an automated bookmarklet ingestion pipeline and robust regex-based text parsing, it solves the problem of organizing and categorizing hundreds of saved places without requiring users to manually copy, paste, or authenticate with external APIs.

## 2. System Architecture
The system operates entirely within the browser sandbox, consisting of four primary architectural pillars:

- **State Orchestration (`src/App.tsx`)**: The root React component manages global state, routing (URL list slugs), and cross-window communication. It listens for `postMessage` payloads from the external bookmarklet.
- **Asynchronous Parsing Engine (`src/services/parser.worker.ts`)**: A dedicated WebWorker thread that intercepts raw JSON or pipe-separated strings. It executes heavy regex matching and object mapping off the main thread to guarantee 60FPS UI responsiveness during massive list ingestions.
- **Drag-and-Drop Kanban Interface (`src/components/Kanban/`)**: Powered by `@dnd-kit/core`, this module renders the UI. It dynamically buckets places into hardcoded categories (Food, Snack, Drink, See, Shop, Unsorted) and tracks user-initiated overrides.
- **Client Persistence Layer (`src/services/storageService.ts`)**: A differential storage engine built on `localStorage`. It persists parsed lists, records manual category overrides, and calculates diffs to notify users of "newly added places" since their last sync.

## 3. Feature Matrix
### 3.1 Data Ingestion
- **Bookmarklet Sync**: Seamless payload transfer via `window.opener.postMessage`, avoiding manual data entry.
- **Manual Regex Parsing**: A fallback mechanism that digests unstructured clipboard text and extracts structured entities (Names, Star Ratings, Review Counts, URLs) using the `PLACE_PATTERN` regex matrix.

### 3.2 Kanban Categorization & Overrides
- **Heuristic Auto-Sorting**: Automatically assigns places to UI columns based on Google Canonical IDs (`gcid`) or an exhaustive keyword dictionary matching place names and types.
- **Persistent Drag-and-Drop**: Users can manually drag a card from "Unsorted" to "Food". The `is_override` flag is activated and the decision is permanently saved to `localStorage`, surviving future syncs.

### 3.3 Differential Tracking
- **Change Detection**: The system compares the timestamp of incoming list items against the `last_synced` metric in the persistence layer.
- **Alert Banner**: Dynamically renders a UI banner notifying the user exactly how many new places were detected in the latest import.

## 4. Security & Performance
- **Zero-Backend Architecture**: 100% of the application logic runs client-side. No databases, no auth tokens, and no server-side storage, eliminating the vast majority of PII leakage vectors.
- **Determinism**: All Node dependencies are strictly pinned to exact semantic versions in `package.json` to prevent supply chain breaks.
- **Main-Thread Isolation**: The transition of `apiParserService.ts` to a WebWorker entirely removes synchronous bottlenecks that previously froze the DOM during the processing of lists containing >500 items.
- **CORS Independence**: The system relies on native browser capabilities and local regex to resolve shortened Google Maps links, having fully eliminated legacy reliance on insecure third-party proxy services (`api.allorigins.win`).

## 5. Non-Functional Requirements
- **Storage Limits & Error Handling**: The persistence layer actively monitors `localStorage` quotas. If the 5MB browser limit is breached, the system throws a strict `StorageQuotaExceededError` that is caught and gracefully surfaced as an actionable UI banner, rather than silently dropping data.
- **Test Coverage**: The critical parsing matrices and regex extractors are heavily documented and verified by a native `Vitest` unit testing suite, ensuring mapping logic remains stable across refactors.
