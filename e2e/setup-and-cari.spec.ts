import { expect, test } from "@playwright/test";

test("boş CI veritabanında kurulumdan alım, satış ve sevkiyata kadar ana işlem zinciri çalışır", async ({ page }) => {
  test.skip(!process.env.CI, "Yerel geliştirme veritabanında kurulum verisi oluşturmamak için yalnız CI ortamında çalışır.");
  test.slow();

  await page.goto("/giris");
  await page.locator("#giris-eposta").fill("ci-admin@example.test");
  await page.locator("#giris-parola").fill("ci-only-long-administrator-password");
  await page.getByRole("button", { name: "Çalışma alanına devam et" }).click();
  await expect(page).toHaveURL(/\/setup$/);

  await page.locator('input[name="anaParola"]').fill("ci-only-long-setup-secret");
  await page.getByRole("button", { name: "Sistem kurulumunu tamamla" }).click();
  await expect(page).toHaveURL(/\/platform$/);

  await page.getByPlaceholder("Firma unvanı").fill("CI Tarım Ltd.");
  await page.getByPlaceholder("Açık adres").fill("Sakarya / Türkiye");
  await page.getByPlaceholder("Telefon").fill("05550000000");
  await page.getByPlaceholder("Vergi numarası").fill("1234567890");
  await page.getByPlaceholder("Firma sahibi adı").fill("CI Firma Sahibi");
  await page.getByPlaceholder("Firma sahibi e-posta").fill("ci-sahip@example.test");
  await page.getByPlaceholder("Firma sahibi parolası (en az 12 karakter)").fill("ci-only-owner-password");
  await page.getByRole("button", { name: "Firmayı kur" }).click();
  await expect(page).toHaveURL(/\/platform\/[^/]+\/yetkiler$/);
  await page.getByRole("button", { name: "Kurulumu bitir, girişe dön" }).click();
  await expect(page).toHaveURL(/\/giris$/);

  await page.locator("#giris-eposta").fill("ci-sahip@example.test");
  await page.locator("#giris-parola").fill("ci-only-owner-password");
  await page.getByRole("button", { name: "Çalışma alanına devam et" }).click();
  await expect(page).toHaveURL(/\/$/);

  await page.goto("/ayarlar/roller?w=1");
  await expect(page.getByRole("heading", { name: "Rol ve yetki yönetimi" })).toBeVisible();
  await page.getByLabel("Rol adı").fill("Saha Görüntüleme");
  await page.locator("#izin-DASHBOARD-GORUNTULE").check();
  await page.getByRole("button", { name: "Rolü kaydet" }).click();
  await expect(page.locator("article b").filter({ hasText: "Saha Görüntüleme" })).toBeVisible();

  await page.goto("/ayarlar?w=1");
  await page.getByRole("button", { name: "Tanımlar" }).click();
  await expect(page.getByText("Depolar", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yeni" }).click();
  await page.getByLabel("Depo adı").fill("CI Merkez Depo");
  await page.getByRole("button", { name: "Depo Ekle" }).click();
  await expect(page.getByText("CI Merkez Depo", { exact: true })).toBeVisible();

  await page.goto("/cari/hesaplar?w=1");
  await page.getByRole("button", { name: "Yeni cari" }).click();
  await page.getByLabel("Ad / ünvan").fill("CI Üretici");
  await page.getByLabel("Telefon").fill("05551112233");
  await page.getByRole("button", { name: "Cari kart oluştur" }).click();

  const satir = page.locator("tr", { hasText: "CI Üretici" });
  await expect(satir).toBeVisible();
  await satir.getByRole("button", { name: "Düzenle" }).click();
  await page.getByRole("button", { name: "Pasifleştir" }).click();
  await expect(satir.getByText("PASİF")).toBeVisible();
  await satir.getByRole("button", { name: "Düzenle" }).click();
  await page.getByRole("button", { name: "Aktifleştir" }).click();
  await expect(satir.getByText("PASİF")).toHaveCount(0);

  await page.getByRole("button", { name: "Yeni cari" }).click();
  await page.getByLabel("Ad / ünvan").fill("CI Tüccar");
  await page.getByLabel("Cari türü").click();
  await page.getByRole("option", { name: "Tüccar" }).click();
  await page.getByRole("button", { name: "Cari kart oluştur" }).click();
  await expect(page.locator("tr", { hasText: "CI Tüccar" })).toBeVisible();

  await page.goto("/alim/yeni?w=1");
  await page.getByLabel("Üretici").click();
  await page.getByRole("option", { name: "CI Üretici" }).click();
  await page.getByLabel("Giriş deposu").click();
  await page.getByRole("option", { name: "CI Merkez Depo" }).click();
  await page.getByLabel("Brüt (kg)").fill("100");
  await page.getByLabel("Çuval adedi").fill("0");
  await page.getByLabel("Sağlam iç").fill("500");
  await page.getByRole("button", { name: "Manuel" }).click();
  await page.getByLabel("Birim fiyat (TL/kg)").fill("100");
  await page.getByRole("button", { name: "Onayla & Kaydet" }).click();
  await expect(page).toHaveURL(/\/alim$/);
  const alimSatiri = page.locator("tr", { hasText: "CI Üretici" });
  await expect(alimSatiri).toBeVisible();
  await expect(alimSatiri.getByText("Onaylı", { exact: true })).toBeVisible();

  await page.goto("/satis/yeni?w=1");
  await page.getByLabel("Müşteri").click();
  await page.getByRole("option", { name: "CI Tüccar" }).click();
  await page.getByLabel("Çıkış deposu").click();
  await page.getByRole("option", { name: "Merkez Depo" }).click();
  await page.getByLabel("Brüt (kg)").fill("30");
  await page.getByLabel("Dara (kg)").fill("0");
  await page.getByRole("button", { name: "Manuel" }).click();
  await page.getByLabel("Birim fiyat (TL/kg)").fill("120");
  await page.getByRole("button", { name: "Onayla ve Kaydet" }).click();
  await expect(page).toHaveURL(/\/satis$/);
  const satisSatiri = page.locator("tr", { hasText: "CI Tüccar" });
  await expect(satisSatiri).toBeVisible();
  await expect(satisSatiri.getByText("Onaylı", { exact: true })).toBeVisible();

  await page.goto("/sevk-yeni?w=1");
  await page.getByLabel("Plaka").fill("54 ABC 123");
  await page.getByLabel("Şoför").fill("CI Şoför");
  await page.getByLabel("Alıcı (opsiyonel)").click();
  await page.getByRole("option", { name: "CI Tüccar" }).click();
  await page.getByLabel("Kg").fill("20");
  await page.getByRole("button", { name: "Sevkiyatı Başlat" }).click();
  await expect(page).toHaveURL(/\/sevkiyat$/);
  const sevkSatiri = page.locator("tr", { hasText: "54 ABC 123" });
  await expect(sevkSatiri).toBeVisible();
  await expect(sevkSatiri.getByText("HAZIRLANIYOR", { exact: true })).toHaveCount(0);
  await expect(sevkSatiri.getByText("HAZIRLANIYOR", { exact: false })).toHaveCount(0);
  await expect(sevkSatiri.getByText("Hazırlanıyor", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await sevkSatiri.getByRole("button", { name: "Yola çıkar" }).click();
  await expect(sevkSatiri.getByText("Yolda", { exact: true })).toBeVisible();
});
