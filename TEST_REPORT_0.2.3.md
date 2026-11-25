# SilopiDijital Veresiye 0.2.3 — GitHub + Vercel test raporu

Tarih: 25 Kasım 2026

## Bu pakette otomatik olarak bulunan kontrol zinciri

`npm run check` sırasıyla şunları çalıştırır:

1. Frontend TypeScript: `tsc --noEmit -p tsconfig.app.json`
2. Vercel Function TypeScript: `tsc --noEmit -p tsconfig.api.json`
3. ESLint
4. Güvenlik kaynak kontrolü
5. Supabase Edge Function ortak proxy sırrı regresyonu
6. Vercel API sözleşme testi
7. Yerel HTTP smoke testi (Supabase upstream mock)
8. Vite production build

Vercel build command bu tam kontrol zincirini çalıştırır; herhangi bir basamak hata verirse deployment build başarısız olmalıdır. GitHub Actions da aynı komutu çalıştırır.

## Bu ortamda geçen testler

- `node scripts/check-security.mjs` — PASS.
- `node tests/proxy-auth-regression.cjs` — PASS (yanlış/eksik/bozuk/ayarlı sır senaryoları iki Edge Function için).
- `node tests/vercel-proxy-contract.cjs` — PASS (metot allow-list, endpoint allow-list, JSON doğrulama, gövde sınırı, env fail-closed, upstream status/header, istemci IP iletimi).
- `node tests/vercel-proxy-http-smoke.cjs` — PASS (yerel HTTP sunucusu üzerinden statik kabuk ve API akışı).
- `tsc --noEmit -p tsconfig.api.json` — PASS.
- 17 TypeScript/TSX dosyası sözdizimi parse — PASS.
- JSON konfigürasyonları ve package-lock 0.2.3 sürüm eşleşmesi — PASS.

## Bu ortamda geçmeyen / tamamlanamayan testler

- Frontend semantic TypeScript: `npm run typecheck` React, React DOM, qrcode ve lucide-react paketleri kurulu olmadığı için TS2307 modül bulunamadı hataları verdi. Bu çıktı kaynak kodun derleme hatası olduğunu kanıtlamaz; bağımlılıklar bulunmadığı için kontrol geçersiz kalmıştır.
- ESLint: binary kurulu değil (`eslint: not found`).
- Vite üretim build: binary kurulu değil (`vite: not found`).
- Npm registry DNS/ağ erişimi bu ortamda sağlanamadı; `npm ci` tamamlanamadı.
- Gerçek Vercel deployment/HTTP/browser testi yapılmadı; repo henüz kullanıcı hesabında Vercel'e bağlanmış değil. Yerel HTTP testi Supabase upstream'i mock eder ve gerçek müşteri verisini okumaz.

## Canlı Supabase kontrolü

- Proje: `ukfeuojhigxxxlnhsmls` — ACTIVE_HEALTHY.
- Mevcut canlı fonksiyonlar: login v4 ACTIVE, admin v2 ACTIVE.
- Bu ZIP'teki ortak sır doğrulaması kaynak koduna eklenmiştir; Supabase canlı fonksiyonlarına henüz deploy edilmemiştir.
- Portal erişim ve giriş denemesi tablolarında RLS açık, anon/authenticated SELECT izni yok ve tablolar kontrol sırasında boştur.
- Bu sürüm migration çalıştırmaz; satış, müşteri, stok veya tahsilat tablolarını değiştirmez.

## Yayın güvenlik engeli

Mevcut ProPOS ana tabloları için anonim Data API SELECT izinleri halen ayrı risk olarak durmaktadır. Gerçek müşteri verisiyle canlıya çıkmadan önce ProPOS personel oturumu/API mimarisini güvenli hale getiren kapsamlı RLS/izin sertleştirmesi tamamlanmalıdır. Ayrıntı: `SUPABASE_RLS_LAUNCH_BLOCKER.md`.
