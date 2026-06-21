══ 0. FILESYSTEM HEALTH REPORT ══
- Corrupted files: None detected.
- Orphaned files: `services/geminiService.ts` | Explicitly marked as DEPRECATED; function throws Error unconditionally. | EXPENDABLE | Delete file.
- Sync artifacts: None detected.

══ 1. MASTER FEATURE MAP (SOURCE OF TRUTH) ══
This section is the canonical record of what the codebase ACTUALLY does.

**Module: Core App (`App.tsx`, `index.tsx`)**
- **Purpose**: Main entry point and state management.
- **Key logic**: Manages theme (light/dark/system) and persists to `localStorage`. Detects URL slugs to load lists. Handles `window.addEventListener('message')` to receive parsed map data from a bookmarklet (`window.opener`). Implements drag-and-drop category change state via `onCategoryChange`.
- **Inputs/Outputs**: Receives pasted text or window postMessage. Renders `InputSection` or `KanbanView`.

**Module: Parsers (`services/apiParserService.ts`, `services/parserService.ts`)**
- **Purpose**: Converts Google Maps list text/JSON into structured `Place` objects.
- **Key logic (`apiParserService.ts`)**: Parses JSON payloads. Maps Google `gcid` and `type_label` to five main categories (Food, Snack, Drink, See, Shop) using an exhaustive `GCID_MAP` and string matching rules. Deduplicates places by `place_name`.
- **Key logic (`parserService.ts`)**: Fallback regex-based parser for raw text. Uses keyword arrays (`CATEGORIES`) to guess categories based on text snippets. Deduplicates using a signature of `place_name|star_rating|review_count`.

**Module: Storage (`services/storageService.ts`)**
- **Purpose**: Local persistence for parsed lists and user category overrides.
- **Key logic**: Reads/writes to `localStorage` using key `gmaplist_v1`. Saves `ListMeta` including title, `last_synced` timestamp, and per-place category overrides. Calculates `countNewPlaces` by comparing `added_at` against `last_synced`.

**Module: Map Links (`services/mapLinkService.ts`)**
- **Purpose**: Extracts clean Google Maps List IDs to generate easily scrapeable URLs.
- **Key logic**: Uses regex `ID_PATTERNS` to find IDs. If URL is shortened (e.g., `goo.gl`), uses a public CORS proxy (`api.allorigins.win`) to fetch the destination HTML and extract the ID.

**Module: UI Components (`components/`)**
- **Purpose**: Renders the user interface.
- **Key logic**:
  - `InputSection.tsx`: Shows instructions and a copyable bookmarklet string (sourced from `constants.ts`).
  - `KanbanView.tsx` / `KanbanColumn.tsx` / `KanbanCard.tsx`: Implements a drag-and-drop board using `@dnd-kit`. Groups places into 6 columns (Unsorted, Food, Snack, Drink, See, Shop).
  - `PlaceCard.tsx`: A standard list card display.

══ 2. RECONCILIATION SUMMARY ══
- **Truth Gap**: 40% of documented features in the PRD (Sorting, Active Filters, Grid View, CSV/JSON Export) are ABSENT or MATERIALLY DIFFERENT in code. The app documented in `PRD.md` is a grid-based, sortable list, but the actual app is a Kanban board with drag-and-drop category overrides and automated bookmarklet ingestion.
- **State of System**: The codebase is functional as a client-side Kanban organizer but has drifted significantly from its original stated product requirements. It relies heavily on undocumented window messaging and a third-party CORS proxy for some link resolutions.
- **Production Readiness Score**: 3/15 checklist items passing.

══ 3. CRITICAL GAPS (UNIMPLEMENTED FEATURES) ══
- **Sorting**: `PRD.md` line 68 | Severity: P2 | Feature is detailed in PRD (ArrowUp/ArrowDown, RotateCcw) but `App.tsx` has no sorting state and `KanbanView.tsx` hardcodes alphabetical sorting.
- **Filtering**: `PRD.md` line 73 | Severity: P2 | PRD specifies active filter chips. Code uses static Kanban columns instead.
- **Exporting**: `PRD.md` line 77 | Severity: P2 | CSV export and JSON clipboard copy are completely absent in the UI components and App state.

