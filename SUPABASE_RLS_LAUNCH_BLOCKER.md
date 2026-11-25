# Supabase API security blocker before public customer launch

A read-only live privilege/policy inspection of personal Yunus Supabase confirmed:

- `anon` has SELECT table privilege on `public.customers`, `public.sales`, `public.sale_items`, and `public.customer_payments`.
- Existing permissive policies for role `anon` scope these operations to `get_default_business_id()` (Ferhat Büfe), but still allow a public client using the project's publishable key to read business-scoped records directly.
- The new portal tables `public.veresiye_portal_access` and `public.veresiye_portal_login_attempts` are different: RLS is enabled and `anon`/`authenticated` do not have SELECT access.

The portal UI itself uses only the Edge Functions and never queries the above tables directly. The Edge login response never includes customer payment rows. That does **not** remove the existing direct Data API exposure elsewhere in the shared ProPOS project.

Do not publish the customer URL publicly until the ProPOS API/RLS access model is hardened. Do not merely revoke `anon` permissions as the current ProPOS desktop app depends on the existing publishable-key policies. First migrate desktop operations to a secure authenticated staff session/server API, then narrow public privileges and regression-test checkout, stock, customer, payment, reporting, offline sync, and returns.
