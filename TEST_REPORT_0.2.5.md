# SilopiDijital Veresiye 0.2.5 — Test raporu

## Canlı Supabase incelemesi

- Kişisel Yunus ProPOS projesi: `ukfeuojhigxxxlnhsmls` (ACTIVE_HEALTHY).
- Veresiye erişim tablosunda 1 müşteri kaydı bulundu; `is_active=true`, access hash ve AES-GCM ciphertext/IV mevcut.
- ProPOS yönetici fonksiyonunun son işlemleri HTTP 200 döndü ve erişim kaydı güncellendi.
- Login Edge Function günlüklerinde bu erişim kaydı için gelen çağrı görülmedi; login attempt tablosunda 0 kayıt vardı. Bu, “kod geçersiz” mesajının kod eşleşme hatasından ziyade proxy/Worker çağrısının Supabase'e ulaşmamasıyla uyumlu.
- İnceleme sırasında hiçbir canlı müşteri, satış, ödeme veya erişim satırı değiştirilmedi.

## Kaynak düzeltmeleri

- Yunus ProPOS'un `silopi-dijital-logo.png`, `icon-192.png`, `icon-512.png`, `favicon.png`, `favicon.svg`, `icon.ico` dosyaları aynen kopyalandı.
- Proxy üzerindeki shared-secret zorunluluğu kaldırıldı. Public login Edge Function'ın kendi 6 haneli kod kontrolü ve DB rate limit mekanizması devam eder. Admin Edge Function aktif ProPOS admin PIN'i ve imzalı token'la yetki kontrol eder.
- Vercel ve Cloudflare Worker için `/api/veresiye/health` eklendi. Bu adres boş kod göndererek yalnızca Edge Function'ın erişilebilirliğini test eder; giriş denemesi sayılmaz.
- Müşteri giriş ekranı artık proxy/HTTP hatasını “kod geçersiz” diye gizlemez.

## Yerel testler

- Edge function authorization source regression: PASS.
- Vercel API contract + health: PASS (upstream mocked).
- Vercel local HTTP smoke + health: PASS (upstream mocked).
- Cloudflare Worker routing + health: PASS (upstream mocked).
- Official brand asset check: PASS.
- TypeScript syntax transpile checks: PASS.

Tam `npm ci`, `npm run typecheck`, `npm run lint` ve Vite production build bu çalışma ortamında npm registry DNS erişimi olmadığı için çalıştırılamadı. Bunlar GitHub Actions/Vercel build sırasında bağımlılıklar kurulduğunda otomatik çalışacaktır. Gerçek Cloudflare network testi de bu ortamda DNS kısıtı nedeniyle yapılamadı; dağıtım sonrası `/api/veresiye/health` ile doğrulanmalıdır.
