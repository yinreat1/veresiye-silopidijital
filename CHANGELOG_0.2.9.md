# SilopiDijital Veresiye 0.2.9

- Fixed the Vite development proxy's Supabase publishable API key casing. Supabase's active project key is case-sensitive; the previous uppercase `C` returned `401 UNAUTHORIZED_INVALID_API_KEY` (`bad_checksum`).
- Updated the Vite health probe and customer/admin Edge Function requests to use the exact current key returned by the Yunus ProPOS Supabase project.
- Pinned the Vercel server-side proxy to the same current publishable key and removed stale environment-variable overrides.
- Added a regression check for the exact publishable key value so a casing mismatch cannot silently return.
- No database migration or customer data changes.
