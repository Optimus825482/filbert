import { expect, test } from "@playwright/test";

test("oturumsuz kullanıcı korumalı ekrandan girişe yönlendirilir", async ({ page }) => {
  await page.goto("/finans");
  await expect(page).toHaveURL(/\/giris$/);
  await expect(page.getByRole("heading", { name: "Tarım ticaretinin operasyon merkezi." })).toBeVisible();
});

test("geçersiz veya süresi dolmuş oturum çerezi 500 yerine girişe yönlendirilir", async ({ page, context }) => {
  await context.addCookies([{ name: "filbert_session", value: "gecersiz-oturum", url: "http://127.0.0.1:3066" }]);
  await page.goto("/");
  await expect(page).toHaveURL(/\/giris$/);
});

test("geçersiz oturum çerezi ikincil finans ekranında da 500 üretmez", async ({ page, context }) => {
  await context.addCookies([{ name: "filbert_session", value: "gecersiz-finans-oturumu", url: "http://127.0.0.1:3066" }]);
  const response = await page.goto("/finans");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/giris$/);
});

test("pencere görünümü parametresi oturum denetimini atlamaz", async ({ page }) => {
  const response = await page.goto("/?w=1");
  expect(response?.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/giris$/);
});

test("tüm korumalı çalışma alanı ekranları oturumsuz istekte 500 yerine girişe yönlenir", async ({ page }) => {
  const protectedRoutes = [
    "/", "/alim", "/alim/yeni", "/arama", "/avans", "/ayarlar", "/ayarlar/kurtarma", "/ayarlar/roller",
    "/banka", "/cari", "/cari/gecersiz-kayit", "/cari/hesaplar", "/emanet", "/finans", "/finans-taslaklari",
    "/finans/odeme", "/findik-islemleri", "/fiyatlar", "/kar-zarar", "/kasa", "/masraf", "/mod/finans",
    "/mod/findik", "/mod/musteri", "/mod/rapor", "/platform", "/platform/gecersiz/yetkiler",
    "/randiman", "/raporlar", "/satis", "/satis/yeni", "/sesli-not", "/sevk-yeni", "/sevkiyat", "/stok",
    "/tahsilat", "/virman",
  ];

  for (const route of protectedRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), `${route} beklenmeyen sunucu hatası verdi`).toBeLessThan(500);
    await expect(page, `${route} girişe yönlenmedi`).toHaveURL(/\/giris$/);
  }
});

test("setup doğrudan açılmaz", async ({ page }) => {
  await page.goto("/setup");
  await expect(page).toHaveURL(/\/giris$/);
});

test("yetkisiz bilgilendirme ekranı oturum olmadan da erişilebilir", async ({ page }) => {
  await page.goto("/yetkisiz");
  await expect(page.getByRole("heading", { name: "Bu ekrana erişim yetkiniz yok" })).toBeVisible();
});

test("PWA manifesti ve servis çalışanı yönlendirme olmadan sunulur", async ({ request }) => {
  const [manifest, worker] = await Promise.all([
    request.get("/manifest.webmanifest", { maxRedirects: 0 }),
    request.get("/sw.js", { maxRedirects: 0 }),
  ]);

  expect(manifest.status()).toBe(200);
  expect(worker.status()).toBe(200);
  expect(worker.headers()["content-type"]).toContain("javascript");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["x-content-type-options"]).toBe("nosniff");
  expect(worker.headers()["x-frame-options"]).toBe("DENY");
});

test("PWA kurulum ikonları manifestteki yollarından yönlendirme olmadan yüklenir", async ({ request }) => {
  const manifestResponse = await request.get("/manifest.webmanifest", { maxRedirects: 0 });
  expect(manifestResponse.status()).toBe(200);
  const manifest = await manifestResponse.json() as { icons: Array<{ src: string }> };
  const iconResponses = await Promise.all(manifest.icons.map((icon) => request.get(icon.src, { maxRedirects: 0 })));

  expect(iconResponses).toHaveLength(3);
  for (const response of iconResponses) {
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
});

test("oturumsuz müşteri arama isteği 401 ile biter", async ({ request }) => {
  const response = await request.get("/api/cari-ara?q=er", { maxRedirects: 0 });
  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ hata: "Oturum açmanız gerekiyor" });
});

test("oturumsuz offline eşitleme isteği gövdeyi işlemeden 401 ile biter", async ({ request }) => {
  const response = await request.post("/api/offline-sync", { data: "bozuk-json", headers: { "content-type": "application/json" } });
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  await expect(response.json()).resolves.toEqual({ hata: "Oturum açmanız gerekiyor" });
});

test("oturumsuz ses kaydı isteği 401 ile biter", async ({ request }) => {
  const response = await request.get("/api/sesli-not/gecersiz/ses-kaydi");
  expect(response.status()).toBe(401);
});
