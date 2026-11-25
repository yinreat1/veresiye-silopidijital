# SilopiDijital Veresiye 0.2.1

- Added the missing, credential-free `.env.example` expected by the security check.
- Added automated Cloudflare Pages proxy contract tests: OPTIONS handling, method/function allow-list, content-type and request-size validation, publishable-key fail-closed behavior, upstream destination/header/IP forwarding, response passthrough, and no-store headers.
- Added a local HTTP integration smoke test for the Pages proxy handler using a mocked Supabase upstream.
- Added the proxy contract test to the standard `npm run check` pipeline.
- No database schema, live customer, sales, balance, or payment data was changed by this source update.
