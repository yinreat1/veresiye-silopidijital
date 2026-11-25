# 0.2.4 — Workers 405 and original logo restoration

- Added a Cloudflare Workers adapter for `/api/veresiye/:function` to support the existing `workers.dev` runtime as well as the Vercel Node.js Function.
- Added `wrangler.jsonc` with `/api/*` worker-first routing and SPA static asset handling.
- Restored the original SD text emblem from the first project source; removed the substituted S+ image. Original PWA icon PNGs were preserved.
- Added `mobile-web-app-capable` while retaining the Apple-specific PWA meta tag.
- Bumped the Service Worker cache to v5 so devices fetch the updated app shell.
- Added Cloudflare Worker routing, size, content-type, auth-header, IP-forwarding, static fallback and logo regression tests.
