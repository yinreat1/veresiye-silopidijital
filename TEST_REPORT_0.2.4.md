# Test report — SilopiDijital Veresiye 0.2.4

## Passed in this authoring environment

- `npm run typecheck:api` — PASS (Vercel API function TypeScript check).
- `npm run typecheck:worker` — PASS (Cloudflare Worker TypeScript check).
- `npm run test:security` — PASS (portal isolation, no browser Supabase key, allow-listed server proxy, ProPOS customer source, hidden payment data, original brandmark).
- `npm run test:edge-auth` — PASS (both Supabase Edge Functions require the matching server-to-server shared secret).
- `npm run test:vercel` — PASS (Vercel API route contract; Supabase upstream mocked).
- `npm run test:http` — PASS (local HTTP simulation for Vercel API route; Supabase upstream mocked).
- `npm run test:worker` — PASS (Cloudflare Worker handler: SPA asset fallback, valid POST proxy, upstream passthrough, secret/IP headers, method/body/type/route limits; Supabase upstream mocked).
- `npm run test:brand` — PASS (initial SD wordmark restored, substituted S+ mark removed, PWA meta tags present).
- TypeScript transpile syntax checks — PASS for `src/App.tsx`, `src/lib/supabase.ts`, `src/lib/veresiye.ts`, `src/main.tsx`, `worker/index.ts`, and `api/veresiye/[function].ts`.
- JSON and deployment config parse — PASS for package files, Vercel config, web manifest, and Wrangler configuration.
- ZIP archive integrity — PASS.

## Not completed here

- `npm ci` / complete dependency installation — NOT COMPLETED. The offline cache does not contain all locked npm packages (`yocto-queue` was missing); this environment cannot complete the package installation from the registry.
- Full React application typecheck, ESLint, and Vite production build — NOT RUN because the complete project dependencies could not be installed. They remain mandatory in the GitHub Actions workflow and in the Vercel build command.
- Live request to the existing `workers.dev` production endpoint — NOT SENT. No real customer login code was submitted to avoid creating a production failed-login attempt. Deploy this version to the Worker to replace the currently running 405 handler.
- Live Vercel preview/browser test — NOT RUN because a Vercel deployment has not been created in this turn.

All upstream responses in local API tests are mocked. A passing local test does not mean the production deployment has been updated; run the documented deploy steps and then test using a non-production test customer.
