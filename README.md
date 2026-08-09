# gmaplist

gmaplist is a decision aid for tagging collaborative Google Maps saved lists.

Google Maps stays the home of the real tags. I tag places in the Maps mobile app. This app exists because the web `getlist` payload contains the places in a saved list but does not contain Google's per-list tag data, and there is no known web RPC for writing those tags. gmaplist removes the judgment work: it suggests the category, opens the place in Maps, and lets me mark my own progress after I tag it manually.

## What It Does

- Syncs one Google Maps saved list at a time through the desktop Chrome extension.
- Stores stripped place records in Supabase, keyed by Google Maps feature ID.
- Supports multiple country lists through a `lists` table and `list_items` join table.
- Resolves categories through one precedence path: manual override, stored classification, deterministic rules, then `Unsorted`.
- Shows a mobile-first work queue grouped by category in batches of about ten.
- Opens each place directly in Google Maps so tagging on the phone is mechanical.
- Tracks per-list done state, because Google Maps tags are per list.
- Generates a copy-paste classification prompt for places that still have no stored category.
- Imports pasted JSON classifications after strict validation.

## What It Cannot Do

- It cannot read Google Maps tags.
- It cannot detect which places are already tagged in Google Maps.
- It cannot tag places on my behalf.
- It cannot reconcile app progress with Maps tag state.
- It cannot sync tags from Google, because the captured web payload has no tag field.

The done checkbox is therefore manual by design: after tagging a place in Maps, mark it done in gmaplist.

## Data Model

Supabase schema lives in `supabase/migrations/20260809000000_multi_list_tag_queue.sql`.

- `lists`: `list_id text primary key`, name, last synced timestamp.
- `places`: disposable cache keyed by `feature_id`; no `list_id` lives here.
- `list_items`: `(list_id, feature_id)` membership with nullable `deleted_at`.
- `classifications`: stored category decisions keyed only by `feature_id`.
- `overrides`: manual category corrections keyed only by `feature_id`, protected by `user_id`.
- `progress`: per-list tagging progress keyed by `(list_id, feature_id, user_id)`.

Removing a place from one Google list only sets `deleted_at` on that list's `list_items` row. Overrides and progress are never cascade-deleted.

## Privacy Boundary

The captured getlist payload can include contributor profile data at each place row's index `[12]`: display names, avatar URLs, and Google account IDs. That data must not reach the database, logs, or commits.

The extension strips `[12]` before storing or broadcasting a payload. The parser strips and asserts the same boundary again before producing app records. The Supabase sync layer also asserts that outgoing place rows contain no contributor-like fields.

`fixtures/` is gitignored and must stay that way.

## Classification Pipeline

The deployed app makes no model or classification API calls and holds no model key.

The category source order is:

1. Manual override in Supabase.
2. Stored classification in Supabase.
3. Deterministic local rules.
4. `Unsorted`.

`src/data/tags.json` is a bundled seed for the Malaysia list captured during development. On sync, matching entries are inserted into `classifications` only when that `feature_id` has no existing classification. The upsert uses duplicate-ignore semantics, so `tags.json` is not a live category layer after the first seed. Editing `tags.json` later will not overwrite classifications already stored in Supabase; delete or update the Supabase row explicitly if a stored classification needs to change.

For unclassified places, use the queue's prompt button. It copies the category definitions plus place name, place label, address, note, and feature ID. Paste that prompt into an LLM yourself, then paste the returned JSON back into gmaplist. The app validates:

- JSON arrays and markdown code fences.
- `feature_id` must be in the current unclassified set.
- category must be one of `Food`, `Snack`, `Drink`, `See`, `Shop`, `Unsorted`.
- confidence must be `high`, `medium`, or `low`.
- manual overrides are never overwritten.

## Sync Workflow

1. Sign in with Supabase email magic link.
2. Keep the deployed gmaplist tab open.
3. Open the Chrome extension popup.
4. Paste one Google Maps saved-list URL.
5. The extension opens Maps and captures `/maps/preview/entitylist/getlist`.
6. The app strips contributor data, parses places, upserts `lists`, `places`, and `list_items`, and reconciles only that one list.

If you sync while signed out, the app shows an error and does not write the captured payload to Supabase.

## Mobile Queue Workflow

1. Pick a country list from the list switcher.
2. Filter to one category, usually `Drink`, `Food`, `Snack`, `See`, or `Shop`.
3. Work the first batch of about ten remaining places.
4. Tap the place name to open it in Google Maps.
5. Tag it in Maps.
6. Return to gmaplist and tap Done.

Progress is per list. If the same place appears in another country list, its category is reused, but its done state is separate.

## Auth And RLS

Auth is Supabase email magic link, no Google OAuth. The client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The anon key is safe to ship only with the included RLS policies:

- unauthenticated `anon` receives no table policies;
- authenticated users can read and write shared list/place/classification cache rows;
- overrides and progress are readable/writable only where `user_id = auth.uid()`;
- update policies include both `USING` and `WITH CHECK`.

For single-user operation, create only your own Supabase Auth user and keep public signups disabled in Supabase. The app calls magic-link sign-in with `shouldCreateUser: false`, but that is only a client guard. Data protection for `lists`, `places`, `list_items`, and `classifications` depends on preventing other users from authenticating, because those shared-fact tables are intentionally open to any authenticated user.

## Environment

Create a local `.env` file; do not commit it.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Configure Supabase Auth redirect URLs for local and production origins.

## Development

```bash
npm install
npm test
npm run build
```

## Deployment

This is a Vite SPA and is configured for Vercel in `vercel.json`. Set the two Supabase environment variables in Vercel, then deploy. The extension manifest already allows:

- `https://gmaplist.hong-yi.me/*`
- `https://*.vercel.app/*`
- local development origins

That means the extension bridge works against the deployed origin, not just localhost.