══ 4. UNDOCUMENTED LOGIC (GHOST FEATURES) ══
- **Kanban Board & Overrides**: `components/KanbanView.tsx` & `storageService.ts` | The entire primary UI paradigm (Kanban) and the ability to drag-and-drop to override categories (`saveOverride`) is absent from `PRD.md`.
- **Bookmarklet postMessage Ingestion**: `App.tsx` & `constants.ts` | The core data ingestion flow relies on `window.opener.postMessage` from a massive minified bookmarklet, which is barely mentioned in the PRD (PRD assumes copy-paste text).
- **Public CORS Proxy**: `services/mapLinkService.ts` | Uses `api.allorigins.win` to expand short links. Completely undocumented external dependency.

══ 5. DOCUMENTATION DRIFT ══
- **Documented behavior**: Places are displayed as a "sortable, filterable place card grid".
- **Actual behavior**: Places are displayed in a `@dnd-kit` Kanban board (`KanbanView.tsx`).
- **File path**: `PRD.md` vs `components/KanbanView.tsx`
- **Correction needed**: Rewrite PRD to describe the Kanban UI paradigm.

- **Documented behavior**: "Pasted data is a snapshot; doesn't auto-update"
- **Actual behavior**: `storageService.ts` implements `countNewPlaces` comparing `added_at` against `last_synced`, displaying a banner for "new places added since your last import".
- **File path**: `PRD.md` vs `storageService.ts`
- **Correction needed**: Document the differential sync/import feature.

══ 6. DATA INTEGRITY REPORT ══
- **Table/Collection**: `localStorage` -> `gmaplist_v1`
- **Schema match**: PASS (Implicit schema matches `ListMeta` interface).
- **Record count and anomalies**: N/A (Client-side only, no server DB).
- **Incomplete writes detected**: Yes. `storageService.ts` line 49 uses a bare `catch` block on `localStorage.setItem`. If the quota is exceeded, it fails silently, leading to lost overrides or incomplete imports without user feedback.
- **Recommended action**: Implement error surfacing or fallback when `localStorage` quota is hit.

══ 7. CODE QUALITY FINDINGS ══
- [SECURITY] | `services/mapLinkService.ts` | `getCleanListUrl` | P1 | Relies on `api.allorigins.win` CORS proxy. Sending user maps URLs to a free third-party proxy is a privacy risk and reliability hazard. Needs removal or a dedicated self-hosted proxy.
- [LOGIC] | `services/storageService.ts` | `save` | P1 | Bare `catch` block silently ignores `localStorage` quota errors. This creates silent failures for data persistence.
- [PERFORMANCE] | `services/apiParserService.ts` | `parseApiJson` | P2 | Synchronous parsing of potentially thousands of places with complex Regex and object mapping blocks the main thread. Should be moved to a WebWorker.
- [DEAD] | `services/geminiService.ts` | `extractMapData` | P3 | Entire file is deprecated and throws an error unconditionally.
- [LOGIC] | `services/apiParserService.ts` | `parseApiJson` | P3 | Contains leftover `console.log` statements dumping debug data to the client console.

══ 8. STRUCTURAL REORGANIZATION PLAN ══
8a. Current File Tree (full)
gmaplists/
├── App.tsx
├── index.tsx
├── constants.ts
├── types.ts
├── components/
│   ├── IconMapper.tsx
│   ├── InputSection.tsx
│   ├── KanbanCard.tsx
│   ├── KanbanColumn.tsx
│   ├── KanbanView.tsx
│   ├── MobileSplash.tsx
│   ├── MoveSheet.tsx
│   ├── PlaceCard.tsx
├── services/
│   ├── apiParserService.ts
│   ├── geminiService.ts
│   ├── mapLinkService.ts
│   ├── parserService.ts
│   ├── storageService.ts

