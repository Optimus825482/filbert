# Fındık İşleme Modülü — Kullanım ve Doğrulama Runbook'u

Uygulama iki ana modüle ayrılmıştır:

- **Fındık Alım Modülü** (`/mod/alim`) — mevcut alım fişi, randıman, emanet, virman ve sevkiyat akışı.
- **Fındık İşleme Modülü** (`/mod/islem`) — kırma / kavurma / vakumlu paketleme talebinin
  kaydı, aşama takibi, teslim ve tahsilat akışı.

Masaüstü gezinmede her iki modül ayrı başlık altında gruplanır
(`src/components/masaustu-nav.tsx` → **FINDIK ALIM** / **FINDIK İŞLEME**).

## 1. Modül ayrımı, modül değiştirme ve varsayılan modül

Uygulama iki bağımsız modüle ayrılmıştır ve her modül **yalnızca kendi menü
ögelerini ve fonksiyonlarını** gösterir:

- **Fındık Alım Modülü** (`/mod/alim`) — alım fişi, randıman, emanet, virman,
  sevkiyat, cari, finans ve raporlar. Fındık alınan kişiler bu modülde **müstahsil**
  olarak anılır (`CariKart`, `tur = URETICI`); kenar çubuğundaki ilgili grup
  başlığı bu nedenle "MÜŞTERİ" değil **"CARİ"**'dir ve yalnızca müstahsil, tüccar,
  fabrika kartlarını listeler.
- **Fındık İşleme Modülü** (`/mod/islem`) — talep kaydı, kuyruk, aşama takibi,
  teslim/tahsilat, raporlar ve **kendine ait kasa yönetimi**.

**Pano modüle göre ayrılır:** ana pano (`src/app/page.tsx` → `AnaSayfa`) aktif modülü
`aktifModuluOku()` (`src/lib/aktif-modul.ts`) ile çözer; işleme modülünde
`PanoIsleme` (`src/app/pano-isleme.tsx`) render edilir.

- **İşleme panosu:** yalnızca kırma/kavurma/paketleme talepleri. Üstte altı KPI kartı
  (Bekleyen talep, Üretimde, Bugün tamamlanan, Teslim edilmeyi bekleyen, Mesaj
  gönderilmeyen, Tahsilat bekleyen) her biri ikon, renk ve orana göre dolan ilerleme
  çubuğuyla gösterilir. **Bekleyen talep** kartı adedin yanı sıra bekleyen fındığın
  **toplam kilogramını** yazar; üretim kuyruğu paneli de "Üretimde N talep · X kg"
  biçiminde kg toplamını taşır. Bunun yanında **talep durum dağılımı** halka (donut)
  grafiği, kuyruk aşama dağılımı, **son 7 gün · işleme hareketi** için iki mini çubuk
  grafik (gelen talep · kg ve tamamlanan talep · adet), **Teslimat · hazırlananlar**
  listesi ve son talepler yer alır. Mobilde aynı KPI'lar dört hücreli ızgaraya
  sığdırılır ve durum dağılımı donut'u "BUGÜN" kutusunun altında gösterilir.
- **İşleme panosu hızlı menüleri:** **Yeni Talep** (`/hizmet/yeni`), **Talep Kuyruğu**
  (`/hizmet`), **Teslimat** (`/hizmet?liste=teslimat`) ve **Kasa** (`/hizmet/kasa`).
- **Alım panosu:** yalnızca alım akışıdır (alım fişi, randıman, emanet, depo, sevkiyat).
  İşleme metrikleri, "Fındık İşleme Talebi" kısayolu ve işleme bekleyen satırı burada
  **yer almaz**.

