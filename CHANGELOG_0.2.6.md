# SilopiDijital Veresiye 0.2.6

- Müşteri giriş ekranında ProPOS yönetici PIN'i ile müşteriye verilen 6 haneli kodun farklı olduğu açıkça anlatıldı.
- `Giriş kodu geçersiz` mesajı artık ProPOS Cari'deki `Göster` kodunu ve erişim durumunu kontrol etmeniz gerektiğini belirtir.
- Müşteri giriş ekranına `/api/veresiye/health` bağlantı kontrolü eklendi. Sağlık kontrolü boş kod göndererek Edge Function erişimini doğrular; başarısız kod denemesi kaydetmez.
- Cloudflare Worker health endpoint'ine OPTIONS desteği eklendi.
- İlk Yunus ProPOS kurulumundaki orijinal `silopi-dijital-logo.png`, `icon-512.png`, PWA simgeleri ve favicon aynen kullanılır; yeniden çizim veya renk değişikliği yoktur.
- Service Worker önbellek sürümü, yeni logo ve giriş ekranının eski cihaz önbelleğinden yenilenmesi için artırıldı.
- Yayın rehberi, kullanılmayan eski ortak proxy sırrı adımlarından temizlendi.
- Supabase şeması veya canlı müşteri kayıtlarında değişiklik yapılmadı.
