# GMapLists Agent Journal

- 2026-08-15: Sync is intentionally RPC-only; the app must fail loudly if `sync_gmaplist` is unavailable instead of using partial chunked writes. Duplicate feature IDs are surfaced with payload positions after sync.
- 2026-08-15: `.agents/` is shared durable state per AGENTS.md, so `.gitignore` allows `.agents/` while continuing to ignore other dot-directories.
