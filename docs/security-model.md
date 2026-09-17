# Filbert güvenlik modeli

Filbert, firma oturumunu ve platform yöneticisi oturumunu birbirinden ayırır. Uygulama firması kullanıcı girdisinden alınmaz; her sorgu ve server action aktif oturum bağlamındaki firma kimliğini kullanır.

## Kimlik ve oturum

- Parolalar scrypt, rastgele salt ve sabit zamanlı karşılaştırma ile doğrulanır.
- Aynı e-posta için beş başarısız giriş denemesinden sonra 15 dakikalık uygulama içi deneme sınırı uygulanır.
- Oturum token'ının yalnız SHA-256 özeti veritabanında saklanır.
- Cookie `httpOnly`, `sameSite=lax`, üretimde `secure` ve 30 günlük sona erme süresiyle yazılır.
- Parola yenileme, hedef kullanıcının aktif oturumlarını iptal eder.

## Yetkilendirme ve veri sınırı

- İzinler rol → modül → eylem düzeyindedir.
- Server action'lar istemci görünürlüğüne güvenmez; `requirePermission` ile oturum, aktif kullanıcı, aktif firma, rol ve izin denetler.
- Firma dışındaki kayda erişim, sorgu düzeyinde firma ilişkisiyle reddedilir.
- Sistem yöneticisi firma operasyonu izni taşımaz; yalnız kurulum ve firma provizyonu yapar.

## Veri bütünlüğü ve audit

- Finansal işlemler transaction içinde cari/finans/stok hareketi ve audit kaydıyla birlikte işlenir.
- İptal, silme yerine ters kayıt veya durum değişimi üretir.
- Audit girdilerinde parola özeti ve oturum token'ı tutulmaz.
- PostgreSQL tetikleyicisi audit satırlarında `UPDATE` ve `DELETE` işlemlerini reddeder; düzeltmeler yeni audit olayı olarak yazılır.
- Uygulama içi geri yükleme, önceki snapshot'tan kontrollü yeni bir audit olayı oluşturur.

## Çevrimdışı ve ses

Çevrimdışı kuyruk yalnız sesli not taslaklarını destekler. Sunucu payload'ı doğrular, kullanıcının `SESLI_NOT/OLUSTUR` iznini denetler ve `offlineId` ile idempotent kayıt yapar. Sesli finans taslağı, yetkili kullanıcı onaylayana kadar finans defteri oluşturmaz.
