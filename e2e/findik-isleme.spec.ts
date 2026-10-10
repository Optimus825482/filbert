import { expect, test, type Locator } from "@playwright/test";

/**
 * Fındık İşleme Modülü uçtan uca doğrulaması.
 *
 * Kimlik doğrulama iki yoldan biriyle sağlanır:
 *   1) FILBERT_E2E_TOKEN — veritabanında üretilmiş geçerli bir oturum anahtarı
 *      (cookie adı: filbert_session). Yerel doğrulama için bkz.
 *      docs/runbooks/findik-isleme-modulu.md → "Yerel uçtan uca doğrulama".
 *   2) FILBERT_E2E_EPOSTA + FILBERT_E2E_PAROLA — gerçek kullanıcı bilgileriyle
 *      giriş ekranından oturum açılır.
 *
 * Hiçbiri tanımlı değilse test atlanır; paylaşılan geliştirme veritabanına
 * rastgele kayıt eklenmez.
 */
const TOKEN = process.env.FILBERT_E2E_TOKEN?.trim();
const EPOSTA = process.env.FILBERT_E2E_EPOSTA?.trim();
const PAROLA = process.env.FILBERT_E2E_PAROLA?.trim();

const skipMesaji =
  TOKEN || (EPOSTA && PAROLA)
    ? undefined
    : "FILBERT_E2E_TOKEN veya FILBERT_E2E_EPOSTA/FILBERT_E2E_PAROLA tanımlı değil — fındık işleme testi atlandı";

test.describe.configure({ mode: "serial" });

