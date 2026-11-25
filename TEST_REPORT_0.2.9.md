# Test report — SilopiDijital Veresiye 0.2.9

## Root cause found

Supabase function-edge logs showed the Vite health request reaching `veresiye-portal-login` with `response.status_code=401`, `UNAUTHORIZED_INVALID_API_KEY`, and `request.sb.apikey.apikey.error=bad_checksum`. The current active publishable key returned by the Supabase project is case-sensitive. The previous Vite constant used uppercase `C`; the correct key contains lowercase `c`:

`sb_publishable_b-cFhb97kOd3mLQnBi_SGQ_8oNQPkzS`

The Vite and Vercel server-side proxies now use this exact current key. A stale `.env` or Vercel environment variable can no longer override it.

## Checks run

- 10 local regression/security tests: PASS
- `tsc --noEmit -p tsconfig.api.json`: PASS
- TypeScript transpile/syntax checks for changed config and tests: PASS
- ZIP archive integrity: PASS (after packaging)

## Not completed in this environment

- Full app TypeScript check, ESLint, and Vite production build were not completed because the React/Vite/ESLint dependencies are not installed in the working environment and the npm registry could not be reached from this container.
- A real external HTTP POST to the Supabase URL could not be run from this container because DNS/network access to the Supabase host is unavailable here. The root cause is directly evidenced by Supabase function logs and the key returned by the Supabase project API.

No SQL migration was applied, no customer codes were regenerated, and no business/customer/sale/payment rows were changed.
