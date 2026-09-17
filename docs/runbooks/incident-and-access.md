# Erişim ve olay müdahalesi

## Kullanıcı erişimi

- Kullanıcıyı pasifleştirmek için **Ayarlar → Tanımlar → Kullanıcılar** ekranındaki aktiflik kontrolü kullanılır.
- Kullanıcı parolası aynı ekrandan yenilenir. Yenileme sonrasında kullanıcının mevcut oturumları iptal edilir.
- Rol izinleri **Ayarlar → Rol ve yetki yönetimi** ekranından güncellenir. Rol pasifleştirme, aktif bir kullanıcıyı izinsiz bırakacaksa engellenir.
- Firma Sahibi sistem rolü pasifleştirilemez.

## Platform yöneticisi erişim kaybı

`SYSTEM_ADMIN_MAIL`, `SYSTEM_ADMIN_PASS` ve `SYSTEM_MAIN_PASS` yalnız güvenli ortam değişkenlerinden okunur. Erişim kaybında ilgili gizli değer güvenli secret kasasından döndürülür, ortam değişkeni yenilenir ve uygulama yeniden başlatılır. Gerçek değerler destek kaydına, kaynak koda veya istemciye yazılmaz.

## Şüpheli erişim

1. İlgili kullanıcıyı pasifleştirin ve gerekirse rolünü geri alın.
2. Kullanıcının parolasını yenileyerek tüm açık oturumlarını sonlandırın.
3. **Ayarlar → Veri kurtarma** ve audit kayıtlarından olay zaman aralığını inceleyin.
4. Platform yöneticisi parolası veya kurulum sırrının etkilendiği şüphesinde environment secret'larını değiştirin, uygulamayı yeniden başlatın ve erişim kayıtlarını tekrar inceleyin.

## Kapsam

Audit kayıtları PostgreSQL tetikleyicisiyle değiştirilmez veya silinmez. Finansal hareketlerde düzeltme yalnız iptal/ters kayıt yoluyla yapılır; doğrudan veritabanı güncellemesi olay müdahalesi dışında yasaktır.