test.describe("Fındık İşleme Modülü — talep, aşama, bildirim ve teslim akışı", () => {
  test.skip(Boolean(skipMesaji), skipMesaji ?? "");

  // Testler aynı talebi zincir hâlinde kullanır.
  // Her çalışmada farklı bir ilk-4-harf üretilir: öneri listesi "en yakın 5"
  // kayıtla sınırlı olduğundan önceki test kayıtlarıyla çakışmaz.
  const onEk = `Z${Date.now().toString(36).slice(-3).toUpperCase()}`;
  const musteriAdi = `${onEk} Musteri`;
  const telefon = "05321112233";
  let satir: Locator;

  function durumSeciciKutusu(): Locator {
    return satir.locator("td").nth(6).locator("select");
  }

  test.beforeEach(async ({ context, page }) => {
    if (TOKEN) {
      await context.addCookies([
        { name: "filbert_session", value: TOKEN, domain: "127.0.0.1", path: "/" },
      ]);
      return;
    }
    await page.goto("/giris");
    await page.locator("#giris-eposta").fill(EPOSTA!);
    await page.locator("#giris-parola").fill(PAROLA!);
    await page.locator('form button[type="submit"]').first().click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("talep kaydı oluşturulur ve ilk 4 harfte müşteri önerisi telefonu otomatik doldurur", async ({
    page,
  }) => {
    await page.goto("/hizmet/yeni");
    await expect(page.getByRole("heading", { name: "Yeni Hizmet Kaydı" })).toBeVisible();
    await page.getByPlaceholder(/ilk 4 harfi/).fill(musteriAdi);
    await page.locator('input[type="tel"]').fill(telefon);
    await page.locator('input[inputmode="decimal"]').first().fill("25");
    // Talepte üç işlem de istensin: kırma (varsayılan açık) + kavurma + vakumlu paketleme.
    await page.locator("label", { hasText: "Kavurma" }).locator('input[type="checkbox"]').check();
    await page
      .locator("label", { hasText: "Vakumlu Paketleme" })
      .locator('input[type="checkbox"]')
      .check();
    await page.getByRole("button", { name: "Sadece Kaydet" }).click();
    await expect(page).toHaveURL(/\/hizmet$/);

    satir = page.locator("tr", { hasText: musteriAdi });
    await expect(satir).toBeVisible();
    await expect(durumSeciciKutusu()).toHaveValue("SIRAYA_ALINDI");

    // Aynı müşteri adının ilk 4 harfi yeni talepte öneri listesini tetikler.
    await page.goto("/hizmet/yeni");
    const adGirdisi = page.getByPlaceholder(/ilk 4 harfi/);
    await adGirdisi.fill(musteriAdi.slice(0, 4));
    const oneri = page.locator("button", { hasText: musteriAdi }).first();
    await expect(oneri).toBeVisible();
    await expect(oneri).toContainText(telefon);
    await oneri.click();
    await expect(adGirdisi).toHaveValue(musteriAdi);
    await expect(page.locator('input[type="tel"]')).toHaveValue(telefon);
  });

  test("kırım, kavurma ve paketleme aşamaları zaman damgasıyla ilerler; tamamlandı bildirimi sorulur", async ({
    page,
  }) => {
    await page.goto("/hizmet");
    satir = page.locator("tr", { hasText: musteriAdi });

    await durumSeciciKutusu().selectOption("KIRIM");
    await expect(durumSeciciKutusu()).toHaveValue("KIRIM");
    await expect(satir.getByText("✓ Kırım")).toBeVisible();

    await durumSeciciKutusu().selectOption("KAVURMA");
    await expect(durumSeciciKutusu()).toHaveValue("KAVURMA");
    await expect(satir.getByText("✓ Kavurma")).toBeVisible();

    await durumSeciciKutusu().selectOption("PAKETLEME");
    await expect(durumSeciciKutusu()).toHaveValue("PAKETLEME");
    await expect(satir.getByText("✓ Paket")).toBeVisible();

    // Tamamlandı seçilince kullanıcıya SMS gönderimi sorulur.
    await durumSeciciKutusu().selectOption("TAMAMLANDI");
    const onayIletisi = page.getByText("Siparişi Tamamla & Bildirim");
    await expect(onayIletisi).toBeVisible();
    await page.getByRole("button", { name: "Evet, SMS Gönder ve Tamamla" }).click();
    await expect(onayIletisi).toHaveCount(0);

    await expect(durumSeciciKutusu()).toHaveValue("TAMAMLANDI");
    await expect(satir.getByText("1× teslim bildirimi")).toBeVisible();
  });

  test("hazır listesi derin bağlantısı açılır ve teslim hatırlatma SMS'i gönderilir", async ({
    page,
  }) => {
    await page.goto("/hizmet?liste=hazir");
    const hazirDugmesi = page.getByRole("button", { name: /Hazır · Teslim Alınmayan/ });
    await expect(hazirDugmesi).toHaveClass(/border-purple-400/);

    satir = page.locator("tr", { hasText: musteriAdi });
    await expect(satir).toBeVisible();

    // Daha önce tamamlandı bildirimi gitmiş kayıt için hatırlatma şablonu kullanılır.
    await satir.locator('button[title*="Tamamlandı SMS"]').click();
    await expect(satir.getByText("2× teslim bildirimi")).toBeVisible();
  });

  test("talep etiketi QR kodlu olarak yazdırılır ve yazıcı profili seçilebilir", async ({ page }) => {
    await page.goto("/hizmet");
    satir = page.locator("tr", { hasText: musteriAdi });
    const yazdirLink = satir.getByRole("link", { name: "Yazdır" });
    const href = await yazdirLink.getAttribute("href");
    expect(href).toMatch(/^\/hizmet\/[0-9a-f-]{36}\/etiket$/);

    await page.goto(href!);
    await expect(page.getByRole("heading", { name: "Etiket Yazdır" })).toBeVisible();
    await expect(page.getByText(musteriAdi).first()).toBeVisible();
    await expect(page.locator("img").first()).toBeVisible();

    const termal = page.getByRole("button", { name: /Termal rulo/ });
    const nimbot = page.getByRole("button", { name: /Nimbot B1/ });
    await termal.click();
    await expect(termal).toHaveClass(/border-\[#f5c518\]/);
    await nimbot.click();
    await expect(nimbot).toHaveClass(/border-\[#f5c518\]/);
    await expect(page.getByText(/50×50 mm/).first()).toBeVisible();

    // Doğrudan ESC/POS baskı kontrolü etiket ekranında bulunur.
    await expect(page.getByRole("button", { name: /Doğrudan Yazdır/ })).toBeVisible();
    // Bluetooth (Nimbot B1) önizleme ve baskı kontrolleri de etiket ekranındadır.
    await expect(page.getByRole("button", { name: "Önizle", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /Bluetooth ile Yazdır/ })).toBeVisible();
  });

  test("tahsilat kaydı durumu teslim edildi yapar ve kasaya işler", async ({ page }) => {
    await page.goto("/hizmet");
    satir = page.locator("tr", { hasText: musteriAdi });
    await satir.locator('button[title="Tahsilat yap"]').click();

    const kutu = page.getByRole("dialog");
    await expect(kutu.getByText("Hizmet Bedeli Tahsilatı")).toBeVisible();
    await kutu.getByRole("button", { name: "Nakit", exact: true }).click();
    await expect(kutu.locator("select")).toContainText("Merkez Kasa");
    await expect(kutu.getByText("Fındık müşteriye teslim edildi olarak işaretlensin")).toBeVisible();
    await kutu.getByRole("button", { name: "Tahsilatı Kaydet" }).click();

    await expect(kutu).toHaveCount(0);
    await expect(durumSeciciKutusu()).toHaveValue("TESLIM_EDILDI");
    await expect(satir.getByText("Nakit")).toBeVisible();
  });

  test("durum raporları ve CSV dışa aktarımı talep durumlarını listeler", async ({ page }) => {
    await page.goto("/hizmet/raporlar");
    await expect(page.getByRole("heading", { name: /Durum Raporları/ })).toBeVisible();
    await expect(page.getByText("Durum Dağılımı").first()).toBeVisible();
    await expect(page.getByText("Hazır · Teslim Alınmayanlar").first()).toBeVisible();
    await expect(page.getByText("Teslim Edildi · Tahsilat Bekliyor").first()).toBeVisible();

    const csv = await page.request.get("/api/hizmet/raporlar/csv?durum=HEPSI");
    expect(csv.status()).toBe(200);
    expect(csv.headers()["content-type"]).toContain("text/csv");
    const govde = await csv.text();
    expect(govde).toContain("SiraNo;Musteri;Telefon");
    expect(govde).toContain(musteriAdi);
    expect(govde).toContain("Teslim Edildi");

    const tahsilatCsv = await page.request.get("/api/hizmet/raporlar/csv?liste=tahsilat");
    expect(tahsilatCsv.status()).toBe(200);
  });

  test("fındık işleme ayarlarında doğrudan yazıcı ve Bluetooth hedefi yapılandırılabilir", async ({
    page,
  }) => {
    await page.goto("/hizmet/ayarlar");
    await expect(page.getByRole("heading", { name: "Fındık İşleme Ayarları" })).toBeVisible();
    await expect(page.getByText("Doğrudan Yazıcı", { exact: true })).toBeVisible();
    // Hedef seçenekleri: kapalı, Bluetooth (Nimbot B1), Windows kuyruğu ve ağ yazıcısı.
    await expect(
      page.getByRole("button", { name: /Kapalı · yalnızca tarayıcıdan yazdır/ })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Bluetooth · Nimbot B1/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Windows yazıcı kuyruğu/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ağ yazıcısı/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Test Etiketi Yazdır", exact: true })).toBeVisible();

    // Bluetooth hedefi seçilince Web Bluetooth bölümü, yoğunluk ve test baskısı görünür.
    await page.getByRole("button", { name: /Bluetooth · Nimbot B1/ }).click();
    await expect(page.getByText("Baskı yoğunluğu")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Bluetooth ile Test Etiketi Yazdır/ })
    ).toBeVisible();
  });

  test("/mod/islem modül ekranı sayaçları ve kısayolları gösterir", async ({ page }) => {
    await page.goto("/mod/islem");
    await expect(page.getByRole("heading", { name: "Fındık İşleme Modülü" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Yeni Talep Kaydı/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Talep Kuyruğu/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Durum Raporları/ }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Hazır · Teslim Alınmayanlar/ }).first()).toBeVisible();
  });

  test("modül ayrımı: işleme ekranı yalnızca kendi menülerini listeler", async ({ page }) => {
    await page.goto("/mod/islem");
    await expect(page.getByRole("heading", { name: "Fındık İşleme Modülü" })).toBeVisible();

    const kenar = page.locator("aside");
    await expect(kenar.getByText("Fındık İşleme Modülü")).toBeVisible();
    await expect(kenar.getByRole("link", { name: "İşleme Kasası" })).toBeVisible();
    // Alım modülünün menüleri işleme modülünde listelenmez.
    await expect(kenar.getByRole("link", { name: /Alım Yönetimi/ })).toHaveCount(0);
    await expect(kenar.getByRole("link", { name: /Randıman Takibi/ })).toHaveCount(0);
    await expect(page.locator("main").getByRole("link", { name: /Alım Yönetimi/ })).toHaveCount(0);
  });

  test("modül geçişi kenar çubuğunda menü öğesi olarak yer almaz", async ({ page }) => {
    // Modül değişimi yalnızca Ayarlar → Modül ekranındadır; kenar çubuğunda
    // geçiş düğmesi bulunmaz.
    await page.goto("/mod/islem");
    const kenar = page.locator("aside");
    await expect(kenar.getByText("Fındık İşleme Modülü")).toBeVisible();
    await expect(kenar.getByRole("button", { name: /Modülüne Geç/ })).toHaveCount(0);
    await expect(kenar.getByRole("link", { name: "Ayarlar", exact: true })).toBeVisible();

    await page.goto("/mod/alim");
    await expect(kenar.getByText("Fındık Alım Modülü")).toBeVisible();
    await expect(kenar.getByRole("button", { name: /Modülüne Geç/ })).toHaveCount(0);
    await expect(kenar.getByRole("link", { name: /Alım Yönetimi/ })).toBeVisible();
    // İşleme modülünün menüleri alım modülünde görünmez.
    await expect(kenar.getByRole("link", { name: "İşleme Kasası" })).toHaveCount(0);
  });

  test("pano modüle göre ayrılır: işleme ve alım panoları karışmaz", async ({ page, context }) => {
    const modulCerezi = async () => (await context.cookies()).find((c) => c.name === "filbert_modul")?.value;

    // Fındık İşleme panosu yalnızca işleme akışını gösterir.
    await page.goto("/mod/islem");
    await expect.poll(modulCerezi).toBe("islem");
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Pano" })).toBeVisible();
    await expect(page.getByText("Fındık işleme kuyruğu")).toBeVisible();
    await expect(page.getByText("Son alım fişleri")).toHaveCount(0);
    await expect(page.getByText("Depo stok durumu")).toHaveCount(0);

    // Fındık Alım panosu yalnızca alım akışını gösterir.
    await page.goto("/mod/alim");
    await expect.poll(modulCerezi).toBe("alim");
    await page.goto("/");
    await expect(page.getByText("Son alım fişleri")).toBeVisible();
    await expect(page.getByText("Fındık işleme kuyruğu")).toHaveCount(0);
  });

  test("mobil alt menüdeki Ayarlar butonundan modül değiştirilir", async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mod/islem");

    // Modüle özel ekrana doğrudan gelindiğinde tercih çerezi eşitlenir.
    await expect
      .poll(async () => (await context.cookies()).find((c) => c.name === "filbert_modul")?.value)
      .toBe("islem");

    const ayarlar = page.locator("nav.guvenli-alt").getByRole("link", { name: "Ayarlar" });
    await expect(ayarlar).toBeVisible();
    await ayarlar.click();
    await page.waitForURL(/\/ayarlar/);

    const icerik = page.locator("main");
    await expect(icerik.getByRole("heading", { name: "Modül Seçimi" })).toBeVisible();
    await expect(icerik.getByText("Giriş yaptığımda açılsın")).toBeVisible();
    await expect(icerik.getByRole("button", { name: /Fındık Alım Modülüne Geç/ })).toBeVisible();

    await icerik.getByRole("button", { name: /Fındık Alım Modülüne Geç/ }).click();
    await page.waitForURL(/\/mod\/alim$/);
    await expect(page.getByRole("heading", { name: "Fındık Alım Modülü" })).toBeVisible();
  });
  test("mobil alt menü modüle göre ayrılır: işlemede eller serbest yok", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // Fındık İşleme: alt menü yalnızca işleme akışını taşır, eller serbest yok.
    await page.goto("/mod/islem");
    const alt = page.locator("nav.guvenli-alt");
    await expect(alt.getByRole("link", { name: "Pano" })).toBeVisible();
    await expect(alt.getByRole("link", { name: "Talep Kuyruğu" })).toBeVisible();
    await expect(alt.getByRole("link", { name: "Yeni Talep" })).toBeVisible();
    await expect(alt.getByRole("link", { name: "İşleme Kasası" })).toBeVisible();
    await expect(alt.getByRole("link", { name: "Ayarlar", exact: true })).toBeVisible();
    await expect(alt.getByRole("link", { name: "Sesli modu aç" })).toHaveCount(0);
    await expect(alt.getByRole("link", { name: "Ara", exact: true })).toHaveCount(0);

    // Kısayol gerçekten çalışır: yeni talep kaydı ekranı açılır.
    await alt.getByRole("link", { name: "Yeni Talep" }).click();
    await page.waitForURL(/\/hizmet\/yeni$/);
    await expect(page.getByRole("heading", { name: "Yeni Hizmet Kaydı" })).toBeVisible();

    // Fındık Alım: işleme ögeleri alt menüde görünmez.
    await page.goto("/mod/alim");
    await expect(alt.getByRole("link", { name: "Yeni Talep" })).toHaveCount(0);
    await expect(alt.getByRole("link", { name: "İşleme Kasası" })).toHaveCount(0);
    await expect(alt.getByRole("link", { name: "Ana Sayfa" })).toBeVisible();
    await expect(alt.getByRole("link", { name: "Ayarlar", exact: true })).toBeVisible();
  });

  test("alım müstahsili işleme müşteri önerilerinde görünmez (ayrı tablolar)", async ({ page }) => {
    const mustahsilAdi = `${onEk} Mustahsil`;

    // Alım modülünde hızlı müstahsil kaydı açılır (CariKart · URETICI).
    await page.goto("/alim/yeni");
    const hizliKayitGirdisi = page.getByPlaceholder("Müstahsil adı ve soyadı");
    await hizliKayitGirdisi.fill(mustahsilAdi);
    await page.getByRole("button", { name: "Kaydet", exact: true }).click();
    // Kayıt tamamlanınca hızlı kayıt kartı kapanır ve müstahsil fişe seçilir.
    await expect(hizliKayitGirdisi).toHaveCount(0);

    // İşleme tarafında aynı ön ekle arandığında müstahsil önerilmez; yalnızca
    // işleme müşteri rehberindeki kayıtlar önerilir.
    await page.goto("/hizmet/yeni");
    await page.getByPlaceholder(/ilk 4 harfi/).fill(onEk);
    await expect(page.locator("button", { hasText: `${onEk} Musteri` })).toBeVisible();
    await expect(page.locator("button", { hasText: mustahsilAdi })).toHaveCount(0);
  });
});
