# 0.2.5 — Login routing diagnostics and official ProPOS brand

- Replaced the placeholder portal mark with the exact `silopi-dijital-logo.png` and official app icons from Yunus ProPOS 5.4.27. The logo artwork was copied unchanged.
- Removed the undocumented shared proxy-secret dependency that caused the Workers/Vercel proxy to return 503 before Supabase was called. The browser still cannot query ProPOS tables; the proxy forwards only to the two allow-listed Edge Functions.
- Kept customer login behind the six-digit code lookup and database-backed rate limit. Admin operations remain protected by active ProPOS admin PIN validation and short-lived signed admin tokens.
- Removed the proxy-header guard from the ProPOS admin Edge Function so the desktop app can continue calling it directly.
- Added `GET /api/veresiye/health`, which makes a harmless empty-code call to the login Edge Function and confirms whether Supabase is reachable. It does not create a login-attempt row.
- Changed the customer login UI to show actual API/proxy error messages instead of converting every HTTP failure into “code invalid”.
- Added official logo asset regression checks.

## Live DB investigation

At package preparation time, the Yunus ProPOS personal Supabase project had one active portal-access record with encrypted code material. ProPOS admin operations returned HTTP 200 and the active flag was true. No login Edge Function calls or login-attempt rows were present, indicating the browser request was being stopped by the proxy before it reached Supabase. No database rows or migrations were changed during this release.
