# Multi-tenant Setup, Yetkilendirme ve Offline MVP Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Filbert'i Akaydın Tarım pilotundan, yalnız platform yöneticisinin kurduğu firmalar için güvenli oturum, rol/izin, onay akışı, audit kaydı ve çevrimdışı kuyrukla çalışan çok-firmalı bir MVP'ye dönüştürmek.

**Architecture:** Her iş verisi `Firma` kiracısına bağlı kalacak ve tüm sunucu giriş noktaları oturumdan çözümlenen firma kimliğiyle kapsamlanacak; kullanıcı girdisinden firma kimliği asla kabul edilmeyecek. Platform yöneticisi işletme işlemi yapmayacak; yalnız ilk kurulum, firma açma, rol/izin şablonları ve kullanıcı yetkilendirmesini yönetecek. İşlem onayları, emanet devir/iade ve offline senkron, aynı yetki kapısından geçip immutable audit kaydı üretecek.

**Tech Stack:** Next.js 16 App Router, TypeScript, PostgreSQL 17, Prisma 7, pnpm, React 19, Vitest, Playwright, Workbox tabanlı service worker.

---

## Kapsam ve sabit kararlar

- Otomatik fiyat scraping, e-Belge, çek/senet ve SMS/dekont bu çalışmanın kapsamı dışındadır. Sesli not/komut kapsamı, sonradan kabul edilen `2026-08-25-offline-voice-and-hardening.md` planı ile genişletilmiştir; güncel uygulama yalnız kullanıcı onaylı sesli taslakları kapsar.
- "Sistem yöneticisi" ayrı bir platform hesabıdır; bir firmanın günlük alım, satış veya finans işlemlerini yapamaz.
- Firma sahibi, firma içi tüm izinlere sahip ön tanımlı roldür. Muhasebe ve saha gibi diğer roller modül + eylem bazında kısıtlanır.
- Audit log zorunludur; finansal ve yetkisel olaylar silinmeyecek, yalnız ek kayıt/ters kayıt üretilecektir.
- Service worker yalnız kabuk önbelleği yapmayacak; çevrimdışı oluşturulan desteklenen taslakları yerel kuyrukta saklayıp tekrar çevrimiçi olduğunda idempotent biçimde gönderecektir.
- İlk yayımdan önce `SYSTEM_ADMIN_MAIL`, `SYSTEM_ADMIN_PASS` ve yalnız ilk `/setup` için `SYSTEM_MAIN_PASS` ortam değişkenleri tanımlanır. Bu gizli değerler kodda, README'de veya istemcide tutulmaz.

## Önkoşullar ve kabul ölçütleri

- Yeni veritabanında `/setup` dışında hiçbir uygulama rotası erişilebilir değildir.
- Bootstrap ile bir platform yöneticisi oluşturulur; bu yönetici firma açar, firma sahibi hesabı üretir ve ilk şube/sezon/depo/kasa verisini başlatır.
- Kullanıcı A, kullanıcı B'nin firmasına ait hiçbir kayıt, API sonucu veya server action sonucuna erişemez.
- Yetkisiz kullanıcı hem kullanıcı arayüzünde hem doğrudan server action/API çağrısında `403` alır.
- Onay/iptal/devir/iade işlemleri yalnız uygun izinle çalışır, atomiktir ve audit kaydı içerir.
- `pnpm lint`, `pnpm typecheck`, birim/entegrasyon testleri, Playwright kritik akışı ve üretim build'i CI'da geçer.

## Task 1: Çalışma ortamını ve kalite kapısını sabitle

**Files:**
- Modify: `package.json`
- Modify: `pnpm-workspace.yaml`
- Create: `.nvmrc`
- Create: `.env.example`
- Create: `.github/workflows/ci.yml`
- Modify: `README.md`

**Step 1: Başarısız kalite komutlarını yeniden üret**

Run: `node_modules/.bin/tsc --noEmit; node_modules/.bin/eslint .`

Expected: TypeScript geçer; ESLint mevcut 6 hata nedeniyle başarısız olur. Bu durum baseline olarak PR'a yazılır.

**Step 2: Toolchain ve scriptleri tanımla**

`package.json` içine Node ve pnpm sürüm pin'i, `typecheck`, `test`, `test:watch`, `test:e2e` scriptleri eklenir. `pnpm.onlyBuiltDependencies` güncel pnpm ayar biçimine taşınır. `.env.example` yalnız değişken adları ve güvenli yer tutucular içerir; gerçek parola eklenmez.

