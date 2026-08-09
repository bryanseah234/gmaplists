# gmaplist Fragility Audit

Date: 2026-08-09

Scope: read-only audit of the current app after the Supabase/PWA/mobile queue rewrite. No product code was changed for this report.

Current status note: several findings below have since been fixed in later commits.
Guarded browser storage, missing-feature-ID refusal, app-side sync mutexing,
stale-PWA mitigation, legacy Kanban/tagging cleanup, improved mobile queue
ergonomics, and stricter manual-classification import tests are now present. The
transactional Supabase sync RPC is implemented and committed as a pending
migration, but it has not been applied to the remote database without explicit
approval.

## Executive Summary

The core data model is mostly aligned with the product: places and classifications are global by `feature_id`, list membership is per list, and progress is per list/user. The highest-risk gap is sync atomicity: `syncListToSupabase` performs many independent writes with no transaction, so a network/auth failure can leave partial remote state while the user only sees a generic error.

The core mobile loop exists, but it is not yet a good one-handed queue. The app shows setup/classification controls above the actual places, does not persist the selected list/filter/search across reloads, and renders up to ten places per category rather than a single tight "next ten" work queue. It will work, but it will feel heavier than it should.

The biggest architectural leftover is classification duplication. The displayed Supabase queue resolves category in one real place, `resolveCategory` in `src/services/gmaplistStore.ts`, but the parser still calls the older `autoTagService` and static `tags.json` path before persistence. That parser category is mostly ignored by the current Supabase path, but it is confusing and keeps a bypass-shaped code path alive.

## Audit 1: Edge Cases And Failure Modes

