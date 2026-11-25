# SilopiDijital Veresiye — ProPOS entegrasyon durumu (2026-11-25)

## Veri eşlemesi

| Portal verisi | Tek doğruluk kaynağı | Davranış |
|---|---|---|
| Müşteri | `public.customers` | ProPOS Cari'deki kayıt; portalda ikinci müşteri kartı açılmaz |
| Güncel bakiye | `public.customers.balance` | İşaretli bakiye; negatif değer müşteri avansı olarak gösterilir |
| Alışveriş | `public.sales` | Her satış tek işlem kartıdır |
| Ürün ayrıntıları | `public.sale_items` | Ürün, miktar, birim fiyatı ve satır toplamı |
| Karma ödeme veresiye parçası | `public.sale_payments` | Yalnızca kredi parçası bulunan split satışlar dahil edilir |
| İade | `public.sale_returns` | İade edilen miktar/tutar ürün satırlarından düşülür |
| Portal kodu ve erişim | `public.veresiye_portal_access` | HMAC kod parmak izi + AES-GCM şifreli gösterim, aktif/pasif |
| Giriş denemesi | `public.veresiye_portal_login_attempts` | Sunucu tarafı HMAC parmak izleri ve sınırlandırma |

`public.customer_payments` müşteri giriş fonksiyonundan okunmaz ve müşteri yanıtına eklenmez. Tahsilatlar zaten `customers.balance` değerine yansır.

Eski satışlarda `customer_id IS NULL` ise tam müşteri adı ile ilişkilendirilir. Başka bir müşteri ID'sine bağlı satışlar isim benzerliğiyle aktarılmaz.

## Canlı Supabase kontrolü

- Kişisel Yunus ProPOS projesi `ukfeuojhigxxxlnhsmls` ACTIVE_HEALTHY.
- Canlı Edge Function sürümleri son okumada `veresiye-portal-login` v4 ve `veresiye-portal-admin` v2, ACTIVE durumundaydı.
- Bu ZIP'lerdeki yeni kaynaklar iki fonksiyona Vercel-Supabase ortak gizli anahtar kontrolü ekler. Bu yeni kaynaklar **henüz canlıya deploy edilmedi**.
- `veresiye_portal_access` ve `veresiye_portal_login_attempts` RLS açık; `anon` / `authenticated` doğrudan SELECT izni yok. İnceleme sırasında her iki tabloda 0 kayıt vardı.
- Bu sürüm yeni SQL migration çalıştırmaz ve gerçek müşteri/satış/tahsilat kayıtlarını değiştirmez.

## 25 Kasım 2026 yerel doğrulama

- Yunus ProPOS `npm run test:local-db`: 23/23 regresyon grubu PASS.
- ProPOS 56 TypeScript/TSX dosyası sözdizimi ayrıştırması PASS.
- Portal güvenlik kaynak testi PASS.
- Portal ortak proxy sır regresyon testi PASS.
- Vercel API sözleşme testi PASS (Supabase upstream mock).
- Vercel yerel HTTP smoke testi PASS (Supabase upstream mock).
- Vercel API TypeScript: `tsc --noEmit -p tsconfig.api.json` PASS.
- Portal 17 TypeScript/TSX dosyası sözdizimi ayrıştırması PASS.
- `package.json`, `package-lock.json`, `vercel.json` ve API TS config parse edildi; lockfile sürümü `0.2.3` ile eşleşti.

## Bu çalışma ortamında tamamlanamayanlar

- Portal ve ProPOS tam frontend semantic TypeScript kontrolü: React / React DOM / lucide-react / qrcode type paketleri çalışma konteynerinde yok.
- ESLint ve Vite build: bağımlılıklar kurulamadığı için binary yok.
- Npm paket kayıt sunucusuna ağ/DNS erişimi bu çalışma ortamında başarısız oldu; GitHub Actions ve Vercel'in kendi build ortamında bağımlılıklar kurulunca otomatik doğrulanacaktır.
- Gerçek Vercel Preview / Production HTTP ve gerçek müşteri koduyla browser testi: repo henüz Vercel'e deploy edilmedi. Yerel HTTP testi Supabase upstream mock kullanır.

## Yayın engeli — ProPOS ana tabloları

İncelemede mevcut ProPOS API izinlerinde `anon` için `customers`, `sales`, `sale_items` ve `customer_payments` SELECT erişimleri ve işletme bazlı mevcut RLS davranışı bulundu. Bu, Veresiye'nin tarayıcıya anahtar vermemesiyle tek başına çözülmez: ProPOS masaüstü uygulamasındaki publishable key çıkarılırsa doğrudan Data API sorgusu riski kalır.

Bu izinleri hemen kapatmak mevcut ProPOS masaüstünü bozabilir. Gerçek müşterilere açılmadan önce personel kimlik doğrulamasını/server-side API'ye taşıyan ve tüm satış akışlarını doğrulayan ayrı bir güvenlik sertleştirmesi tamamlanmalıdır. O zamana kadar ProPOS deposu Private kalmalı; gerçek müşteri QR dağıtımı yapılmamalıdır.

## Sonraki zorunlu adımlar

1. Portal ZIP'ini ayrı Private GitHub reposuna gönderip Vercel Preview yayınını oluşturun.
2. Yayınlanan adreste `/api/veresiye/health` kontrolünü çalıştırın; proxy ve Supabase login fonksiyonunun erişilebilir olduğunu doğrulayın.
3. ProPOS Cari içinden bir müşteri için yönetici PIN’iyle erişimi kontrol edin; ardından `Göster` ile açılan müşteri kodunu kullanın. Yönetici PIN’ini web sitesine girmeyin.
4. GitHub Actions ve Vercel `npm run check` sonuçlarında typecheck, lint ve build’in geçtiğini doğrulayın.
5. Kontrollü test hesabıyla müşteri izolasyonu, erişim kapatma, kod yenileme, ödeme gizliliği ve PWA kurulumunu Preview’da test edin.
6. Yukarıdaki ProPOS ana tablo izinleri için ayrı güvenlik sertleştirmesi bitmeden gerçek müşterilere açmayın.
