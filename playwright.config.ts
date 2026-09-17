import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // Kurulum senaryosu bilinçli olarak boş veritabanıyla başlar ve işlem
  // sırasında o veritabanını doldurur. Aynı veriyi yeniden kullanacak bir
  // otomatik tekrar denemesi yanlış negatif üretir; her CI çalışması zaten
  // ayrı PostgreSQL servisiyle başlatılır.
  retries: 0,
  use: { baseURL: "http://127.0.0.1:3066", trace: "retain-on-failure" },
  webServer: {
    // Küresel paket yöneticisinin Windows başlangıç gecikmesini test
    // altyapısına taşımamak için Next CLI doğrudan Node ile çalıştırılır.
    command: "node ./node_modules/next/dist/bin/next dev -p 3066",
    url: "http://127.0.0.1:3066/giris",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