**Step 3: Lint hatalarını düzelt**

Mevcut ESLint hataları `src/app/arama/page.tsx:39`, `src/components/bottom-nav.tsx:29`, `src/components/desktop/desktop-context.tsx:212`, `src/components/desktop/wallpaper-context.tsx:83`, `src/lib/actions/alim.ts:174`, `src/lib/ayar-store.tsx:83` için minimal, davranışı değiştirmeyen düzeltmeler yapılır.

**Step 4: CI oluştur**

CI sırası: `pnpm install --frozen-lockfile`, `pnpm prisma generate`, `pnpm lint`, `pnpm typecheck`, PostgreSQL servisli test, `pnpm test`, `pnpm build`. E2E ayrı job olarak test veritabanında çalışır.

**Step 5: Doğrula ve commit et**

Run: `pnpm lint && pnpm typecheck && pnpm build`

Expected: sıfır ESLint hatası, sıfır tip hatası ve başarılı build.

Commit: `chore: establish reproducible quality gates`

## Task 2: Tenant, platform yöneticisi, rol ve audit veri modelini tasarla

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_multitenant_auth_rbac/migration.sql`
- Modify: `prisma/seed.ts`
- Create: `src/lib/authorization/permissions.ts`
- Test: `tests/unit/authorization/permissions.test.ts`

**Step 1: Başarısız izin çözümleme testlerini yaz**

Testler şunları kapsar: firma sahibinin tüm izinleri; muhasebe rolünün yalnız atanan izinleri; pasif kullanıcı/rolün erişememesi; platform yöneticisinin firma işletim izni taşımaması.

**Step 2: Rol enumunu veri-temelli RBAC ile değiştir**

`Rol` enumu yerine şu modeller eklenir: `PlatformYonetici`, `RolTanim`, `Modul`, `Izin`, `RolIzni`, `KullaniciRol`, `Oturum`, `AuditLog`.

- `RolTanim.firmaId` zorunludur; her firma kendi rollerini oluşturabilir.
- `Modul` ve eylem izinleri sistem tanımıdır: `GORUNTULE`, `OLUSTUR`, `GUNCELLE`, `ONAYLA`, `IPTAL`, `YONET`.
- `Kullanici` kimlik için benzersiz e-posta/kullanıcı adı, `passwordHash`, aktiflik ve firma ilişkisini taşır; parola/PIN düz metin saklanmaz.
- `Firma`ya `adres`, `telefon`, `aktif` alanları; firma sahibi oluşturma için geçerli vergi/TCKN doğrulama alanları eklenir.
- `AuditLog`da firma, actor, olay türü, varlık tipi/id, önceki/sonraki özet, IP, user-agent ve zaman tutulur; uygulama katmanı için create-only kuralı kurulur.

**Step 3: Modül ve başlangıç rollerini seed et**

Modüller: dashboard, cari, alim, randiman, emanet, avans, finans, masraf, stok, satis, sevkiyat, fiyatlar, raporlar, ayarlar. Her modülün eylem izinleri seed edilir. Firma sahibi "tüm izinler", muhasebe sınırlı finans/cari/rapor, saha sınırlı taslak alım/randıman rolü olarak örneklenir.

**Step 4: Testleri geçir**

Run: `pnpm test tests/unit/authorization/permissions.test.ts`

Expected: rol/izin matrisi testleri geçer.

**Step 5: Commit**

Commit: `feat: add tenant RBAC and immutable audit schema`

## Task 3: İlk kurulum ve firma provizyon ekranlarını uygula

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/app/setup/setup-form.tsx`
- Create: `src/app/platform/page.tsx`
- Create: `src/app/platform/firma-form.tsx`
- Create: `src/lib/actions/setup.ts`
- Create: `src/lib/actions/platform.ts`
- Create: `src/lib/validation/setup.ts`
- Modify: `src/middleware.ts`
- Test: `tests/integration/setup/provisioning.test.ts`
- Test: `e2e/setup.spec.ts`

**Step 1: Başarısız provizyon testlerini yaz**

Testler: bootstrap token olmadan kurulum reddedilir; token ile yalnız ilk `PlatformYonetici` oluşur; aynı token yeniden ilk-kurulum için kullanılamaz; platform yöneticisi firma + sahibi + varsayılan verileri atomik açar; eksik adres/telefon/vergi bilgisi reddedilir.

**Step 2: Bootstrap akışını uygula**

