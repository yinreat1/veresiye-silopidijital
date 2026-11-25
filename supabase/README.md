# Supabase bağlantı sınırları

Bu web portalı yalnızca kişisel Yunus ProPOS Supabase projesini kullanır: `ukfeuojhigxxxlnhsmls`. Ayrı müşteri ProPOS/lisans projesi kesinlikle kullanılmaz.

Portal sunucusu yalnızca `veresiye-portal-login` ve `veresiye-portal-admin` Edge Function'larına istek yollar. `SUPABASE_PUBLISHABLE_KEY` yalnızca server runtime'da okunabilir; `VITE_` öneki kullanılmaz. `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY` veya `sb_secret_...` anahtarları portal, Vercel ya da Worker içine konulmaz.

## Canlıda önceden oluşturulmuş nesneler

- `public.veresiye_portal_access`
- `public.veresiye_portal_login_attempts`
- Edge Function `veresiye-portal-login`
- Edge Function `veresiye-portal-admin`

Portal repo yeni SQL migration oluşturmaz ve mevcut ProPOS tablolarını kopyalamaz. Müşteri adı, cari bakiye ve satış ayrıntıları ProPOS'tan alınır. Müşteriye ödeme hareketi gönderilmez.

## Yetkilendirme

- Müşteri giriş fonksiyonu altı haneli müşteri kodunu HMAC ile kontrol eder; başarısız girişleri DB rate-limit tablosuna kaydeder.
- Yönetici fonksiyonu ProPOS `admin` personel rolünü ve `verify_staff_pin` sonucunu kontrol eder; yönetici oturumu 30 dakikalık imzalı token ile korunur.
- ProPOS masaüstü uygulaması yönetici fonksiyonunu doğrudan çağırır. Bu nedenle fonksiyona Vercel'e özel ortak proxy sırrı zorunlu tutulmaz.

Vercel deployment Supabase schema migration'ı veya Edge Function deployment'ı yapmaz. Canlı fonksiyon sürümleri Supabase Dashboard'dan kontrol edilmelidir.
