# SilopiDijital Veresiye 0.2.9 — güncel durum

## Hedef kurulum

- GitHub: ayrı Private repository `silopidijital-veresiye`.
- Hosting: Vercel (Vite static build + Node.js Function).
- Veri kaynağı: yalnızca kişisel Yunus ProPOS Supabase projesi `ukfeuojhigxxxlnhsmls`.
- Veri kapsamı: ProPOS'tan yalnızca **Müşteriler / Cari** ile ilgili müşteri, güncel bakiye, veresiye satış ve ürün satırları. Diğer ProPOS modülleri bu portalın kapsamı değildir.
- Tahsilat hareketleri müşterinin web ekranına gönderilmez.
- Yunus ProPOS Windows uygulaması ayrı, Private masaüstü projesidir; Vercel'e yayınlanmaz.

## Yerel çalışma ve API

- `npm run dev` → Vite `localhost:5173`.
- Vite dev middleware `/api/veresiye/health` ve iki allow-list API yolunu sunucu tarafından Supabase Edge Functions'a iletir. Böylece Vite'ın kendisinden kaynaklanan local 404 ortadan kaldırılmıştır.
- Üretim Vercel API kaynağı: `api/veresiye/[function].ts`.
- Tarayıcı ProPOS tablolarına veya Supabase anahtarına doğrudan bağlanmaz.
- Node sürümü 22.x.

## Supabase durumu

- Kişisel Yunus ProPOS projesinde `veresiye-portal-login` Edge Function v5 ACTIVE.
- `veresiye-portal-admin` Edge Function v2 ACTIVE.
- Login v5 HMAC 6 haneli kod doğrulamasını, DB/IP deneme sınırlamasını ve 30 günlük imzalı müşteri oturumunu destekler.
- Hatırlanan oturum her açılışta müşteri erişiminin hâlâ açık ve kod sürümünün güncel olduğunu doğrular. Erişim kapatma veya kod yenileme eski oturumu iptal eder.
- Bu sürüm için yeni SQL migration uygulanmadı; müşteri, satış, bakiye ve tahsilat kayıtları değiştirilmedi.

## Geçen kontroller

- Güvenlik kaynak testi.
- Vercel proxy sözleşme testi ve HTTP smoke testi (Supabase upstream mock).
- Vite local API middleware HTTP smoke testi (Supabase upstream mock).
- Giriş ekranı talimatlarının kaldırılması regresyon testi.
- Hatırlanan oturum regresyon testi.
- ProPOS admin ve Veresiye login HMAC uyumluluk testi; token imza/tamper/expiry testleri.
- Logo ve PWA ikonlarının ProPOS kaynaklarıyla birebir hash kontrolü.
- API TypeScript strict kontrolü; Node/Vite config için ayrı `typecheck:node` komutu GitHub/Vercel kalite adımına eklendi.
- Supabase Edge Function login v5 canlıya dağıtıldı ve fonksiyon durumu tekrar doğrulandı.

## Bu çalışma ortamında tamamlanamayanlar

- `npm ci --offline` npm cache içinde olmayan bir paket (`yocto-queue`) nedeniyle ENOTCACHED ile durdu. Bu nedenle tam React uygulaması typecheck, ESLint ve Vite production build bu ortamda çalıştırılamadı.
- Gerçek müşterinin 6 haneli koduyla uçtan uca tarayıcı girişi yapılmadı. Gerçek müşteri kodu test veya çıktı içerisine yazılmadı.
- GitHub Actions ve Vercel `npm run check`, bağımlılıkları `npm ci` ile kurabildiğinde tam derleme kontrollerini çalıştıracak.

## Canlı müşteri yayını öncesi blocker

Yunus ProPOS ana tablolarında mevcut anonim Data API izinleri için ayrı güvenlik sertleştirmesi gerekiyor. Portal frontend'i bu tablolara doğrudan erişmese de ortak Supabase projesindeki mevcut anonim API izinleri güvenlik riski oluşturabilir. Bu sorun çözülmeden gerçek müşterilere QR kodu dağıtılmamalıdır. Ayrıntı: `SUPABASE_RLS_LAUNCH_BLOCKER.md`.


## 0.2.9 API key correction (2026-11-25)

Supabase function logs showed `UNAUTHORIZED_INVALID_API_KEY` / `bad_checksum` for the Vite development health probe. The Vite config had an uppercase `C` where the current project publishable key contains lowercase `c`. The server-side Vite and Vercel proxies now use the exact current key returned by Supabase, and stale `.env` / Vercel environment overrides cannot replace it. No database or customer records were changed.
