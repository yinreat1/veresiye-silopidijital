# SilopiDijital Veresiye 0.2.3 — GitHub + Vercel yayın ve güvenlik uyarlaması

- Cloudflare Pages'e özel dağıtım kaldırıldı; Vercel `api/` Node.js Function proxy ve Vite build ayarları kullanılır.
- Supabase Edge Function'larına yalnızca Vercel sunucusunun bildiği 256-bit `VERESIYE_PROXY_SHARED_SECRET` eklenir ve her iki fonksiyon bu sırrı zorunlu tutar.
- API proxy yalnızca iki gerekli fonksiyonu çağırır, request gövdesini sınırlar, upstream zaman aşımı uygular ve yanıtı cache dışı tutar.
- GitHub Actions frontend/API typecheck, lint, güvenlik, ortak sır, proxy sözleşme/HTTP testleri ve production build çalıştırır.
- Vercel için Node 22, npm lockfile, SPA route, güvenlik başlıkları ve PWA yapılandırması eşleştirildi.
