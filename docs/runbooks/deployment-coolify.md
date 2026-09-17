# Coolify ile üretim dağıtımı

Filbert, Coolify üzerinde **tek proje** içinde iki kalıcı konteyner olarak yayınlanır. İlk dağıtımda veritabanı, tablolar, indeksler ve kısıtlar kendiliğinden kurulur; elle SQL çalıştırılmaz.

Yayın adresi: `https://akaydin.erkanerdem.online`

## Topoloji

| Servis | Kaynak | Görev |
|---|---|---|
| `db` | `postgres:17-alpine` | Kalıcı veri (`filbert-db-data` hacmi) |
| `migrate` | `Dockerfile` → `migrator` | Tek seferlik `prisma migrate deploy` |
| `app` | `Dockerfile` → `runner` | Next.js 16 standalone sunucusu, konteyner içi port `3066` |

Başlatma sırası `docker-compose.yaml` içinde zorlanır: **db sağlıklı → migrate başarıyla biter → app ayağa kalkar.** Bu sayede uygulama, şeması hazır olmayan bir veritabanına hiçbir zaman bağlanmaz.

`app` dışarıya `ports:` ile açılmaz; alan adı yönlendirmesi Coolify proxy'si üzerinden yapılır. Yayınlanan bir ana makine portu bu yönlendirmeyi devre dışı bırakırdı.

## 1. Ön koşullar

1. `akaydin.erkanerdem.online` için A kaydı Coolify sunucusunun IP adresine yönlendirilmiş olmalı.
2. Kod GitHub deposunda olmalı — Coolify imajı bu depodan derler.
3. Coolify'da en az bir sunucu ve destination tanımlı olmalı.
4. İmaj tabanı **Node 24 LTS**'tir. Bu zorunludur: pnpm 11, yalnızca Node 22.5+ ile gelen `node:sqlite` yerleşik modülünü kullanır ve en az Node 22.13 ister; Prisma 7 ise `>=24.0` bildirir. Node 20 tabanlı bir imajda `pnpm install` şu hatayla çöker: `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite`. Depodaki `.nvmrc` ve Dockerfile bu sürümü birlikte sabitler.

## 2. Coolify kaynağını oluşturma

1. Hedef proje ve ortamda **+ New → Git repository** seçin.
2. **Configuration → General** altında:
   - **Build Pack**: `Docker Compose`
   - **Base Directory**: `/`
   - **Docker Compose Location**: `/docker-compose.yaml`
3. **Configuration → Advanced** altında **Inject Build Args to Dockerfile** seçeneğini **kapatın**.

   Bu ayar açıkken Coolify, ortam değişkenlerini Dockerfile'a `ARG` olarak enjekte eder ve derlemeye `--build-arg SYSTEM_ADMIN_PASS --build-arg SERVICE_PASSWORD_64_DB ...` şeklinde geçirir. Dağıtım günlüğünde `Added 50 ARG declarations to Dockerfile` satırı bunun işaretidir. Uygulama bu değerleri derleme sırasında kullanmadığı için enjeksiyonun hiçbir faydası yoktur; buna karşılık veritabanı ve yönetici parolaları imaj derleme meta verisine sızabilir.

4. Kaydedin ve **Docker Compose Content** alanında üç servisin de göründüğünü doğrulayın.

## 3. Alan adı

`docker-compose.yaml` içinde `app` servisinin ortam değişkenleri arasında şu satır bulunur:

```yaml
SERVICE_FQDN_APP_3066: ${SERVICE_FQDN_APP_3066:-akaydin.erkanerdem.online}
```

Coolify bu değişkeni **Environment Variables** ekranında oluşturur ve değerini alan adı olarak kullanır. İsmin sonundaki `_3066` eki, proxy'nin konteyner içindeki `3066` portuna yönlendirme yapmasını söyler. Değer değiştirilecekse yalnızca burada değiştirilmelidir.

Eşdeğer yol: `app` servisinin **Domains** alanına `https://akaydin.erkanerdem.online:3066` yazmak. İki yeri aynı anda farklı değerlerle doldurmayın.

## 4. Ortam değişkenleri

