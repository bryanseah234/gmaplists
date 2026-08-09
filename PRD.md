# Product Requirements Document (PRD)

## 1. Executive Summary

gmaplists is a single-user decision aid for tagging collaborative Google Maps saved lists. Google Maps remains the source of truth for the real saved-list tags. This app exists because the Google Maps web `getlist` payload contains place membership but no per-list category/tag data, and there is no known write RPC for applying tags back to Google Maps.

The product goal is to remove judgment from the mobile tagging session. gmaplists suggests the category for each place, opens the place in Google Maps, and tracks the user's manual progress after the user tags the place in Maps.

## 2. Non-Goals

- Do not read, infer, reconcile, or sync Google Maps tag state.
- Do not write tags to Google Maps.
- Do not build Google OAuth, Google Places API integration, Takeout import, CSV import, multi-user workflows, invitations, or shared accounts.
- Do not make runtime classification API calls or ship model credentials.

## 3. System Architecture

- **Desktop Chrome extension (`extension/`)**: Captures one Google Maps saved list by observing `/maps/preview/entitylist/getlist` after an app or popup-initiated capture intent, strips contributor profile data at row index `[12]`, and forwards the stripped payload to the web app.
- **Parser worker (`src/services/parser.worker.ts`)**: Parses the stripped getlist payload off the main thread. Parsed places start as `Unsorted`; category resolution happens later in one store path.
- **Supabase data store (`src/services/gmaplistStore.ts`, `supabase/migrations/`)**: Persists lists, place cache rows, list membership, stored classifications, manual overrides, and per-list progress.
- **Mobile queue (`src/components/Places/WorkQueueView.tsx`)**: Primary user surface. It shows unfinished places grouped by category in small batches, opens each place in Google Maps, and lets the user mark it done after tagging in Maps.
- **PWA shell (`public/manifest.json`, `public/sw.js`)**: Allows home-screen use on the phone while preferring fresh deployed bundles.

## 4. Data Model

- `lists`: Google saved lists keyed by Google Maps list ID.
- `places`: disposable global cache keyed by `feature_id`; a place can appear in many lists.
- `list_items`: list membership keyed by `(list_id, feature_id)` with nullable `deleted_at`. Sync reconciles only the selected list.
- `classifications`: stored category decisions keyed by `feature_id`, shared across all lists.
- `overrides`: manual category corrections keyed by `feature_id` and scoped to the authenticated user.
- `progress`: per-list done flags keyed by `(list_id, feature_id, user_id)`.

Removing a place from a Google list sets `list_items.deleted_at`. Places, classifications, overrides, and progress are not cascade-deleted when list membership changes.

## 5. Category Resolution

Exactly one runtime path assigns the category shown in the queue:

1. Manual override.
2. Stored classification.
3. Deterministic local rules.
4. `Unsorted`.

`src/data/tags.json` is only a one-time seed into `classifications` during sync. It is not a live category layer after a row exists in Supabase.

## 6. Manual Classification Workflow

For places still unresolved by overrides, stored classifications, and rules, the app generates a ready-to-paste prompt containing the authoritative category definitions plus each place's feature ID, name, label, address, and note. The user pastes that prompt into an external LLM manually, then pastes the returned JSON back into gmaplists.

Import validation rejects:

- invalid JSON or the wrong top-level shape;
- feature IDs not in the current unclassified set;
- unknown categories;
- unknown confidence values;
- missing reasons;
- rows with manual overrides.

## 7. Privacy Requirements

The raw getlist payload can include contributor display names, avatar URLs, and Google account IDs at place row index `[12]`. That data must never reach Supabase, logs, or committed fixtures.

Privacy enforcement exists at three boundaries:

- the extension strips `[12]` before storage/broadcast;
- the parser strips and asserts the boundary again before emitting app records;
- the Supabase sync layer asserts outgoing place rows contain no contributor-like fields.

`fixtures/` remains gitignored because raw captures can contain contributor data.

## 8. Auth And Security

Auth is Supabase email magic link, scoped to a single existing user. Public signups must stay disabled in Supabase.

The frontend ships only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is acceptable only with the current RLS posture:

- unauthenticated users have no table policies;
- authenticated users can read and write shared list/place/list-item/classification cache rows;
- overrides and progress are restricted to rows where `user_id = auth.uid()`.

Because shared cache rows are open to any authenticated user, enabling public signups would expose the data model to any new account.

## 9. Sync Requirements

Sync is per list. Opening or syncing one country list must never mark places absent from another list as deleted.

The app must:

- refuse signed-out syncs;
- dedupe incoming places by `feature_id` before writes;
- refuse payloads with missing `feature_id`;
- warn before writing when incoming counts differ sharply from the previous successful sync;
- show received, unique, duplicate, and removed counts after sync;
- surface Supabase errors in the UI with message, details, hint, and code when available;
- preserve overrides and done flags across full resyncs, removals, and re-additions.

Production sync uses the transactional `sync_gmaplist` RPC only. If the RPC is unavailable, sync fails loudly instead of using a chunked fallback, because chunked writes cannot guarantee list reconciliation and progress/override survival across interrupted uploads.

## 10. Verification Requirements

Before release, `npm test` and `npm run build` must pass. Important regression coverage includes:

- parser privacy stripping;
- category rule precedence;
- override and done survival through remove/re-add resync;
- duplicate feature ID handling;
- count-change warning;
- manual classification import validation;
- extension/app version marker alignment.
