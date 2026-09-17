# Filbert — Fındığın Dijital Aklı 🌰

Fındık tüccarları için saha odaklı ticaret ve ön muhasebe uygulaması.
**Pilot:** Akaydın Tarım (Hendek/Sakarya)

## Teknoloji

- **Next.js 16** (App Router, Turbopack) + **TypeScript**
- **PostgreSQL 17** + **Prisma 7** (pg driver adapter)
- **PWA** (manifest + portrait standalone)
- **Tailwind CSS v4** + **shadcn/ui** (radix)
- Server Actions + Prisma transaction'ları (defter bütünlüğü)

## Kurulum

```bash
# 1. Bağımlılıklar
pnpm install

# 2. Ortam değişkenleri
cp .env.example .env
# .env içindeki DATABASE_URL değerini yerel PostgreSQL bilgilerinizle güncelleyin.

# 3. Veritabanı (ilk kurulumda — boş başlar, seed kullanılmaz)
pnpm prisma migrate deploy

# 4. Geliştirme
pnpm dev                   # http://localhost:3066

# 5. Üretim
pnpm build && pnpm start   # http://localhost:3066
```

Üretim dağıtımı Docker Compose ile yapılır; ayrıntılar için
[Coolify ile üretim dağıtımı](docs/runbooks/deployment-coolify.md) runbook'una bakın.

Yerel ve üretim veritabanı parolaları yalnızca `.env` içinde tutulur; örnek dosyaya gerçek parola yazılmaz.

Kalite kontrolleri için `pnpm check`, yalnızca birim testleri için `pnpm test` komutunu çalıştırın.

## Kapsam (MVP v0.1)

| Modül | Durum |
|---|---|
| Dashboard (günlük özet + 6 hızlı işlem + Fiyat Radar şeridi) | ✅ |
| Alım fişi (randımanlı/randımansız, sonradan randıman, çuval darası, emanete alım) | ✅ |
| Randıman motoru (numune→puan, günlük tablo + puan çarpanı, canlı hesap) | ✅ |
| Emanet (giriş, kısmi/tam bozma, stok mülkiyet dönüşümü) | ✅ |
| Avans (nakit/ayni/fındık karşılığı, döviz/altın, alımda otomatik mahsup önerisi) | ✅ |
| Avans fırsat maliyeti (Ziraat tüketici kredisi oranıyla, bilgi amaçlı) | ✅ |
| Cari (çoklu bakiye: TL/USD/EUR/XAU/FINDIK_KG, hareket geçmişi) | ✅ |
| Ödeme/tahsilat (kasa/banka, çoklu para birimi) | ✅ |
| Masraf (nakliye/kantar/hamaliye..., maliyete yansıtma) | ✅ |
| Fiyat Radar basit (Düzce TB, Sakarya TB, TMO, özel kaynak; manuel giriş) | ✅ |
| Günlük fiyat tablosu + kur takibi | ✅ |
| Günlük rapor (tarih bazlı özet) | ✅ |
| Otomatik fiyat çekme | Kapsam dışı — yalnız manuel giriş |
| e-Müstahsil / e-belge | Kapsam dışı |
| Sevkiyat/satış | ✅ |
| Kurulum, çok-firma, rol/izin, onay, audit ve veri kurtarma | ✅ |
| Sesli not, sesli finans taslağı ve HF müşteri/bakiye yardımcısı | ✅ |
| Çek/senet, SMS ve dekont | Kapsam dışı |

## Mimari Kurallar

1. **Defter tek gerçek:** tüm finansal olaylar `CariHareket`'te; bakiye = ΣALACAK − ΣBORC (bakiye_turu bazında). Bakiye asla elle yazılmaz.
2. **Taslak→Onay:** ONAYLI olmayan fiş deftere/stoğa işlemez.
3. **Deterministik hesap:** `tutar = netKg × birimFiyat`, `netKg = brüt − dara` — sunucuda doğrulanır (`src/lib/hesap.ts`).
4. **Emanet çift mülkiyet:** stoktaki fındık `KENDI` veya `EMANET`; bozma = kg borcu→TL borcu + mülkiyet dönüşümü.
5. **Fiyat verisi bilgi amaçlıdır** — hiçbir finansal hesaba otomatik yansımaz.

## Yapı

```
prisma/schema.prisma   # Veri modeli
src/lib/db.ts          # Prisma singleton
src/lib/hesap.ts       # Kural motoru (randıman, fiyat, tutar, avans maliyeti)
src/lib/queries.ts     # Okuma sorguları (bakiye, dashboard, rapor)
src/lib/actions/       # Server actions (alim, emanet, avans, finans, masraf, fiyat)
src/app/               # Sayfalar (mobil-first, bottom nav + FAB)
src/components/        # UI (saha modu: min 56px dokunma hedefleri)
```

## Tasarım Notları (saha modu)

- Min 56px dokunma hedefleri, büyük sayısal inputlar (`inputMode=decimal`, tr-TR virgül desteği)
- Animasyon: sadece 160ms basma geri bildirimi (günde onlarca kullanım → süsleme yok)
- `prefers-reduced-motion` ve hover-gating uygulandı
- Logo: `public/logo.png` (gerçek logo; `logo.svg` geçici vektör versiyon)

## Bilinen Sınırlar (MVP)

- Fiyatlar yalnız manuel girilir; otomatik fiyat çekme kapsam dışıdır.
- Ses tanıma, cihazın tarayıcı desteğine bağlıdır; HF modu yalnız düğmeyle başlar ve arka planda dinlemez.
- Sesli finans notları otomatik muhasebe kaydına dönüşmez; yetkili incelemesi ve onayı gerekir.
- Offline kuyruk şu anda sesli not taslaklarıyla sınırlıdır; finans, stok ve defter hareketleri bağlantı varken yapılır.
- Çek/senet, SMS, dekont/e-belge ve sağlık verisi modülleri bu MVP kapsamına alınmamıştır.

## Operasyon

- [Coolify ile üretim dağıtımı](docs/runbooks/deployment-coolify.md)
- [Yedekleme ve geri yükleme](docs/runbooks/backup-restore.md)
- [Erişim ve olay müdahalesi](docs/runbooks/incident-and-access.md)
- [Güvenlik modeli](docs/security-model.md)

## Dokümanlar (D:\FILBERT)

- `FILBERT_PROJE_RAPORU.md` — PRD + karar defteri (9 karar)
- `FILBERT_MVP_VERI_MODELI.md` — veri modeli referansı
- `PRONUT_ANALIZ.md` — rakip analizi