| Case | Status | What happens | What the user sees |
| --- | --- | --- | --- |
| Syncing while signed out | Ugly | The app now only installs the extension message listener after `session` exists (`src/App.tsx:242`). `ingestData` also refuses to save without a session (`src/App.tsx:210`). This prevents the old "syncing on login" overlay, but a payload delivered before the listener exists can be missed. | Login form remains. After signing in, the payload may not auto-sync unless the extension reconnects, the page reloads, or Maps is clicked through again. Silent-ish because there may be no obvious "payload missed" message. |
| Session expires mid-sync | Broken/ugly | `syncListToSupabase` checks auth once (`src/services/gmaplistStore.ts:136`) then writes `lists`, `places`, `list_items`, deletions, and seed classifications in separate calls (`src/services/gmaplistStore.ts:145`, `:152`, `:164`, `:181`, `:204`). Supabase may refresh if possible, but if auth fails mid-run, prior writes stay committed. | Generic sync error from `src/App.tsx:219`; database may already be partially updated. |
| Syncing the same list twice rapidly | Ugly | Extension has same-list in-flight and recent guards (`extension/background.js:360`). App itself has no sync mutex; two payloads can still call `syncListToSupabase` concurrently. An older payload finishing last can reconcile `deleted_at` against stale reality. | Possibly a successful "Synced X places" toast, but final DB state depends on completion order. |
| Place removed then re-added | Fine | Re-add upserts `list_items` with `deleted_at: null` (`src/services/gmaplistStore.ts:157`). Removal only soft-deletes the list membership (`src/services/gmaplistStore.ts:181`). Existing override/progress rows are not cascaded. | Place disappears when removed, returns when re-added, and should keep prior category/progress state. Covered by `src/services/__tests__/gmaplistStore.test.ts`. |
| Two lists sharing the same place | Fine for this single-user design | `places`, `classifications`, and `overrides` are keyed by `feature_id`; `list_items` and `progress` include `list_id` (`supabase/migrations/20260809000000_multi_list_tag_queue.sql`). A category applies everywhere, progress does not. | Same place appears pre-classified in both lists; marking done in one list does not mark done in another. |
| Empty place name | Fine but lossy | Parser skips entries with no string display name (`src/services/apiParserService.ts:195`). | Place is absent. No warning. |
| Missing `feature_id` | Broken/ugly | Parser can produce a place with no `feature_id` (`src/services/apiParserService.ts:216`), then sync silently filters it out (`src/services/gmaplistStore.ts:140`). `toPlaceRow` would throw, but it never sees filtered rows (`src/services/gmaplistStore.ts:71`). | Sync count may say parsed places, but the DB can contain fewer. Silent data loss for that item. |
| Malformed payload | Fine/ugly | Worker returns a parse error if no places parse (`src/services/parser.worker.ts:14`). Extension background parse failures become "Google Maps extraction failed" (`extension/background.js:349`). | Visible but generic error. |
| Truncated but well-formed payload | Broken | There is no hard validation that parsed place count equals expected diagnostics/list total before reconciliation. A partial 200-place payload for a 314-place list could mark the missing 114 as deleted. | May see "Synced 200 places" or a normal sync result; this is the worst silent-failure risk. |
| Classification JSON valid but wrong shape | Fine | Import accepts an array or `{ classifications: [...] }`; other top-level shapes throw (`src/services/gmaplistStore.ts:422`). Per-entry bad shape is rejected (`src/services/gmaplistStore.ts:357`). | Preview shows an error or rejected rows before saving. |
| Pasting same classification JSON twice | Mostly fine, one edge ugly | After first save, those ids are no longer in the unclassified set, so a new preview rejects them (`src/services/gmaplistStore.ts:327`, `:368`). But duplicate entries inside one valid array are not deduped before upsert (`src/services/gmaplistStore.ts:373`, `:383`) and may fail as a database duplicate-key/upsert edge. | Normal duplicate paste after refresh is rejected. Duplicate rows in one paste may fail on save. |
| Network drop during batched upsert | Broken | Batches are independent chunks of 100 (`src/services/gmaplistStore.ts:46`). There is no transaction across list/place/item/deletion/classification phases. | Generic sync error, with partial remote writes possible. A re-run should usually repair, but the user is not told that. |
| `localStorage` unavailable | Broken | Theme initialization and persistence call `localStorage` without guards (`src/App.tsx:103`, `:115`). Supabase auth persistence also depends on browser storage through the library (`src/services/supabaseClient.ts`). | App can blank/crash or fail to keep auth. User may see nothing useful. |
| IndexedDB unavailable | Uncertain/fine | App code does not use IndexedDB directly. Supabase auth behavior is library/browser-specific; current code gives no app-level fallback. | Likely fine unless the browser also blocks local/session storage. |
| Service worker stale after deploy | Ugly/uncertain | SW is network-first (`public/sw.js:23`) and uses `skipWaiting`/`clients.claim` (`public/sw.js:4`, `:9`), which helps online. But cache name is static (`gmaplist-shell-v1`) and only `/`, manifest, and favicon are cached (`public/sw.js:1`). Offline JS/CSS chunks are not cached; asset requests can fall back to cached `/`, which is HTML. | Online should update. Offline/poor-network PWA restart can show a stale shell or fail to hydrate. |

## Audit 2: Actual Phone User Flow

Current core loop, assuming the queue screen is already open:

1. Tap place name or open icon.
2. Google Maps opens via an HTTPS Maps search link (`src/components/Places/WorkQueueView.tsx:27`, `:260`, `:263`).
3. Tag in Maps manually.
4. Switch back to browser/PWA.
5. Tap `Done` (`src/components/Places/WorkQueueView.tsx:276`).
6. Wait for Supabase progress save and refresh (`src/App.tsx:311`).
7. Find the next place in the current category section.

App-side tap count is roughly 3 taps per place: open, return/app switch, done. The hidden cost is finding the next item again after returning.

Breakdowns:

- Returning from Maps should preserve state if the browser/PWA process stays alive. If the mobile OS kills/reloads it, selected list, category filter, search, and scroll position are lost.
- The selected list does not survive reload. `refreshLists` picks `preferredListId || selectedListId || nextLists[0]` (`src/App.tsx:118`), but the path list id is only used to set `isReceiving` (`src/App.tsx:236`), not to select the list. `handleSelectList` does not update the URL (`src/App.tsx:318`).
- Category filter/search are component state only (`src/components/Places/WorkQueueView.tsx:53`), so they reset on reload/PWA restart.
- Progress is visible at the top (`src/components/Places/WorkQueueView.tsx:150`) and the progress bar helps, but it scrolls away once the user is deep in a category.
- Batching is not really "about ten places" overall. It is first 10 per category (`src/components/Places/WorkQueueView.tsx:244`), so "All" can show up to 60 entries. Filtering to a category makes the intended workflow clearer.
- The unclassified prompt/import panel is always above the work queue (`src/components/Places/WorkQueueView.tsx:188`). During street-side tagging, this is a screen the user probably never wants. It pushes the actual queue down.
- There is no dedicated "current item / next item" surface. The user still has to scan cards.

## Audit 3: UI Quality

Contrast:

- The recent input text fix covers `input`/`textarea` and autofill in `src/index.css`. That specific invisible-input bug is addressed.
- Several useful small texts are low-contrast: header list title `text-zinc-400` (`src/App.tsx:349`), last synced metadata (`src/components/Places/WorkQueueView.tsx:152`), context lines (`src/components/Places/WorkQueueView.tsx:267`). They are readable on desktop, marginal on a phone outdoors.
- Native select contrast is still browser-dependent. `option` colors were added in CSS, but mobile native select sheets may ignore web styling.

Tap targets:

- Many controls are below the usual 44px mobile target: category pills are `h-9` (`src/components/Places/WorkQueueView.tsx:167`), search is `h-10` (`:177`), category select and Done are `h-10` (`:269`, `:276`), header buttons are small (`src/App.tsx:353`, `:362`).
- The place name link has good text size, but the separate open icon button is small (`src/components/Places/WorkQueueView.tsx:263`).

Loading/empty/error states:

- Auth loading now has a "Checking session..." state (`src/App.tsx:385`).
- Sync loading is a blocking overlay (`src/App.tsx:370`). It is clear but not cancellable.
- Empty queue/filter states are missing. Empty groups simply render nothing (`src/components/Places/WorkQueueView.tsx:247`), so the work area can disappear with only the top progress card as context.
- Done/category save failures are not locally handled in `WorkQueueView`. The async handlers are called directly (`src/components/Places/WorkQueueView.tsx:271`, `:277`), with no per-row pending state, disabled state, or row-level error.
- Import preview shows only the first five rejected entries (`src/components/Places/WorkQueueView.tsx:229`), which is fine for scanability but can hide the scale of a bad paste.

Visual finish:

- The work queue reads more like an admin panel than a phone task queue. Cards are compact, but the setup/import tools dominate the top of the real workflow.
- Signed-in/no-list state can render `InputSection` twice: once in the main branch (`src/App.tsx:430`) and again in the fallback (`src/App.tsx:435`).

## Audit 4: Logic Flow And Dead Code

Category resolution:

- The displayed Supabase queue has one real resolution function: `resolveCategory` in `src/services/gmaplistStore.ts:85`.
- Its precedence is correct: override (`:91`), classification (`:104`), rules (`:117`), then rule result can be `Unsorted`.
- `loadPlacesForList` uses that function for every displayed place (`src/services/gmaplistStore.ts:268`).

Bypass-shaped leftovers:

- `apiParserService` still imports and calls `resolveAutoTag` (`src/services/apiParserService.ts:2`, `:217`). That older path checks static tags before rules (`src/services/autoTagService.ts:5`, `src/services/staticTags.ts:12`). In the current Supabase sync path, those parsed categories are not persisted, so this is mostly dead/confusing rather than an active display bypass.
- `syncListToSupabase` separately seeds `tags.json` into `classifications` with duplicate-ignore (`src/services/gmaplistStore.ts:190`, `:204`). That is the intended one-time seed, but it means `tags.json` exists in two paths: parser static tags and DB seed.
- `applyAutoTags` is exported but not used by production code (`src/services/autoTagService.ts:27`).
- `IconMapper` appears unused (`src/components/UI/IconMapper.tsx`).
- `@dnd-kit/core` and `@dnd-kit/utilities` remain in dependencies (`package.json:15`, `:16`) although the Kanban/drag UI is gone.
- Type fields like `star_rating`, `review_count`, `price_level`, `website`, `google_place_id`, `business_status`, `hex_place_id`, `SortingOption`, `FilterGroup`, and `ActiveFilters` are leftovers from earlier richer parsers/UI (`src/types/index.ts`). Some parser tests still exercise them, but the current Supabase schema drops most of them.
- `_extensionLogs` state is intentionally write-only in `App.tsx:101`; logs are collected but never rendered in the app.

