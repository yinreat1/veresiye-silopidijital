# SilopiDijital Veresiye 0.2.9 — GitHub + Vercel yayın rehberi

Bu proje, Ferhat Büfe'nin kişisel Yunus ProPOS Supabase projesine bağlanan müşteri portalıdır. Portal, ProPOS Cari müşteri kayıtlarını ve satış hareketlerini kaynak olarak kullanır. Ayrı müşteri/lisans ProPOS veritabanını kullanmaz.

## Önemli mimari ayrım

- **Yunus ProPOS:** Windows/Electron masaüstü uygulamasıdır. Kaynak kodunu GitHub'da Private repository içinde tutun. Vercel'e bağlamayın ve kaynak/EXE dosyalarını herkese açık depoda paylaşmayın.
- **SilopiDijital Veresiye:** Müşterilerin telefonlarında açacağı PWA web uygulamasıdır. GitHub'daki ayrı Private repository'den Vercel'e yayınlanır.
- **Supabase:** Portal, Vercel Node.js Function üzerinden yalnızca `veresiye-portal-login` ve `veresiye-portal-admin` Edge Function'larını çağırır. Tarayıcı Supabase tablolarını veya anahtarını doğrudan kullanmaz.

## 1. GitHub deposu

1. GitHub'da `silopidijital-veresiye` adıyla **Private** bir repository oluşturun.
2. Bu ZIP'in içindeki proje dosyalarını doğrudan depo köküne yükleyin. `package.json`, `package-lock.json`, `api/`, `src/`, `public/`, `supabase/` ve `vercel.json` en üst seviyede olmalı.
3. `.env`, `.env.local`, `node_modules/`, `.vercel/` ve `dist/` yüklemeyin. `.gitignore` bunları dışarıda bırakır.
4. `main` dalına gönderin. GitHub Actions Node.js kontrollerine ek olarak Deno ile iki Supabase Edge Function kaynağını da typecheck eder; portal testleri ve Vite derlemesini çalıştırır.

## 2. Vercel projesini bağlama

1. Vercel Dashboard → **Add New → Project**.
2. GitHub hesabınızı bağlayın ve `silopidijital-veresiye` Private repository'sini seçin.
3. Framework Preset: **Vite**.
4. Root Directory: repository root (`./`).
5. Build Command: `npm run check` (frontend/API typecheck, ESLint, security/proxy/remember-me tests, and Vite build run before the deployment is accepted).
6. Output Directory: `dist`.
7. Install Command: `npm ci`.
8. Node.js version: **22.x** (`.nvmrc` ve `package.json` ile sabitlenmiştir).
9. Production Branch: `main`.

**Plan notu:** Vercel Hobby yalnızca kişisel veya ticari olmayan kullanım içindir. Ferhat Büfe gerçek müşterilerinin kullanacağı işletme portalı olduğundan Hobby planında yayınlamayın; Vercel Pro ya da Vercel'in izin verdiği uygun ticari planı seçin. <https://vercel.com/docs/plans/hobby>

Repository'deki kök `api/` klasörü Vercel Node.js Function rotasını sağlar; `vercel.json`, `/admin` gibi SPA yollarını `index.html` dosyasına yönlendirir. Vercel, kökteki `api/` klasöründen Function oluşturmayı destekler. <https://vercel.com/docs/frameworks/frontend/vite>

## 3. Vercel Environment Variables

Bu sürümde Veresiye için Supabase anahtarını Vercel'e elle eklemen gerekmez. Doğru ve güncel Yunus ProPOS publishable anahtarı Vercel sunucu fonksiyonu ve Vite geliştirme sunucusu yapılandırmasında sabitlenmiştir; tarayıcı koduna gönderilmez. `.env` içindeki eski bir `SUPABASE_PUBLISHABLE_KEY` değeri de artık geçersiz anahtarla doğru varsayılanı ezemez.

**Kesinlikle eklemeyin:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `sb_secret_...`, `SUPABASE_SECRET_KEYS`, `SUPABASE_SERVICE_ROLE_KEY` veya `service_role` anahtarı. Service-role/secret anahtarlar yalnızca Supabase Edge Function sunucu ortamında kalmalıdır.

## 4. Yayın öncesi / sonrası test

Önce Preview Deployment üzerinde test edin:

- `/` müşteri giriş ekranını açmalı.
- `/admin` doğrudan adres çubuğundan açılmalı; Vercel 404 vermemeli.
- `POST /api/veresiye/veresiye-portal-login` istekleri Supabase login Edge Function'ına ulaşmalı.
- `POST /api/veresiye/veresiye-portal-admin` istekleri yönetici Edge Function'ına ulaşmalı.
- Tanımsız `/api/veresiye/...` istekleri 404, GET istekleri 405 dönmeli.
- Yanlış kod genel bir giriş hatası göstermeli; gerçek müşteri varlığını açığa çıkarmamalı.
- Geçerli test müşterisi yalnızca kendi borç ve alışverişlerini görmeli.
- Müşteri ekranında tahsilat hareketi veya ödeme yöntemi görünmemeli.
- Yönetici kodları varsayılan olarak `******` olmalı; göz işaretiyle geçici gösterilip tekrar gizlenmeli.
- Erişim kapatılınca müşteri kodu ile giriş reddedilmeli.
- Android Chrome ve iPhone Safari üzerinde ana ekrana ekleme ve PWA simgesi test edilmeli.

**İlk testte gerçek müşteriye değil, kontrollü bir test müşteri hesabına ait kod kullanın.** Sonra erişimi kapatıp test kaydını devre dışı bırakın.

