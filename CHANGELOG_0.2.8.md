# SilopiDijital Veresiye 0.2.8

- Added Vite server-side development API middleware for `/api/veresiye/*`, fixing local `localhost:5173` health/login 404s without depending on a Worker deployment.
- Added signed 30-day customer session tokens. “Beni hatırla” persists the signed token, never the six-digit access code.
- Every restored session re-checks the customer's active portal access; disabling access invalidates remembered sessions immediately.
- Customer logout clears the remembered session.
- Removed the long customer code instruction panel from the login screen.
- Kept the official Yunus ProPOS Silopi Dijital logo and app icon unchanged.

- Vite development server now serves the same-origin `/api/veresiye/health` and login/admin routes server-side, avoiding localhost:5173 404s.
- Customer login's long help paragraph removed; a `Beni hatırla` option stores only a signed 30-day session token, never the six-digit code.
- Login Edge Function v5 deployed; remembered sessions re-check active access and code version on every restore.
- Service worker cache bumped to force installed PWA clients to update the API-enabled app shell.
