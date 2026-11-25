# 0.2.0 — Yunus ProPOS integration

- Removed standalone/dummy customer-account creation. ProPOS Cari is the single customer source of truth.
- Connected customer login and admin management to server-side Supabase Edge Functions in the personal Yunus project.
- Customer access codes are six digits, masked by default with eye reveal in admin screens, and can be rotated or disabled.
- Admin sign-in uses an active ProPOS `admin` staff PIN; signed admin session is held in memory for 30 minutes.
- Customer response includes current signed balance and grouped credit-sale product lines only; customer payment movements are never returned.
- Split sales appear only where the sale has a positive credit portion; returned quantities/amounts are netted.
- Official Silopi Dijital symbol and Cloudflare Pages deployment guide added.