## 5. Yerel çalışma

Node.js 22 kurulu olmalı. Kaynak paketi çıkardıktan sonra:

```bash
npm ci
npm run dev
```

`npm run dev`, Vite üzerinde `localhost:5173` adresini açar. Geliştirme sunucusu `/api/veresiye/*` isteklerini sunucu tarafında yalnızca izin verilen iki Supabase Edge Function'ına iletir; tarayıcıya Service Role anahtarı gönderilmez. Vercel Function ortamını birebir yerelde çalıştırmak isterseniz Vercel CLI yükleyip `vercel login`, `vercel link`, `vercel env pull .env.local` ve `npm run dev:vercel` kullanabilirsiniz. `.env.local` dosyasını GitHub'a yüklemeyin.

## 6. PWA ve indeksleme notu

- Android: Chrome → site menüsü → Uygulamayı yükle / Ana ekrana ekle.
- iPhone: Safari → Paylaş → Ana Ekrana Ekle.
- APK gerekmez; Vercel'in HTTPS alan adı PWA için yeterlidir.
- Portal `noindex` başlığı ve robots meta etiketiyle arama motoru indekslemesine kapalıdır.
- Service Worker yalnızca uygulama kabuğu ve aynı-origin statik assetleri cache'ler. `/api/` yanıtları cache'lenmez. Müşteri borcu / alışveriş detayları çevrimdışı saklanmaz.

## 7. Veri ve güvenlik notları

- Müşteri ekleme/değiştirme yalnızca Yunus ProPOS Cari bölümünde yapılır. Portal ikinci bir müşteri defteri oluşturmaz.
- Müşteri kodları açık metin değil, sunucuda HMAC parmak izi ile aranır; yönetici göz simgesi için AES-GCM şifreli saklanır.
- Yönetici PIN'i aktif ProPOS `admin` personeliyle doğrulanır. Yönetici oturumu 30 dakika geçerlidir.
- Müşteri yanıtı yalnızca kendi adı, cari bakiyesi ve veresiye satış/ürün detaylarını içerir. `customer_payments` kayıtları ve ödeme hareketleri yanıtlanmaz.
- Canlı Supabase'deki yeni portal tablolarında RLS açıktır; `anon` ve `authenticated` doğrudan SELECT izni yoktur.
- ProPOS ana tablolarında mevcut anonim yetkiler için ayrıca güvenlik sertleştirme çalışması gerekmektedir. Portal frontend'ine key gömülmemesi bu mevcut ProPOS API izinlerini tek başına ortadan kaldırmaz. ProPOS GitHub deposu Private tutulmalı; ProPOS web build'i Vercel'e yayınlanmamalıdır.
- Supabase publishable key rotate edilirse portal Vercel değişkeni de güncellenmeli; Edge Function anahtar-kökenli kripto davranışı değişmediği sürece müşteri kodlarının etkilenmemesi beklenir. Secret/pepper türetim kökü değişirse eski kodlar için yeniden kod üretimi gerekebilir.

## 8. Supabase Edge Function durumu

Kişisel Yunus ProPOS Supabase projesinde `veresiye-portal-login` ve `veresiye-portal-admin` Edge Function'ları zaten yayınlanmıştır. Bu portal sürümü yeni SQL migration gerektirmez. Login fonksiyonu v5; 6 haneli müşteri kodunu HMAC ile kontrol eder ve veritabanındaki deneme sınırlamasını kullanır. Ayrıca 30 günlük imzalı müşteri oturumu verir; her yenilemede erişimin açık ve kod sürümünün güncel olduğunu doğrular. Yönetici fonksiyonu ProPOS personel PIN doğrulaması ve 30 dakikalık imzalı yönetici oturumu kullanır.

ProPOS masaüstü uygulaması yönetici işlemleri için Supabase admin Edge Function'ını doğrudan çağırdığı için bu fonksiyona Vercel'e özel bir header/ortak proxy sırrı zorunluluğu eklenmemiştir. Bu ayrım korunmalıdır.

## 9. Giriş kodu ile yönetici PIN'i farklıdır

- **Yönetici PIN'i:** ProPOS Cari penceresindeki portal ayarını açmak ve yönetici işlemini yetkilendirmek içindir. Müşterinin web sitesine yazılmaz.
- **Müşteri giriş kodu:** ProPOS Cari → SilopiDijital Veresiye Giriş Kodu alanında yönetici PIN'iyle doğrulama yaptıktan sonra `Göster` düğmesine basınca görünen 6 haneli koddur. Müşteri web sitesine bu kodu girer.
- `ERİŞİM AÇIK` rozeti yalnızca erişim izninin açık olduğunu söyler; kodun kendisi değildir.

Yayınlanan uygulamada `/api/veresiye/health` adresini açın. Başarılı yanıtta `success: true`, `proxy: "ready"`, `supabase_edge_function: "reachable"` görünmelidir. Bu kontrol müşteri kodu denemesi yapmaz ve başarısız giriş sayacını artırmaz.


## 10. Beni hatırla

Müşteri giriş ekranında **Beni hatırla** varsayılan olarak açıktır. Bu seçenek 6 haneli giriş kodunu tarayıcıya yazmaz. Login Edge Function tarafından imzalanmış, 30 gün geçerli oturum anahtarı kaydedilir. Sayfa tekrar açıldığında sunucu müşteri erişiminin hâlâ açık olduğunu ve kodun değiştirilmediğini kontrol eder. ProPOS'ta erişim kapatılır veya kod yenilenirse eski oturum geçersiz olur. Müşteri Çıkış yaptığında saklanan oturum anahtarı silinir.