`/setup` yalnız platform yöneticisi yokken ve server tarafında bootstrap token doğrulanınca gösterilir. Başarıdan sonra token tekrar kullanılmaz; ilk yöneticinin parolası Argon2id ile hashlenir. Rate-limit ve generic hata mesajları kullanılır.

**Step 3: Platform yönetimi uygula**

`/platform` sadece doğrulanmış platform yöneticisine açıktır. Firma oluşturma transaction'ı şunları tek seferde yaratır: Firma, firma sahibi kullanıcı/rolü, aktif sezon, varsayılan şube, depo ve gerekli kasa/banka başlangıç hesabı. Audit olayı yazılır.

**Step 4: E2E doğrulaması**

Run: `pnpm test tests/integration/setup/provisioning.test.ts && pnpm test:e2e e2e/setup.spec.ts`

Expected: platform yöneticisi oluşturma ve firma açma akışı tamamlanır; normal kullanıcı `/platform` erişiminde reddedilir.

**Step 5: Commit**

Commit: `feat: add protected installation and tenant provisioning`

## Task 4: Oturum, tenant sınırı ve izin kapısını tüm backend'e uygula

**Files:**
- Replace: `src/lib/auth.ts`
- Create: `src/lib/authorization/require-permission.ts`
- Create: `src/lib/audit.ts`
- Modify: `src/middleware.ts`
- Modify: `src/app/api/cari-ara/route.ts`
- Modify: `src/lib/queries.ts`
- Modify: `src/lib/actions/*.ts`
- Test: `tests/integration/authorization/tenant-isolation.test.ts`
- Test: `tests/integration/authorization/action-permissions.test.ts`

**Step 1: Başarısız izolasyon testini yaz**

İki firma, iki kullanıcı ve aynı isimde cari oluşturulur. Firma A oturumuyla Firma B cari/fiş/hareket kimliği sorgulandığında `404`/`403` döndüğü doğrulanır. Firma kimliği form gövdesinden gönderilse bile yok sayılır.

**Step 2: Oturum servislerini uygula**

Güvenli, `httpOnly`, `secure`, `sameSite=lax` cookie kullanan oturum oluşturma/sonlandırma uygulanır. `getCurrentFirma()` ilk firma sorgusunu bırakır; yalnız oturum bağlamındaki firma kimliğini verir. Platform oturumları firma oturumlarından ayrı tutulur.

**Step 3: Merkezi guard uygula**

`requirePermission(module, action)` oturum, aktif kullanıcı, aktif firma, rol ve izin kontrolü yapar. Her query ve server action ilk satırda bu guardı çağırır; tüm Prisma `where` koşullarında firma bağı bulunur. `/api` rotaları middleware istisnası olmaktan çıkar veya route içinde aynı korumayı zorunlu uygular.

**Step 4: Audit yazımını bağla**

Yetki değişimi, oturum, firma oluşturma, fiş oluşturma/onay/iptal, emanet iade/devir, satış ve sevkiyat durum değişimi `writeAudit()` ile transaction içinde kaydedilir. Gizli alanlar (parola hash, token) audit payload'a asla eklenmez.

**Step 5: Doğrula ve commit et**

Run: `pnpm test tests/integration/authorization`

Expected: tenant kaçışı ve doğrudan action çağrısı engellenir; yetkili kullanıcı işlemi tamamlar ve audit kaydı oluşur.

Commit: `feat: enforce session based tenant permissions`

## Task 5: Rol ve modül yetkilendirme arayüzünü bitir

**Files:**
- Modify: `src/app/ayarlar/page.tsx`
- Modify: `src/app/ayarlar/ayar-icerik.tsx`
- Create: `src/components/ayar/rol-tanim.tsx`
- Create: `src/components/ayar/izin-matrisi.tsx`
- Modify: `src/components/ayar/kullanici-tanim.tsx`
- Create: `src/lib/actions/roller.ts`
- Test: `e2e/roles-and-permissions.spec.ts`

**Step 1: Başarısız e2e testi yaz**

Firma sahibi "Muhasebeci" rolünü oluşturur, finans görüntüleme/oluşturma verir ama alım onayı vermez; kullanıcıya rolü atar; kullanıcının finans ekranına girdiği ancak alım onayına erişemediği doğrulanır.

**Step 2: Rol matrisi uygula**

Firma ayarlarında role ad/aktiflik, modül satırları ve eylem sütunlarından oluşan izin matrisi oluşturulur. Rol silme yerine pasifleştirme uygulanır; ilişkili kullanıcılar için güvenli geçiş uyarısı gösterilir.

