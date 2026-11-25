# SilopiDijital Veresiye 0.2.9

Ferhat Büfe müşterileri için Silopi Dijital markalı, telefona kurulabilir müşteri veresiye portalı.

## Teknoloji

- React 18 + TypeScript + Vite
- PWA manifest, Service Worker ve mobil ana ekran simgeleri
- Vercel Node.js Function: `api/veresiye/[function].ts`
- Vite development proxy uses the exact current project publishable key from server-only config; no `.env` key override is required
- Supabase Edge Functions üzerinden yalnızca ProPOS Cari müşterileri, borç bakiyeleri ve veresiye alışverişleri

## Veri kapsamı

Veresiye uygulamasına yalnızca Yunus ProPOS içindeki **Müşteriler / Cari** alanıyla ilgili müşteri, bakiye, veresiye satış ve ürün ayrıntıları açılır. Diğer ProPOS modülleri bu web uygulamasına aktarılmaz. Tahsilat kayıtları ve ödeme hareketleri müşteri ekranına gösterilmez.

Proje hedefi yalnızca `ukfeuojhigxxxlnhsmls` kişisel Yunus ProPOS Supabase projesidir. Müşteri ProPOS/lisans projesi kullanılmaz. Portal ikinci bir müşteri defteri oluşturmaz.

## Hızlı başlangıç

```bash
npm ci
npm run dev
```

Vite geliştirme sunucusu `/api/veresiye/*` isteklerini sunucu tarafında Supabase Edge Functions'a iletir; bu nedenle `localhost:5173` üzerinde sağlık kontrolü veya müşteri girişi için 404 oluşmaz. Vercel Function'larını yerelde test etmek için isteğe bağlı olarak `npm install --global vercel` ardından `npm run dev:vercel` kullanabilirsiniz.

## Kontroller

```bash
npm run check
```

Bu komut frontend/API typecheck, ESLint, güvenlik/regresyon testleri, HMAC/hatırlanan oturum testleri ve Vite production build'ini çalıştırır. GitHub Actions ayrıca Supabase Edge Function TypeScript kontrolü yapar.

## Yayın

Adım adım anlatım için [`DEPLOYMENT_GITHUB_VERCEL.md`](./DEPLOYMENT_GITHUB_VERCEL.md) dosyasına bakın. GitHub'da ayrı **Private** repository kullanın. Vercel'e yalnızca bu Veresiye projesini bağlayın; Yunus ProPOS Windows uygulaması ayrı, Private masaüstü projesidir.

## Resmi marka dosyaları

`public/silopi-dijital-logo.png`, `icon-192.png` ve `icon-512.png` Yunus ProPOS kaynak paketinden birebir alınmıştır. Logo/ikon dosyalarını değiştirmeyin.

## Girişte beni hatırla

Müşteri ekranındaki **Beni hatırla** seçeneği açık olduğunda tarayıcı 6 haneli kodu değil, sunucu tarafından imzalanmış 30 günlük müşteri oturum anahtarını saklar. Her açılışta müşteri erişimi yeniden kontrol edilir. ProPOS'ta erişim kapatılır veya kod yenilenirse eski oturum geçersiz kalır. Çıkış yapıldığında saklanan oturum silinir.

## Canlı müşteri yayını için önemli

Canlı yayından önce `/api/veresiye/health` kontrolünün başarılı olduğunu doğrulayın ve kontrollü bir test müşteri koduyla giriş yapın. ProPOS ana tablolarındaki mevcut anonim Data API izinleri için ayrıca güvenlik sertleştirmesi gerekir; bu bitmeden gerçek müşterilere QR kodu dağıtmayın.