8b. Target File Tree
gmaplists/
├── src/
│   ├── App.tsx
│   ├── main.tsx (renamed from index.tsx)
│   ├── config/
│   │   ├── constants.ts
│   ├── types/
│   │   ├── index.ts (renamed from types.ts)
│   ├── components/
│   │   ├── Kanban/
│   │   │   ├── KanbanCard.tsx
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── KanbanView.tsx
│   │   ├── UI/
│   │   │   ├── IconMapper.tsx
│   │   │   ├── InputSection.tsx
│   │   │   ├── MobileSplash.tsx
│   │   │   ├── MoveSheet.tsx
│   │   │   ├── PlaceCard.tsx
│   ├── services/
│   │   ├── apiParserService.ts
│   │   ├── parserService.ts
│   │   ├── storageService.ts
│   │   ├── mapLinkService.ts

8c. Move Plan
Step | Action | Source Path | Destination Path | Protected? | Backup Required?
1 | Create | - | src/ | No | No
2 | Create | - | src/config/ | No | No
3 | Create | - | src/types/ | No | No
4 | Create | - | src/components/Kanban/ | No | No
5 | Create | - | src/components/UI/ | No | No
6 | Move | App.tsx | src/App.tsx | No | No
7 | Move | index.tsx | src/main.tsx | No | No
8 | Move | constants.ts | src/config/constants.ts | No | No
9 | Move | types.ts | src/types/index.ts | No | No
10 | Move | components/Kanban*.tsx | src/components/Kanban/ | No | No
11 | Move | components/*.tsx | src/components/UI/ | No | No
12 | Move | services/*.ts | src/services/ | No | No
13 | Delete | services/geminiService.ts | - | No | No

8d. New Directories to Create
- `src/` | Standard React application root.
- `src/config/` | Centralized constants.
- `src/types/` | Centralized TypeScript definitions.
- `src/components/Kanban/` | Group related Kanban UI features.
- `src/components/UI/` | Shared/generic UI components.

8e. .gitignore Additions
- `*.tmp`, `*.bak` | Ensure temporary IDE files are excluded.

══ 9. PRODUCTION READINESS CHECKLIST ══
[PASS] All secrets externalized — no hardcoding.
[FAIL] All dependencies pinned to explicit versions. (package.json uses `^` carets).
[N/A] All database migrations versioned and reversible.
[FAIL] All external API calls have timeout and retry configurations. (Proxy call has none).
[FAIL] Logging is structured. (Ad-hoc `console.log` used in production paths).
[FAIL] No debug routes, test endpoints, or dev-only flags active. (Console logs act as dev flags).
[N/A] Graceful shutdown handling present.
[PASS] Error responses do not leak stack traces.
[PASS] Input validation present at all external-facing interfaces.
[N/A] Health check endpoint or equivalent monitoring hook present.
[FAIL] All file writes are atomic or guarded against partial-write corruption. (`localStorage` is not guarded against quota limits).
[N/A] Rate limiting or abuse prevention present on public-facing endpoints.
[N/A] All authentication tokens/sessions have expiry logic.
[FAIL] Test coverage exists for all critical paths. (0 tests in codebase).
[PASS] Build/start process is documented and reproducible.

══ 10. PRIORITIZED REMEDIATION ROADMAP ══
1. Remove/Replace CORS Proxy | Privacy/reliability risk in mapLinkService.ts | `services/mapLinkService.ts` | M
2. Surface Storage Errors | Silent data loss on quota hit | `services/storageService.ts`, `App.tsx` | S
3. Restructure File Tree | Flat structure needs standard `src/` modularization | Multiple | S
4. Document Kanban Architecture | PRD is drastically out of date with actual behavior | `PRD.md` | M
5. Remove Dead Code | Delete obsolete geminiService and debug logs | `services/geminiService.ts`, `services/apiParserService.ts` | S
6. Pin Dependencies | Ensure deterministic builds | `package.json` | S
7. Implement WebWorker for Parsers | Main thread is blocked during heavy parsing | `services/apiParserService.ts`, `App.tsx` | L
8. Add Test Coverage | Parsers have complex rules and regex that need unit testing | `services/apiParserService.ts`, `services/parserService.ts` | L