**Step 3: Kullanıcı atamayı uygula**

Kullanıcı ekranı, birden çok rol atamayı, aktif/pasif kullanıcıyı ve şifre sıfırlama başlatmayı destekler. Platform yöneticisi günlük işlem menülerinde görünmez.

**Step 4: Doğrula ve commit et**

Run: `pnpm test:e2e e2e/roles-and-permissions.spec.ts`

Expected: rol değişikliği anında sonraki isteklerde uygulanır ve audit kaydı oluşur.

Commit: `feat: add module permission management UI`

## Task 6: Onay, iptal ve sevkiyat durum akışlarını arayüze bağla

**Files:**
- Modify: `src/app/alim/page.tsx`
- Modify: `src/app/satis/page.tsx`
- Modify: `src/app/sevkiyat/page.tsx`
- Create: `src/components/onay-iptal-kontrolleri.tsx`
- Modify: `src/lib/actions/alim.ts`
- Modify: `src/lib/actions/satis.ts`
- Modify: `src/lib/actions/sevkiyat.ts`
- Test: `tests/integration/workflows/approval-flow.test.ts`
- Test: `e2e/approval-flow.spec.ts`

**Step 1: Başarısız iş akışı testini yaz**

Taslak alım/satışın stok ve deftere etkisi olmadığı; sadece `ONAYLA` izniyle onaylandığı; iptalin ters hareketle yapıldığı; sevkiyatın yalnız izinli durum geçişleriyle ilerlediği test edilir.

**Step 2: Yetkili kontrol düğmelerini ekle**

Liste ve detay ekranlarına durum rozeti, onay, iptal ve sevkiyat geçiş kontrolleri eklenir. Buton görünürlüğü izin matrisinden gelir; server action yine bağımsız kontrol yapar.

**Step 3: Atomiklik ve audit'i doğrula**

Her onay/iptal/durum geçişi transaction ile defter-stok-audit yazımını birlikte tamamlar veya tamamını geri alır. Çifte tıklama/idempotency kontrolü eklenir.

**Step 4: Doğrula ve commit et**

Run: `pnpm test tests/integration/workflows/approval-flow.test.ts && pnpm test:e2e e2e/approval-flow.spec.ts`

Expected: taslakların mali etkisi yoktur, geçersiz geçişler reddedilir.

Commit: `feat: complete authorised approval workflows`

## Task 7: Emanet iade ve sezon devir akışını tamamla

**Files:**
- Modify: `src/app/emanet/page.tsx`
- Modify: `src/components/emanet-boz.tsx`
- Create: `src/components/emanet-iade.tsx`
- Create: `src/components/emanet-sezon-devir.tsx`
- Modify: `src/lib/actions/emanet.ts`
- Test: `tests/integration/workflows/emanet-lifecycle.test.ts`
- Test: `e2e/emanet-lifecycle.spec.ts`

**Step 1: Başarısız lifecycle testlerini yaz**

Kısmi/tam iade; yetersiz kg iadesinin reddi; eski sezona devirde eski emanetin kapatılması, yeni sezonda aynı kalan kg ile kayıt açılması; cari kg/stok mülkiyetinin korunması; tümü için audit doğrulanır.

**Step 2: Formları ve izinleri ekle**

Emanet detayında Boz, İade ve Eski Sezona Devret eylemleri görünür. İade `EMANET_IADE`, devir `EMANET_DEVIR` izinleriyle korunan ayrı eylemlerdir; kullanıcı açık sonuç özetiyle onay verir.

**Step 3: Veri bütünlüğünü koru**

İade ve devir, negatif emanet bakiyesini engelleyen aynı transaction içinde emanet hareketi, stok hareketi, cari hareketi ve audit kaydını günceller. Devir kaynak/hedef sezonu açıkça saklar.

**Step 4: Doğrula ve commit et**

Run: `pnpm test tests/integration/workflows/emanet-lifecycle.test.ts && pnpm test:e2e e2e/emanet-lifecycle.spec.ts`

Expected: kg ve mülkiyet mutabakatı her senaryoda sıfır fark verir.

Commit: `feat: complete emanet return and season rollover`

## Task 8: Gerçek PWA/offline kuyruk ve güvenli senkronizasyonu uygula

