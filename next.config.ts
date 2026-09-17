import type { NextConfig } from "next";

// Servis çalışanı, yeni derlemeyi eski statiklerden ayırt etmek için benzersiz
// bir kimlik kullanır. NEXT_PUBLIC_BUILD_ID dışarıdan verilmezse her derleme
// için benzersiz bir değer üretilir; böylece yeni önbellek adı eski sürümleri
// otomatik olarak geçersiz kılar (README'de belgelenen davranış gerçekleşir).
const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? `build-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const nextConfig: NextConfig = {
  // Docker/konteyner dağıtımları için kendi kendine yeten çıktı.
  output: "standalone",
  devIndicators: false,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  // Playwright ve yerel cihaz testleri 127.0.0.1 üzerinden bağlanabildiği için
  // geliştirme HMR uç noktasına bu origin'i açıkça tanımlıyoruz.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=()" },
          // Üretimde TLS zorunlu kılınır. Yerel/deneme dağıtımları için değersizdir.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          // Servis çalışanı betiği hiçbir çerçevede gömülmemelidir.
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;