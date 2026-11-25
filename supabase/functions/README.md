# Supabase Edge Functions

Bu klasördeki `veresiye-portal-login` ve `veresiye-portal-admin` kaynakları, kişisel Yunus ProPOS Supabase projesi `ukfeuojhigxxxlnhsmls` için kaynak kopyalarıdır.

- `veresiye-portal-login`: 6 haneli müşteri kodunun HMAC eşleşmesini, aktif erişimi ve DB tabanlı giriş deneme sınırını doğrular.
- `veresiye-portal-admin`: ProPOS aktif `admin` personelinin PIN'ini `verify_staff_pin` ile doğrular; yönetici işlemlerini 30 dakikalık imzalı token ile korur.

ProPOS masaüstü uygulaması admin Edge Function'ını doğrudan çağırdığı için `VERESIYE_PROXY_SHARED_SECRET` veya `x-veresiye-proxy-secret` gereksinimi yoktur. Service-role/secret API anahtarı yalnızca Supabase Edge Function sunucu ortamında kalır.

Bu portal paketi yeni SQL migration içermez. Canlı function sürümlerini değiştirmeden önce proje ref'ini doğrulayın; müşteri/lisans Supabase projesine deploy etmeyin.