**Files:**
- Modify: `src/app/manifest.ts`
- Create: `public/sw.js`
- Create: `src/components/service-worker-register.tsx`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/offline/queue.ts`
- Create: `src/lib/offline/idempotency.ts`
- Create: `src/app/api/sync/route.ts`
- Modify: `src/lib/actions/alim.ts`
- Test: `tests/integration/offline/sync.test.ts`
- Test: `e2e/offline-draft-sync.spec.ts`

**Step 1: Başarısız offline testini yaz**

Bağlantı kesikken taslak alımın IndexedDB kuyruğuna yazıldığı; aynı `offlineId` iki kez gönderildiğinde tek kayıt oluştuğu; çevrimiçi olunca taslağın kullanıcı yetkisiyle sunucuya gittiği; yetki kaybında senkronun durup kullanıcıya açıklama verdiği test edilir.

**Step 2: Service worker'ı sınırlı ve sürümlü uygula**

Uygulama kabuğu/versioned statik varlıklar cache-first; navigasyon ve API istekleri network-first uygulanır. Finansal canlı veri kalıcı cache'e alınmaz. Yeni service worker sürümü kullanıcıyı kontrollü yenilemeye yönlendirir.

**Step 3: Kuyruk ve sync endpoint'i uygula**

İlk kapsam yalnız TASLAK alım ile başlar; onay, ödeme, iptal, stok çıkışı çevrimdışı desteklenmez. Kuyruk payload'ı şemayla doğrulanır, `offlineId` ile dedupe edilir, oturum+izin+tenant guard üzerinden işlenir ve audit kaydı oluşturur.

**Step 4: Uçtan uca doğrula**

Run: `pnpm test tests/integration/offline/sync.test.ts && pnpm test:e2e e2e/offline-draft-sync.spec.ts`

Expected: offline taslak tek kez eşitlenir; auth/tenant hatası veri sızıntısına yol açmaz.

**Step 5: Commit**

Commit: `feat: add safe offline draft queue and sync`

## Task 9: Operasyonel teslim ve canlıya çıkış kontrolü

**Files:**
- Create: `docs/runbooks/backup-restore.md`
- Create: `docs/runbooks/incident-and-access.md`
- Create: `docs/security-model.md`
- Modify: `README.md`
- Modify: `FILBERT_MVP_VERI_MODELI.md`
- Test: `tests/integration/audit/audit-immutability.test.ts`

**Step 1: Backup/restore tatbikatını tanımla ve test et**

PostgreSQL günlük yedek, şifreli saklama, saklama süresi ve ayrı ortamda geri yükleme prosedürü yazılır. Restore edilen veride firma, defter ve audit sayıları mutabakat testiyle doğrulanır.

**Step 2: Güvenlik ve erişim runbook'unu yaz**

Platform yöneticisi erişim kaybı, kullanıcı pasifleştirme, rol geri alma, parola sıfırlama, secret rotation ve şüpheli erişim/audit inceleme prosedürleri eklenir.

**Step 3: Dokümantasyonu gerçek davranışla eşitle**

README portlarını scriptlerle uyumlu yapar; yerel DB parolasını kaldırır; dahil olmayan özellikleri "planlanmıyor" veya "sonraki faz" olarak doğru sınıflandırır. Veri modeli RBAC, audit ve offline tasarımıyla güncellenir.

**Step 4: Yayın adayını doğrula**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`

Expected: tüm kalite kapıları geçer; iki farklı firma ile tenant izolasyonu, firma sahibi/muhasebe/saha izinleri, onay, emanet devir/iade, audit ve offline taslak senaryoları kabul edilir.

**Step 5: Commit**

Commit: `docs: add production readiness runbooks`

## Uygulama sırası ve risk kapıları

1. Task 1-4 tamamlanmadan finansal modüllerde yeni özellik geliştirilmez; kimlik ve tenant sınırı önce gelir.
2. Task 5-7, yetki guardlarıyla çalışır; UI kontrolü tek başına güvenlik sayılmaz.
3. Task 8 yalnız online iş akışları ve testler kararlı olduktan sonra başlar; offline kapsam taslak alımla sınırlı tutulur.
4. Task 9 kabul edilmeden Akaydın Tarım gerçek verisiyle üretim kullanımı başlatılmaz.

## Kapsam dışı kayıt

Bu plan otomatik fiyat scraping, e-Müstahsil/e-Belge, çek-senet ve SMS/dekont alanlarını içermez. Sesli not/komut için sonraki kabul edilen offline-ses planı uygulanmıştır; finansal kayıt yaratımı daima kullanıcı onayı gerektirir.
