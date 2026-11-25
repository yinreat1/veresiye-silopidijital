# Test Raporu — SilopiDijital Veresiye 0.2.6

## Bu kaynak paketinde hedeflenen regresyonlar
- Giriş ekranı, Yönetici PIN'i ile Müşteri giriş kodunu ayrı açıklar.
- Health test düğmesi `/api/veresiye/health` rotasını çağırır.
- Login hatası, upstream hata mesajını korur; yanlış kod mesajında müşteri kodu rehberi gösterilir.
- Portal logosu ve uygulama simgeleri Yunus ProPOS ZIP'inden bayt-bayt kopyalanmıştır.
- Worker ve Vercel API'de health rotası bulunur; normal giriş POST istekleri login Edge Function'a iletilir.
- ProPOS cari ekranında yönetici PIN'i ile müşteri kodu farkı yazılıdır.

## Test sınırlaması
Bu çalışma ortamında npm paket kayıt sunucusuna erişim olmadığından React/Vite bağımlılıkları kurulamadı. Bu nedenle tam frontend `typecheck`, ESLint ve Vite production build sonucu verilmiyor. Kaynak sözdizimi, Node tabanlı proxy/Worker regresyonları ve ZIP bütünlüğü ayrıca çalıştırılacaktır. Canlı gerçek müşteri koduyla giriş testi yapılmadı.

## Canlı Supabase salt-okunur kontrolü
- Kişisel Yunus ProPOS projesinde bir portal erişim kaydı var ve `is_active = true`.
- `last_login_at` henüz NULL.
- Son 24 saatteki login başarısız deneme tablosu sayısı 0. Bu gözlem, web login çağrısının Supabase Edge Function'a ulaşmadığını veya deneme kaydetmeden önce bir katmanda durduğunu düşündürür; tek başına kodun yanlış olduğunu kanıtlamaz.
- Canlı DB'de hiçbir tablo veya müşteri kaydı bu paket hazırlanırken değiştirilmedi.
