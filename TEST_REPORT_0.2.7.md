# Test report — SilopiDijital Veresiye 0.2.7

Passed in the available container:
- `npm run test:security`
- `npm run test:edge-routing`
- `npm run test:vercel`
- `npm run test:http` (Supabase upstream mocked)
- `npm run test:worker` (Supabase upstream mocked)
- `npm run test:brand` (official Yunus ProPOS wordmark + app icon SHA-256 checks)
- `npm run test:guidance`
- `npm run typecheck:api`
- `npm run typecheck:worker`

Source syntax transpilation was run for changed TS/TSX files. Full React app `typecheck`, ESLint and Vite production build could not be completed in this container because npm registry DNS resolution failed and project dependencies are not installed. This is not reported as a pass.

No live database migration, customer code rotation, or customer data modification was performed. Live access record was read-only checked and shown active; no customer login attempt was recorded in the inspected period.