| Değişken | Durum | Açıklama |
|---|---|---|
| `SERVICE_PASSWORD_64_DB` | Coolify üretir | PostgreSQL parolası. İlk dağıtımda üretilir, sonraki dağıtımlarda korunur. `DATABASE_URL` bu değerden türetildiği için ayrıca girilmez. |
| `SYSTEM_ADMIN_MAIL` | **zorunlu** | Sistem yöneticisi hesabının e-postası. `/giris` ekranında kullanılır. |
| `SYSTEM_ADMIN_PASS` | **zorunlu** | Sistem yöneticisi parolası. |
| `SYSTEM_MAIN_PASS` | ilk kurulum için **zorunlu** | Yalnızca `/setup` ekranını açan kurulum parolası. Kurulum tamamlandıktan sonra boşaltılabilir. |
| `SERVICE_FQDN_APP_3066` | ön tanımlı | Yayın alan adı. |

**Parola kuralı:** `SYSTEM_ADMIN_PASS` ve `SYSTEM_MAIN_PASS` en az 6 karakter olmalı ve en az bir harf ile bir rakam içermelidir. İkisi birbirinden farklı olmalıdır; `SYSTEM_MAIN_PASS` yalnızca ilk kurulum içindir.

`SERVICE_PASSWORD_64_DB` değeri `DATABASE_URL` içine gömülür. Coolify'ın bu üreteci simgesiz (alfanümerik) parola ürettiği için adres içinde ayrıca yüzde kodlaması gerekmez. Parolayı elle değiştirecekseniz `@ : / ? #` gibi karakterlerden kaçının.

## 5. İlk dağıtım

1. **Deploy** düğmesine basın.
2. **Deployments** ekranında sırayı doğrulayın:
   - `db` `healthy` durumuna geçer,
   - `migrate` konteyneri `All migrations have been successfully applied` mesajıyla `exit 0` yapar,
   - `app` başlar ve sağlık denetimini geçer.
3. `migrate` başarısız olursa `app` bilinçli olarak başlamaz. Bu durumda günlüklerdeki Prisma hatasını giderip yeniden dağıtın.

### Şema gerçekten kuruldu mu?

Coolify'ın `db` servisi terminalinde:

```sql
-- tablolar
\dt

-- indeksler
\di

-- uygulanan migration geçmişi
SELECT migration_name, finished_at FROM "_prisma_migrations" ORDER BY finished_at;
```

`prisma/migrations` klasöründeki 24 migration'ın tamamı son satırlarda görünmelidir.

## 6. İlk kurulum (uygulama içi)

1. `https://akaydin.erkanerdem.online/giris` adresini açın.
2. `SYSTEM_ADMIN_MAIL` ve `SYSTEM_ADMIN_PASS` ile giriş yapın. Kayıtlı bir sistem yöneticisi olmadığı için oturum doğrudan `/setup` ekranına yönlenir.
3. `/setup` ekranında `SYSTEM_MAIN_PASS` değerini ve yönetici parolasını girin; firma bilgilerini tamamlayın.

> **10 dakikalık pencere:** `/setup` yetkisi girişten sonra 10 dakika geçerlidir. Süre dolarsa kurulum reddedilir; çıkış yapıp yeniden giriş yapmanız yeterlidir.

Kurulum tamamlandığında `UygulamaKurulumu` kaydı oluşur ve `/setup` bir daha çalıştırılamaz. Bu andan sonra `SYSTEM_MAIN_PASS` değerini boşaltabilirsiniz.

## 7. Yayın sonrası doğrulama

```bash
curl -fsS https://akaydin.erkanerdem.online/api/health
# {"durum":"saglikli","veritabani":"bagli"}
```

Bu uç nokta hem sunucunun ayakta olduğunu hem de veritabanına sorgu atılabildiğini doğrular; Coolify'ın konteyner sağlık denetimi de aynı adresi kullanır.

Ardından `/giris` üzerinden giriş yapıp dashboard, cari ve stok ekranlarını açarak işlevsel kontrol yapın.

## 8. Güncelleme akışı

`main` dalına yapılan her push Coolify webhook'unu tetikler ve sırayı baştan işletir: yeni imaj derlenir → `migrate` bekleyen migration'ları uygular (uygulanmış olanlara dokunmaz) → `app` yeni imajla değiştirilir.

`filbert-db-data` hacmi normal dağıtımlarda silinmez; veriler korunur.

## 9. Yedekleme

Veri `filbert-db-data` hacminde tutulur. `db` servisi terminalinde:

```bash
pg_dump -U filbert -d filbert --format=custom --no-owner --file /tmp/filbert-$(date +%Y%m%d).dump
```

Ayrıntılı saklama ve geri yükleme tatbikatı için [Yedekleme ve geri yükleme](backup-restore.md).

