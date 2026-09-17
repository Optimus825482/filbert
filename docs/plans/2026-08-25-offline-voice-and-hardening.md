# Offline, Sesli Not ve Yetki Sertleştirme Uygulama Planı

**Goal:** Filbert'in bağlantısız sahada sesli not taslağı oluşturabilmesini, bağlantı geldiğinde güvenli biçimde senkronize etmesini ve yetki/audit doğrulamasını genişletmek.

**Architecture:** İlk offline iş türü sesli not taslağıdır. Tarayıcıdaki IndexedDB outbox kaydı benzersiz `offlineId` ile `/api/offline-sync` uç noktasına gönderilir; sunucu mevcut oturum ve RBAC ile doğrular, aynı kaydı ikinci kez yazmaz. Konuşma tanıma yalnız tarayıcı API'si ile çalışır; transkript kullanıcı tarafından görülür ve onaylanmadan operasyon kaydına dönüştürülmez.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 7/PostgreSQL, native IndexedDB, Web Speech API, node:test.

---

### Task 1: Sesli not veri modeli ve izinleri

**Files:** `prisma/schema.prisma`, `prisma/migrations/`, `src/lib/rbac/permissions.ts`, `src/lib/actions/sesli-not.ts`

1. `SesliNot` modelini firma/kullanıcı ilişkisi, taslak durumu, düzenlenmiş metin ve benzersiz `offlineId` ile ekle.
2. `SESLI_NOT` uygulama modülünü ve rol matrisini ekle.
3. Migration'ı uygula ve istemciyi üret.
4. Sunucu action'ında firma kapsamı, izin, idempotency ve audit uygula.

### Task 2: Offline outbox ve broker

**Files:** `src/lib/offline/*`, `src/app/api/offline-sync/route.ts`, `src/components/offline-sync-register.tsx`

1. IndexedDB outbox için tipli ekleme/listeleme/silme yardımcılarını yaz.
2. Online olduğunda ve service worker mesajında kuyrukları gönderen istemci broker'ı ekle.
3. API uç noktasında session/RBAC doğrulaması, payload şeması ve `offlineId` idempotency kuralı uygula.
4. Başarılı öğeleri sil; başarısızları kuyrukta bırak ve kullanıcıya durum bildir.

### Task 3: Sesli not kullanıcı akışı

**Files:** `src/app/sesli-not/page.tsx`, `src/components/sesli-not-form.tsx`, `src/components/bottom-nav.tsx`

1. Yer tutucuyu izinli sesli-not ekranıyla değiştir.
2. Konuşma API desteğini açıkça göster; mikrofon izni, başlat/durdur ve düzenlenebilir metin uygula.
3. Online kaydet veya offline outbox'a al; taslak listesini firma bazında göster.
4. Alt menüdeki sahte sesli katmanı gerçek sesli-not sayfasına yönlendir.

### Task 4: Yetki ve audit sertleştirmesi

**Files:** `src/app/**/page.tsx`, `src/lib/actions/*`, `src/lib/recovery.ts`

1. Kalan doğrudan sorguları firma ilişkisiyle tara.
2. Her operasyon sayfasına görüntüleme izni denetimi ekle veya merkezi güvenli layout kur.
3. Tüm mutasyonlarda audit metadata ve firma kapsamını test et.

### Task 5: Kabul testleri

**Files:** `test/offline*.test.ts`, `test/sesli-not*.test.ts`, `test/rbac*.test.ts`

1. Offline payload doğrulama ve idempotency testleri ekle.
2. Sesli not durum geçişleri ile yetkisiz erişim testleri ekle.
3. Lint, typecheck, test, Prisma migration status, production build ve boş DB setup smoke testini çalıştır.