**Modül değiştirme (yalnızca Ayarlar'dan):** modül geçişi bir menü ögesi değildir.

- **Masaüstü:** Sol menüde modül değiştirme düğmesi **yoktur**; menünün altında
  yalnızca **Ayarlar** bağlantısı bulunur. Modül değişimi **Ayarlar → Modül**
  sekmesinden yapılır.
- **Mobil:** Alt (sticky) menü **modüle göre** değişir; en sağındaki **Ayarlar**
  ikonu Ayarlar ekranını açar ve **Modül** sekmesinden aktif modül değiştirilir.
  Böylece mobilde de modül değişimi mümkündür.
  - **Alım modülü:** Ana Sayfa (`/`), Ara (`/arama`), **Sesli modu aç**
    (`/sesli-not`, ortada vurgulu), Ayarlar (`/ayarlar`).
  - **İşleme modülü:** Pano (`/`), Talep Kuyruğu (`/hizmet`), **Yeni Talep**
    (`/hizmet/yeni`, ortada vurgulu), Kasa (`/hizmet/kasa`),
    Ayarlar (`/ayarlar`).
  - **İşleme modülünde eller serbest (sesli not) ögesi yoktur**; sesli akış
    yalnızca alım modülüne aittir.
  - Tek kaynak: `src/lib/modul.ts` → `ALT_MENU_OGELERI` / `altMenuOgeleri()`;
    çizim: `src/components/bottom-nav.tsx`.

**Varsayılan modül (girişte açılacak modül):**

- Kullanıcı bazında `Kullanici.varsayilanModul` alanında saklanır (`ALIM` | `ISLEME`).
- **Kullanıcı oluşturma/düzenleme** ekranında (Ayarlar → Kullanıcılar) seçilir ve
  kaydedilir.
- Kullanıcı **Ayarlar → Modül** sekmesinden kendi varsayılanını güncelleyebilir.
- Giriş yapıldığında bu değer **veritabanından okunur** ve ilgili modülün ana
  ekranı açılır (`girisYap` → `varsayilanModul` → `anaRota`).
- Aktif modül çözümü şu sırayı izler: istek yolundaki `x-filbert-modul` başlığı
  (proxy ekler) → `filbert_modul` çerezi → `Kullanici.varsayilanModul`. Çıkışta
  çerez silinir.

**Menü görünürlüğü tek yerden yönetilir:** `src/lib/modul.ts` içindeki
`NAV_GRUPLARI` + `navGrubuGorunur()`; masaüstü menüsü
(`src/components/masaustu-nav.tsx`) bunu kullanır.

### Kasa ayrımı

- **Kasa** yalnızca Fındık İşleme modülünde yönetilir: **Kasa** ekranı
  (`/hizmet/kasa`). Hesap açma/kapatma ve hareket girişi buradadır; hareketler
  `FinansHareket` olarak yazılır (cari bağlantısı yoktur).
- Alım modülündeki `/kasa` ekranı yalnızca `modul = ALIM` hesaplarını listeler;
  işleme kasası hesapları burada **salt görüntü** olarak ayrı bir bölümde gösterilir
  ve "İşleme modülünde yönet →" bağlantısıyla `/hizmet/kasa` ekranına gidilir.
- Kasa hesapları `KasaHesap.modul` alanıyla ayrışır (`ALIM` | `ISLEME`).

## 2. Talep yaşam döngüsü

| Durum kodu | Ekranda | Anlamı |
| --- | --- | --- |
| `SIRAYA_ALINDI` | Bekliyor | Talep alındı, üretim sırasına girdi |
| `KIRIM` | Kırım | Kırma aşamasında |
| `KAVURMA` | Kavurma | Kavurma aşamasında |
| `PAKETLEME` | Paketleme | Vakumlu paketleme aşamasında |
| `TAMAMLANDI` | Tamamlandı | İş bitti, müşteri teslim almadı |
| `TESLIM_EDILDI` | Teslim Edildi | Müşteriye teslim edildi (tahsilat ile birlikte) |
| `IPTAL` | İptal | Talep iptal edildi |

Her aşamaya geçişte zaman damgası yazılır (`kirimAt`, `kavurmaAt`, `paketlemeAt`,
`tamamlandiAt`, `teslimAt`). Talep satırındaki **aşama ilerlemesi** çipleri
(✓ / ○) hangi işlemin tamamlandığını tek bakışta gösterir.

- Durum değişimi: Talep Kuyruğu → satır içi **Durum** seçicisi veya toplu işlem çubuğu.
- **Kuyruk akışı (hızlı listeler):** **Talep Kuyruğu · Bekleyen** listesinden kayıtlar
  seçilip **Hazırlanıyor Yap** ile işleme alınır (kırım aşaması); **Hazırlanıyor**
  listesinden seçilenler **Tamamlandı Yap** ile bitirilir; tamamlananlar
  **Teslimat · Hazırlanan** listesinde teslim alınmayı bekler.
- `TAMAMLANDI` seçildiğinde kullanıcıya **"SMS gönderilsin mi?"** onay penceresi çıkar;
  onaylanırsa tamamlandı bildirimi gider ve `tamamlandiSmsGonderildi` işaretlenir.
- SMS gönderilmemiş tamamlanmış talepler ayrı listede toplanır
  (`/hizmet?liste=sms` ve hızlı liste düğmesi).

## 3. Yeni talep kaydı ve müşteri önerisi

`/hizmet/yeni` ekranı müşteri adı, telefon, fındık miktarı (kg), yapılacak işler
(Kırma / Kavurma / Vakumlu Paketleme) ve varsa detay/not alanlarını içerir.

Müşteri adı alanına **ilk 4 harf** yazıldığında, kayıtlı **Fındık İşleme müşteri
rehberi** (`Musteri` tablosu) içinden **en yakın 5 kayıt** ad-soyad ve telefon
numarasıyla önerilir. Öneri seçildiğinde ad ve telefon otomatik doldurulur, kayıtlı
müşteri kimliği (`musteriId`) talebe bağlanır
(`src/app/hizmet/yeni/yeni-hizmet-formu.tsx`).

**Müşteri / müstahsil ayrımı (ayrı tablolar):** Fındık İşleme modülünün müşterileri
ayrı bir `Musteri` tablosunda tutulur. Fındık **alınan** kişiler ise müşteri değil
**müstahsil** kabul edilir ve alım/tedarik tarafının `CariKart` tablosunda
(`URETICI` / `TUCCAR` / `FABRIKA`) kalır. İki kayıt kümesi birbirine karışmaz:
talebe kayıtlı müşteri seçilmezse ad + telefon eşleşen müşteri rehberde aranır, yoksa
kendiliğinden açılır (`src/lib/musteri.ts` → `musteriBulVeyaOlustur`). Alım carileri
işleme önerilerinde **hiç görünmez**; `getHizmetFormSecenekleri()` ve
`/hizmet/yeni` yalnızca `prisma.musteri` okur.

Kayıt tamamlandığında müşteriye **"talebiniz alınmıştır"** SMS'i gönderilir
(`otomatikGirisSms` açıkken otomatik, formdaki onay kutusuyla manuel).

## 4. SMS altyapısı ve şablonlar

Sağlayıcı ayarları: **Ayarlar → SMS Ayarları** (`/ayarlar` → SMS sekmesi); ayar
başlığındaki **SMS Merkezi** kısayolu izleme ekranını açar. Desteklenen sağlayıcılar:
`NETGSM`, `ILETIMERKEZI`, `GENERIC_HTTP` ve simülasyon için `TEST`. SMS servisi
kapalı veya `TEST` modundayken gönderim **simüle edilir** (dış sağlayıcıya istek
gitmez, konsola yazılır) ve kayıt `SIMULASYON` durumuyla günlüğe düşer.

### Netgsm (önerilen sağlayıcı)

- REST v2 uçları: gönderim `POST /sms/rest/v2/send`, gönderim raporu
  `POST /sms/rest/v2/report`, bakiye `/balance`. Kimlik doğrulama Basic auth
  (kullanıcı adı/şifre).
- Gönderim gövdesi: `{ msgheader, encoding, iysfilter:"0", appname, messages:[{ msg, no }] }`.
  Numara **10 hane** (`5XXXXXXXXX`) olmalıdır; başında `0` veya `+90` bulunmamalıdır
  (`netgsmNumara`).
- **HTTP 200 dönse bile gerçek sonuç gövdedeki `code` alanındadır**: `00` başarı;
  `20` metin/karakter, `30` kimlik veya IP kısıtı, `40` onaysız başlık, `50`/`51`
  İYS, `70` parametre, `80` hız, `85` aynı numaraya 1 dakikada en fazla 20 görev,
  `100`/`101` sistem hatası. Tam liste: `src/lib/sms/types.ts` →
  `NETGSM_GONDERIM_HATALARI`.
- Teslim raporu `jobs[].status`: `1` iletildi, `2` süresi doldu, `3` geçersiz
  numara, `4` iletilemedi, `11`-`17` reddedildi / İYS hataları
  (`NETGSM_TESLIM_DURUMLARI`).
- **Kodlama** (`kodlama` alanı): `TR` Türkçe karakterleri korur (UCS-2, tek SMS
  sınırı **65** karakter); `ASCII` ş/ğ/ı/ö/ü/ç harflerini sadeleştirir (GSM-7,
  sınır **155** karakter) ve aynı metni daha az krediye böler. Karakter/kredi/parça
  hesabı gönderim öncesi canlı sayılır (`smsParcaHesapla`) ve kayda `parcaSayisi`
  olarak yazılır.
- **Bakiye Sorgula** kalan kontörü, **Başlıkları Getir** onaylı gönderici
  başlıklarını sağlayıcıdan okur.

### Gönderim günlüğü

Her gönderim (kayıt, tamamlandı, teslim hatırlatma, test ve elle gönderimler)
`SmsKaydi` tablosuna yazılır: alıcı, mesaj, tip, sağlayıcı, durum, sağlayıcı iş
kimliği, hata kodu/açıklaması, kredi (parça) sayısı, birim ve toplam maliyet, teslim
kodu ve zamanı. Akış: kayıt **`KUYRUKTA`** açılır → sağlayıcı yanıtına göre
`GONDERILDI` / `HATA` / `SIMULASYON` olur → teslim sorgusuyla `TESLIM_EDILDI`.
Sağlayıcı hatası iş akışını durdurmaz; talep kaydı tamamlanır, hata günlüğe düşer
(`src/lib/sms/sms-servisi.ts`).

Üç şablon vardır (değişkenler: `{musteri_adi}`, `{sira_no}`, `{kilo}`,
`{hizmetler}`, `{tutar}`, `{firma_adi}`):

1. **Kayıt bildirimi** — talep alındığında.
2. **Tamamlandı bildirimi** — iş bittiğinde ("teslim alabilirsiniz").
3. **Teslim hatırlatma** — işi bitmiş ama müşterisi fındığını almamış talepler için;
   Talep Listesi → **Teslimat · Hazırlananlar** listesinden toplu SMS veya satır
   içi yeniden gönderim ile iletilir.

Gönderim sayısı kayıt bazında tutulur (`teslimSmsSayisi`, `teslimSmsAt`) ve talep
satırında "N× teslim bildirimi" olarak görünür; her birinin tek tek gönderim ve teslim
durumu **SMS Merkezi**'nden izlenir.

### SMS Merkezi (`/hizmet/sms`)

**Talep Kuyruğu / Pano → SMS Merkezi** bağıyla açılır (HIZMET/GORUNTULE). Gönderim
akışı talep ekranlarında çalışır; bu ekran izleme içindir:

- **KPI şeridi:** bugün gönderilen, bugün teslim edilen, bugün hatalı, bugün
  harcanan kredi, teslim raporu bekleyen, toplam hatalı ve toplam kayıt.
- **Sağlayıcı şeridi:** aktif sağlayıcı, gönderici başlığı, kodlama ve birim maliyet;
  servis kapalı veya test modundaysa "simülasyon modu" uyarısı.
- **Filtreler:** durum (`KUYRUKTA`/`GONDERILDI`/`TESLIM_EDILDI`/`HATA`/`SIMULASYON`),
  tip (kayıt / tamamlandı / teslim hatırlatma / test / elle) ve ad–telefon–mesaj
  araması.
- **Satır eylemleri:** hatalı ya da simülasyon kayıtlarında **Yeniden gönder**;
  üstteki **Teslim durumlarını sorgula** bekleyen kayıtlar için sağlayıcıdan teslim
  raporunu çeker.
- **Dışa aktarım:** `/api/hizmet/sms/csv`; filtreler korunur, TL maliyet sütunları
  eklenir ve CSV formül enjeksiyonuna karşı kaçırılır.

## 5. Etiket (QR) ve Nimbot B1 yazıcı

- Talep satırındaki **Yazdır** bağlantısı `/hizmet/{id}/etiket` ekranını açar.
- Etiket üzerinde sıra no, müşteri, telefon, miktar, işlem kutuları (Kırma / Kavur /
  Paket), tutar ve **QR kod** (`FILBERT-HIZMET:{siraNo}`) bulunur. QR, ambalajların
  karışmaması için torbaya yapıştırılır.
- Yazıcı profili: **Nimbot B1 · 50×50 mm** (varsayılan) ve **Termal rulo · 80×70 mm**.
  Seçim kayda yazılır (`etiketProfili`) ve sonraki baskılarda hatırlanır.
- Baskı `@page` kurallarıyla yapılır (`src/app/globals.css` → `etiket50`,
  `etiket80x70`). Tarayıcı yazdırma penceresinde kâğıt boyutu **50×50 mm** ve kenar
  boşlukları **Yok** seçilmelidir. **QR PNG** düğmesi QR görselini indirir; Nimbot B1
  mobil uygulamasına aktarılarak doğrudan yazdırılabilir.
- Her baskı `etiketBasildiSayisi` sayacını artırır.
- Yazıcı hedefi **Bluetooth · Nimbot B1** ise etiket ekranında **Önizle** ve
  **Bluetooth ile Yazdır** düğmeleri kullanılır (bkz. aşağıdaki
  "Bluetooth ile doğrudan baskı" bölümü).

### Doğrudan ESC/POS baskı (Nimbot B1)

Etiket, tarayıcı yazdırma penceresi kullanılmadan **ham ESC/POS** baytlarıyla yazıcıya
gönderilebilir. Etiket ekranındaki **Doğrudan Yazdır** düğmesi bu yolu kullanır;
düğme yalnızca (a) firma ayarlarında bir yazıcı hedefi tanımlıysa ve (b) kullanıcının
`HIZMET/GUNCELLE` izni varsa etkindir.

Baskı, uygulamayı çalıştıran **sunucudan** yapılır: yazıcı, `next dev`/`next start`
sürecinin çalıştığı bilgisayara bağlı (ya da ağdan erişilebilir) olmalıdır.

**Ayarlar → Fındık İşleme → Doğrudan Yazıcı** bölümünden yapılandırılır:

| Hedef | Ne zaman kullanılır | Gerekli alan |
| --- | --- | --- |
| Kapalı | Doğrudan baskı istenmiyorsa (yalnızca tarayıcıdan yazdırma) | — |
| Bluetooth · Nimbot B1 (tarayıcıdan) | Yazıcı BLE ile bağlanacaksa, sürücü kurmadan | Baskı yoğunluğu (1-5) |
| Windows yazıcı kuyruğu | Nimbot B1 USB ile bağlıysa | Yazıcı kuyruğu adı |
| Ağ yazıcısı (IP:9100) | Yazıcı ağda ve ESC/POS soketi açıksa | IP adresi + port (varsayılan 9100) |

- **Karakter kod sayfası:** `PC857 · Türkçe` (varsayılan, `ESC t 13`) veya `ASCII`
  (ç → c, ş → s, ı → i sadeleştirmesi). Etikette Türkçe harfler bozuk çıkıyorsa ASCII
  seçeneğine geçin.
- **Test Etiketi Yazdır** düğmesi örnek bir etiket basar; **önce ayarları kaydedin**,
  çünkü test baskısı kayıtlı ayarları kullanır.
- Yazıcı kuyruğu listesi sunucuda `Get-Printer` ile okunur; liste boşsa **Yazıcıları
  yenile** düğmesine basın.

**Windows kurulum notu:** Nimbot B1'i Windows'a eklerken sürücü olarak
**Generic / Text Only** seçilmesi önerilir. Baskı, sürücünün sayfa görüntüsü üretmesi
atlanarak `RAW` veri tipiyle spooler'a yazılır (winspool.drv). Satıcı sürücüsü ham
baytları yeniden yorumlarsa boş ya da bozuk etiket basılabilir.

**Teknik akış:**

1. `src/lib/yazici/escpos.ts` — saf ESC/POS üreticisi (metin, kalın, hizalama, ters
   baskı, `GS ( k` model 2 QR, kod sayfası, satır sarma, profil ölçüleri).
2. `src/lib/yazici/gonder.ts` — taşıma katmanı: Windows kuyruğuna RAW (winspool.drv
   P/Invoke, PowerShell `-EncodedCommand` üzerinden, yerel modül gerekmez) veya ağ
   üzerinden TCP 9100.
3. `src/lib/actions/yazici.ts` — `hizmetEtiketiYazdir` (kopya başına ayrı baskı işi,
   en fazla 10 kopya, başarıda `etiketBasildiSayisi` artışı) ve `yaziciTestEtiketiYazdir`.
4. `Firma.ayarlar.findikIsleme.yazici` — `{ hedef, kuyrukAdi, ip, port, kodSayfasi }`.

**Sorun giderme:**

| Belirti | Olası neden |
| --- | --- |
| "`<ad>` adlı yazıcı bulunamadı" | Kuyruk adı yanlış ya da yazıcı bu makinede kurulu değil |
| "Yazıcı veriyi kabul etmedi" | Yazıcı kapalı, etiket bitmiş veya çevrimdışı |
| "bağlantı hatası: ECONNREFUSED" | Ağ hedefi yanlış; yazıcıda ham baskı (9100) kapalı |
| Etiket boş çıkıyor | Yazıcı sürücüsü ham baytları yorumluyor; Generic / Text Only kullanın |
| Türkçe harfler bozuk | Kod sayfasını `ASCII` yapın (`ESC t` desteklenmiyor olabilir) |

### Bluetooth ile doğrudan baskı (Nimbot B1 · Web Bluetooth)

Nimbot B1 ESC/POS konuşmaz; kendi ikili BLE protokolünü kullanır. Bu yüzden Bluetooth
yolu Windows kuyruğu/ağ hedefinden farklıdır: etiket **tarayıcıda** 384 nokta
genişliğinde çizilir, 1 bit raster'a çevrilir ve **Web Bluetooth** ile doğrudan yazıcıya
gönderilir. Yazıcı sürücüsü ya da ek bir yerel servis gerekmez.

**Gereksinimler:**

- Tarayıcı: **Chrome** veya **Edge** (Web Bluetooth destekleyen masaüstü sürüm).
- Sayfa **`localhost`** ya da **`https`** üzerinden açılmalıdır (Web Bluetooth güvenli
  bağlam ister); `http://<yerel-ip>` çalışmaz.
- Windows'ta Bluetooth açık ve Nimbot B1 açık/pil dolu olmalıdır.
- İlk baskıda Chrome/Edge yazıcı seçme penceresi açılır; listeden **B1-xxxx** seçilir.
  Seçim sekme kapanana kadar hatırlanır; **Unut** düğmesi seçimi sıfırlar.

**Kullanım akışı:**

1. **Ayarlar → Fındık İşleme → Doğrudan Yazıcı → Bluetooth · Nimbot B1** seçilir ve
   **Baskı yoğunluğu** (1-5, önerilen 3) ayarlanır; **Kaydet**'e basılır. Etiket soluk
   çıkarsa yoğunluğu artırın.
2. Ayarlar ekranındaki **Bluetooth ile Test Etiketi Yazdır** düğmesiyle örnek baskı
   alınır; ilerleme çubuğu paket ilerlemesini gösterir.
3. Talep etiketinde **Önizle** düğmesi yazıcıya gidecek ilk kopyayı ekranda gösterir
   (kâğıt harcamaz, gri ton içermez); **Bluetooth ile Yazdır** seçili kopya sayısı
   kadar baskıyı gönderir.

**Teknik akış:**

1. `src/lib/yazici/nimbot-etiket.ts` — saf katman: etiket içeriği/sırası, 384 nokta
   tuval ölçüsü, punto ölçekleme, eşikleme (gri → siyah/beyaz), QR matrisi ve
   niimbluelib `ImageEncoder` ile uyumlu 1 bit raster.
2. `src/lib/yazici/nimbot.ts` — istemci katmanı: cihaz seçimi (`getDevices` →
   `requestDevice`), tuval çizimi, `newPrintTask`/`printPage` baskı işi ve ilerleme
   olayları. Kopya başına ayrı sayfa basılır (en fazla 10 kopya).
3. `src/lib/yazici/nimbot-durum.ts` — `useBluetoothDestekli()`: Web Bluetooth desteği
   `useSyncExternalStore` ile istemcide ölçülür (sunucu render'ında kapalı).
4. `src/lib/actions/yazici.ts` → `etiketBaskisiKaydet` — baskı istemcide yapıldığı için
   sunucu yalnızca `etiketBasildiSayisi` sayacını artırır.

**Sorun giderme:**

| Belirti | Olası neden |
| --- | --- |
| "Web Bluetooth desteklenmiyor" uyarısı | Firefox/Safari ya da `http://<ip>` adresi; Chrome/Edge + `localhost` kullanın |
| Yazıcı seçme penceresi hiç açılmıyor | Bluetooth kapalı, yazıcı kapsam dışında ya da sayfa güvenli bağlamda değil |
| Etiket çok soluk | Baskı yoğunluğunu artırın (1-5) |
| Eşleşmiş yazıcı değişmiyor | **Unut** düğmesiyle seçimi sıfırlayıp yeniden seçin |

## 6. Teslim, tahsilat ve kasa

Müşteri fındığını almaya geldiğinde talep satırındaki tutar hücresinden tahsilat açılır:

- Ödeme yöntemi: Nakit / Kredi Kartı / Havale / **Veresiye**.
- Veresiye dışındaki yöntemlerde **hedef kasa/banka** seçilir (varsayılan:
  Ayarlar → Fındık İşleme Ayarları'ndaki kasa).
- "Fındık müşteriye teslim edildi olarak işaretlensin" işaretliyse durum
  `TESLIM_EDILDI` olur, `teslimAt` yazılır.
- Tahsilat `FinansHareket` kaydı (`tip: TAHSILAT`, `iliskiliTipi: HIZMET`) olarak
  fındık işleme kasasına işlenir; kayıt `odemeDurumu: ODENDI` olur.

Tahsil edilmeyi bekleyen veya veresiye kalan teslimler raporlarda ayrı listelenir.

Tahsilat kalemleri işleme modülünün **Kasa**'sına (`KasaHesap.modul = ISLEME`) yazılır ve
bu hesaplar İşleme modülündeki **Kasa** ekranından (`/hizmet/kasa`) yönetilir.
Alım modülündeki `/kasa` ekranı bu hesapları **salt görüntü** olarak listeler
(bkz. bölüm 1).

## 7. Raporlama ve CSV

**Talep Kuyruğu → Durum Raporları** (`/hizmet/raporlar`):

- Durum dağılımı (talep adedi, miktar, tutar).
- Ortalama aşama süreleri (talep→kırım, kırım→kavurma, kavurma→paketleme,
  talep→tamamlanma, tamamlanma→teslim).
- **Teslimat · Hazırlananlar** listesi ve bildirim gönderilmemiş kayıt sayısı.
- **Teslim Edildi · Tahsilat Bekliyor** listesi.
- **3 günden fazla bekleyenler**.

CSV dışa aktarımı: `/api/hizmet/raporlar/csv`

| Sorgu | İçerik |
| --- | --- |
| (boş) veya `?durum=HEPSI` | Tüm talepler |
| `?durum=KIRIM` | Tek aşama |
| `?liste=teslimat` | Hazırlanmış, teslim alınmamışlar (eski ad: `hazir`) |
| `?liste=kuyruk` | Henüz işleme alınmamış bekleyen talepler |
| `?liste=sms` | Tamamlandı bildirimi gönderilmemişler |
| `?liste=tahsilat` | Teslim edilmiş, tahsilatı bekleyenler |

CSV; sıra no, müşteri, telefon, kg, işlemler, durum, ödeme durumu, tutar, tahsil
edilen tutar, SMS durumları, hatırlatma/baskı sayaçları ve tüm aşama zaman damgalarını
içerir. Formül enjeksiyonuna karşı hücreler kaçırılır.

SMS gönderim günlüğü ayrı ekranda (**SMS Merkezi**, `/hizmet/sms`) listelenir ve
`/api/hizmet/sms/csv?durum=HATA&tip=TAMAMLANDI&q=...` ile aynı filtrelerle dışa
aktarılır (bkz. bölüm 4).

## 8. Doğrulama

```bash
pnpm typecheck            # tsc --noEmit
pnpm lint                 # eslint
pnpm test                 # birim testleri (tsx --test)
                          #   ESC/POS: test/yazici-escpos.test.ts
                          #   Bluetooth/BLE raster: test/yazici-nimbot.test.ts
                          #   Modül ayrımı/menü daraltma: test/modul.test.ts
                          #   Müşteri/müstahsil ayrımı: test/musteri-ayrim.test.ts
                          #   Pano KPI + durum dağılımı grafiği: test/pano-isleme-kpi.test.ts
                          #   SMS günlüğü, parça/kredi hesabı ve gönderim akışı: test/sms.test.ts
pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
pnpm build
```

### Yerel uçtan uca doğrulama (`e2e/findik-isleme.spec.ts`)

Test, paylaşılan geliştirme veritabanına rastgele kayıt eklememek için kimlik bilgisi
verilmediğinde atlanır. İki yol vardır:

1. **Gerçek kullanıcı bilgileri:**

   ```powershell
   $env:FILBERT_E2E_EPOSTA = "kullanici@ornek.com"
   $env:FILBERT_E2E_PAROLA = "parola"
   pnpm exec playwright test e2e/findik-isleme.spec.ts
   ```

2. **Doğrudan oturum anahtarı** (parola değiştirmeden): veritabanında bir `Oturum`
   kaydı üretip token'ı ortam değişkenine verin. Token hash'i
   `sha256(token)` ve cookie adı `filbert_session` olmalıdır.

   ```ts
   const token = randomBytes(32).toString("base64url");
   await prisma.oturum.create({
     data: {
       kullaniciId: "<kullanici-id>",
       tokenHash: createHash("sha256").update(token).digest("hex"),
       expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
     },
   });
   ```

   ```powershell
   $env:FILBERT_E2E_TOKEN = "<token>"
   pnpm exec playwright test e2e/findik-isleme.spec.ts
   ```

   Doğrulama sonrası üretilen `Oturum` kaydını silmeyi unutmayın.

### Test artıklarını temizleme

`e2e/findik-isleme.spec.ts` paylaşılan veritabanına talep kaydı (`HizmetIslemi`), bu
talebe bağlı tahsilat `FinansHareket` satırı, işleme müşteri rehberi kaydı
(`Musteri`) ve alım müstahsili (`CariKart`) yazar. Doğrulama bittikten sonra
artıkları önce kuru çalıştırmayla listeleyin, sonra silin:

```powershell
pnpm e2e:temizle                # yalnızca neyin silineceğini listeler
pnpm e2e:temizle -- --uygula    # test kayıtlarını ve bağlı tahsilatları siler
```

Betik yalnızca `Z… Musteri` veya `E2eFindik…` ön ekli kayıtları hedefler; başka
hiçbir hizmet ya da finans kaydına dokunmaz.

Kapsanan senaryolar: talep kaydı + ilk 4 harf önerisi, kırım/kavurma/paketleme aşama
geçişleri, tamamlandı SMS onayı, `?liste=teslimat` derin bağlantısı, teslim hatırlatma
SMS'i, QR etiket + yazıcı profili, doğrudan ESC/POS baskı kontrolü, Bluetooth önizleme
ve baskı düğmeleri, tahsilat → `TESLIM_EDILDI`, durum raporları ve CSV, ayarlar
ekranındaki yazıcı hedefi (Bluetooth dahil) bölümü, `/mod/islem` modül sayaçları.
Modül ayrımı için ayrıca: menü daraltma (her modülde yalnızca kendi grupları),
panonun modüle göre ayrılması (işleme ve alım panoları karışmaz), modül geçişinin
kenar çubuğunda menü öğesi olarak **yer almadığı**, Ayarlar → Modül sekmesi ve
giriş varsayılan modülü yönlendirmesi doğrulanır. Mobil sticky alt menünün modüle
göre ayrıldığı (alım: Ana Sayfa / Ara / Sesli modu aç / Ayarlar; işleme: Pano /
Talep Kuyruğu / Yeni Talep / Kasa / Ayarlar) ve **işleme modülünde eller
serbest (sesli not) ögesinin bulunmadığı** da doğrulanır.

Web Bluetooth'un kendisi (yazıcı eşleştirme ve fiziksel baskı) tarayıcı izni ve donanım
gerektirdiğinden e2e'de taklit edilir. Gerçek baskı **yazıcının bağlı olduğu makinede**
elle doğrulanmalıdır: hedefi Bluetooth yapın, **Bluetooth ile Test Etiketi Yazdır** ile
yazıcıyı seçin ve çıktıyı kontrol edin.

## 9. Şema ve migration

- `HizmetDurumu` enum'u aşama kodlarını içerir; `HAZIRLANIYOR` kaldırılmış ve mevcut
  kayıtlar `KIRIM` aşamasına taşınmıştır
  (`prisma/migrations/20261010120000_findik_isleme_asamalari`).
- `SmsAyari.teslimHatirlatmaSablonu` alanı teslim hatırlatma şablonunu tutar
  (`prisma/migrations/20261010140000_sms_teslim_hatirlatma`).
- Firma bazlı işleme ayarları (`Firma.ayarlar.findikIsleme`) kasa ve etiket profilini
  saklar; `src/lib/findik-isleme.ts` çözümleme/birleştirme yardımcılarını içerir.
  ESC/POS yazıcı hedefi ve Bluetooth baskı yoğunluğu (`bluetoothYogunluk`) da aynı
  blokta (`yazici`) tutulur, ek migration gerekmez.
- İşleme müşterileri `Musteri` tablosuna taşınmıştır; `HizmetIslemi.cariId` kaldırılıp
  yerine `musteriId` (`onDelete: SetNull`) gelmiştir. Migration mevcut hizmet
  kayıtlarındaki ad + telefonları `Musteri` rehberine taşır ve talepleri bu rehbere
  bağlar (`prisma/migrations/20261010180000_findik_isleme_musteri_tablosu`).
- `FirmaModulu` enum'u (`ALIM` | `ISLEME`) modül ayrımını taşır:
  `Kullanici.varsayilanModul` kullanıcının girişte açılacak modülünü,
  `KasaHesap.modul` hesabın hangi modüle ait olduğunu belirtir; varsayılan `ALIM`'dır
  (`prisma/migrations/20261010160000_modul_ayrimi_kasa_ve_varsayilan`).
- Her SMS gönderimi `SmsKaydi` tablosuna yazılır (durum, sağlayıcı iş kimliği, hata
  kodu, kredi/parça sayısı, birim ve toplam maliyet, teslim kodu/zamanı); `SmsAyari`'na
  `birimMaliyetKurus`, `kodlama` ve `appname` alanları eklenmiştir
  (`prisma/migrations/20261010193000_sms_gonderim_kayitlari`).
