# 0.2.2 — GitHub + Vercel uyarlaması

- Cloudflare Pages Function proxy kaldırıldı; Vercel Node.js Function `api/veresiye/[function].ts` eklendi.
- Proxy yalnızca `veresiye-portal-login` ve `veresiye-portal-admin` Edge Function hedeflerine izin verir.
- Supabase publishable key yalnızca Vercel sunucu ortam değişkeninden okunur; tarayıcı paketine gömülmez.
- Vercel SPA rewrite, function süresi, Frankfurt region ve güvenlik yanıt başlıkları eklendi.
- Node.js 22 ve `npm ci` için lockfile uyumlu kurulum tanımı eklendi.
- Vercel API TypeScript yapılandırması, proxy contract testi, yerel HTTP testi ve GitHub Actions kontrolleri güncellendi.
- Cloudflare Pages'e özel route/test/dokümantasyon dosyaları paketten çıkarıldı.
