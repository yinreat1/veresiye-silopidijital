# Test report — SilopiDijital Veresiye 0.2.8

## Passed in the source workspace

- Customer-login guidance regression (the long help panel is removed).
- Remembered-session regression (a signed 30-day session token is stored; the six-digit code is never persisted; logout clears the token; every restore re-checks current access and code version).
- Vite development API middleware regression for `/api/veresiye/*`; `localhost:5173/api/veresiye/health` now reaches the Supabase login function server-side instead of Vite returning 404.
- Vite development API HTTP smoke test (health + login path; Supabase upstream mocked).
- Vercel proxy contract test.
- Local Vercel proxy HTTP smoke test (Supabase upstream mocked).
- Edge routing regression test.
- Session-token crypto test compares the ProPOS admin and Veresiye login HMAC for the same six-digit code; checks signature tampering and expiry.
- Brand regression retains the exact official logo and app icon byte hashes.

## Live Supabase change

`veresiye-portal-login` was deployed as version 5 to Yunus ProPOS project `ukfeuojhigxxxlnhsmls`. The change adds signed 30-day customer sessions and checks active access plus code-version freshness on every restore. No database migration or customer/business rows were changed.

## Not completed in this environment

- Full React app typecheck, ESLint, and Vite production build could not be completed here because the npm package registry was unavailable during dependency installation. GitHub Actions and Vercel `npm run check` will run these with the lockfile.
- End-to-end browser login against a customer's real six-digit code was not performed.
