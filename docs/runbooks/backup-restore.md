# PostgreSQL yedek ve geri yükleme

Filbert veritabanı, uygulama durdurulmadan önce günlük mantıksal yedekle korunur. Yedekler uygulama dizinine veya kaynak kontrole yazılmaz; şifrelenmiş, erişimi sınırlandırılmış bir depolama alanında tutulur.

## Günlük yedek

Sunucuda `DATABASE_URL` tanımlı iken aşağıdaki komut veritabanını özel biçimde dışa aktarır:

```powershell
pg_dump --format=custom --no-owner --file filbert-YYYYMMDD.dump $env:DATABASE_URL
```

Yedek dosyasının SHA-256 özeti ayrıca kaydedilir. Günlük 30, haftalık 12 ve aylık 12 yedek saklanır. Yedeklerin taşıma ve saklama katmanında şifrelenmesi operasyon sorumlusunun zorunluluğundadır.

## Geri yükleme tatbikatı

1. Canlı veritabanına değil, ayrı bir doğrulama veritabanına geri yükleyin.
2. Hedef veritabanını oluşturun; uygulama şemasını aynı sürümde `pnpm prisma migrate deploy` ile kurun.
3. Yedeği geri yükleyin:

```powershell
pg_restore --clean --if-exists --no-owner --dbname $env:FILBERT_RESTORE_DATABASE_URL filbert-YYYYMMDD.dump
```

4. Firma, cari hareket, finans hareket ve audit kayıt adetlerini kaynakla karşılaştırın.
5. Doğrulama ortamında firma sahibi girişi, cari bakiye raporu ve son audit kaydını açarak işlevsel kontrol yapın.
6. Tatbikat sonucunu; tarih, yedek özeti, kaynak/hedef kayıt adetleri ve sorumlu ile kaydedin.

## Uygulama içi veri kurtarma

Operasyon kayıtları silinmez; finansal düzeltmeler ters kayıtla yapılır. Tanım, kullanıcı/rol yetkisi, cari kart, günlük fiyat, kur ve kredi/faiz değişiklikleri için **Ayarlar → Veri kurtarma** ekranı önceki sürümü yeni bir audit kaydıyla geri uygular. Bu ekran yalnız `AYARLAR/YONET` iznine sahip kullanıcılarca kullanılabilir. Audit satırlarının kendisi PostgreSQL seviyesinde değiştirilemez veya silinemez; geri alma her zaman yeni bir audit olayı üretir.