Other logic concerns:

- `loadUnclassifiedPlaces` excludes anything with a stored classification, but not anything with an override until preview time (`src/services/gmaplistStore.ts:316`, `:351`). This is safe but inefficient.
- `saveClassifications` uses normal upsert, so pasted classifications can overwrite existing stored classifications (`src/services/gmaplistStore.ts:379`). It will not overwrite overrides because preview rejects override ids, but it can overwrite classifications if the allowed set gets stale between preview and save.
- `saveCategoryOverride` uses `onConflict: "feature_id"` (`src/services/gmaplistStore.ts:304`) while the DB table primary key is `feature_id`. This matches single-user/global override intent. If public signups were ever enabled, another authenticated user could conflict at the primary-key level even though RLS limits row ownership.

## Audit 5: Ranked Fix List

### Breaks Or Can Lose Data

1. Add a sync transaction/RPC or staging sync path so `lists`, `places`, `list_items`, removed markers, and seed classifications commit atomically. At minimum, do not advance `last_synced` until the end and show a "partial sync may have occurred; rerun sync" message on failure.
2. Validate payload completeness before reconciliation. Compare parsed place count with extension diagnostics/list total; refuse to mark removals when the payload is truncated or count is suspicious.
3. Add an app-level sync mutex keyed by `list_id` so stale/new payloads cannot race.
4. Stop silently dropping missing `feature_id` places. Surface a warning with the count and names skipped, and do not report them as synced.
5. Guard `localStorage` access and provide a fallback theme/auth-error path so blocked storage does not blank the app.

### Annoying In Real Use

1. Persist selected list, category filter, and maybe scroll/current batch in URL or local storage. The phone flow depends on surviving Maps app switches.
2. Replace the always-visible import panel with a collapsed/admin action. It is not part of the street-side tagging loop.
3. Make a single-category work mode the primary screen: one list, one category, next 10 places, obvious progress, large open/done controls.
4. Add per-row pending/error state for Done and category override saves.
5. Add empty states for all-done and no-filter-results.
6. Fix the duplicate `InputSection` no-list rendering.

### Polish

1. Increase mobile tap targets to at least 44px for category pills, Done, selects, and header actions.
2. Raise contrast for small metadata text used outdoors.
3. Replace the hand-rolled service worker with a versioned Vite PWA strategy or disable SW until it is worth doing correctly.
4. Remove unused Kanban dependencies and unused components/exports.
5. Simplify old parser/type fields that are not persisted or shown.

## Least-Confident Earlier Work

- The mobile queue UI. It is functionally wired, but it was built too much like a compact dashboard. The real product is a repetitive phone task loop, and the current UI still asks the user to scan and manage controls.
- The service worker. It makes the app installable but is not a robust offline/update strategy.
- Sync consistency. The schema is right, but the client-side multi-call sync is fragile without a database transaction or server-side RPC.
- The classification cleanup. The current display precedence is correct, but old parser/static-tag paths remain and make the system harder to reason about.

## How To Check Uncertain Items Yourself

- Signed-out payload miss: sign out, trigger the extension capture, then sign in without refreshing. If the list does not sync automatically, reload the app or click through Maps again.
- Truncated payload risk: do not test this on production data unless you are ready to resync. A safe test would require a dev Supabase project and a deliberately shortened fixture.
- PWA stale shell: install the PWA, load it once, deploy a visible text change, then reopen from the home screen on a weak/offline network and check whether the old bundle appears.
- Mobile return behavior: open a category filter, tap a place, switch to Maps, background the browser for a while, then return. If the app reloads, confirm whether list/filter/position reset.