## 10. Sorun giderme

| Belirti | Olası neden ve çözüm |
|---|---|
| Derleme `pnpm install` adımında `ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: node:sqlite` ile duruyor | Dockerfile tabanı Node 20 kalmış. `FROM node:24-bookworm-slim` olmalı; pnpm 11 en az Node 22.13 ister. (`warn: This version of pnpm requires at least Node.js v22.13` satırı da aynı sorunu gösterir.) |
| Derleme günlüğünde `Added N ARG declarations to Dockerfile` görünüyor | **Inject Build Args to Dockerfile** açık. Coolify ortam değişkenlerini derleme argümanı olarak geçiriyor. Bölüm 2.3'teki gibi kapatın. |
| Tarayıcıda `No available server` | `app` sağlık denetimini geçemiyor. `Deployments → Logs` ve `/api/health` yanıtına bakın. Alan adı `_3066` port ekiyle tanımlı olmalı. |
| `/api/health` `503` döndürüyor | Uygulama ayakta ama veritabanına erişemiyor. `DATABASE_URL` içindeki parolanın `SERVICE_PASSWORD_64_DB` ile aynı olduğunu ve `db` konteynerinin `healthy` olduğunu doğrulayın. |
| `migrate` konteyneri sıfırdan farklı kodla çıkıyor | Günlükteki Prisma hatasına bakın. En sık neden: parola uyuşmazlığı veya `db` henüz `healthy` değilken başlatılması. |
| `/setup` "Kurulum daha önce tamamlanmış" diyor | `UygulamaKurulumu` kaydı zaten var. Yeniden kurulum gerekmiyorsa normaldir; sıfırdan başlanacaksa `filbert-db-data` hacmi bilinçli olarak boşaltılmalıdır. |
| `/setup` "ortam değişkenleri yapılandırılmamış veya zayıf" diyor | `SYSTEM_ADMIN_MAIL`, `SYSTEM_ADMIN_PASS` veya `SYSTEM_MAIN_PASS` eksik ya da parola kuralına uymuyor (en az 6 karakter, harf + rakam). |
| `/setup` yetkisi reddediliyor | 10 dakikalık pencere dolmuş. Çıkış yapıp yeniden girin. |
| Konteyner terminalinde `command not found: psql` | Komutu `db` servisinin terminalinde çalıştırın; `app` imajında PostgreSQL istemcisi yoktur. |
| İlk kurulumdan sonra `SYSTEM_MAIN_PASS` hâlâ zorunlu görünüyor | Coolify değeri boş bırakmanıza izin vermiyorsa değişkeni tamamen silmek yerine değerini rastgele ve uzun bir dizeyle değiştirin. |

## 11. Dış veritabanına geçiş

`db` servisi kaldırılmak istenirse:

1. `app` ve `migrate` servislerindeki `DATABASE_URL` satırını dış veritabanının adresiyle değiştirin; bu durumda `SERVICE_PASSWORD_64_DB` başvurusu kalkar ve parola doğrudan adrese yazılmalıdır (özel karakterler yüzde kodlanmalıdır).
2. `db` servisini ve `depends_on` koşullarını sadeleştirin.
3. Migration'ları bir kez `migrate` servisiyle uygulayın.

## 12. Yerelde deneme

`docker-compose.yaml` doğrudan yerelde de çalıştırılabilir. Proje kökündeki `.env` dosyasına (git'e girmez) şunları ekleyin:

```dotenv
SERVICE_PASSWORD_64_DB=yerel-test-parolasi-123
SYSTEM_ADMIN_MAIL=admin@example.com
SYSTEM_ADMIN_PASS=yerel-admin-parola-123
SYSTEM_MAIN_PASS=yerel-kurulum-parola-123
SERVICE_FQDN_APP_3066=localhost
```

```bash
docker compose up --build
curl -fsS http://localhost:3066/api/health
```

`migrate` servisindeki `exclude_from_hc` anahtarı Coolify'a özgüdür: tek seferlik işlerin genel uygulama sağlığını belirlemesini engeller. Yerel `docker compose` sürümünüz bu anahtarı tanımazsa yalnızca yerel deneme sırasında o satırı kaldırın; Coolify dağıtımı için gerekli olduğundan dosyada kalmalıdır.

İşiniz bittiğinde `docker compose down` çalıştırın. Hacmi de silmek isterseniz `docker compose down -v` kullanın — bu **veritabanını tamamen siler**.
