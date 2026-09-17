// Filbert PWA Service Worker — Çoklu strateji cache router
// Sürüm, kayıt sırasında URL'ye eklenen derleme kimliğinden türetilir. Manuel
// sürüm artırmayı unutmak eski statik varlıkların sonsuza dek servis edilmesine
// yol açmaz: yeni derleme kimliği yeni önbellek adı üretir ve eskileri temizlenir.
const VERSION = "filbert-sw-" + (new URL(self.location.href).searchParams.get("v") || "dev");
const STATIC_CACHE = VERSION + "-static";
const API_CACHE = VERSION + "-api";
const PAGE_CACHE = VERSION + "-pages";
const IMAGE_CACHE = VERSION + "-images";

const PRECACHE_URLS = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// İlgili yanıt `Cache-Control: no-store` taşıyorsa asla önbelleğe alınmaz.
// Ses kayıtları, müşteri arama sonuçları ve diğer özel veriler bu yüzden Cache
// Storage'a yazılmaz; başka bir oturum/kullanıcı diskten okuyamaz.
function onbellegeAlinabilirMi(response) {
  const kontrol = response.headers ? response.headers.get("cache-control") || "" : "";
  return response.status === 200 && !/no-store/i.test(kontrol);
}

async function networkFirst(request, cacheName, fallback) {
  try {
    const response = await fetch(request);
    if (!response.ok) return response;
    if (onbellegeAlinabilirMi(response)) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallback) return caches.match(fallback);
    throw new Error("Offline ve cache bos");
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (onbellegeAlinabilirMi(response)) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // API istekleri: Network-first, offline'da son basarili yanit
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  // Sayfa HTML: Network-first, offline'da precache "/" goster
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE, "/"));
    return;
  }

  // Statik varliklar (JS/CSS/font): Cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Gorseller: Stale-while-revalidate
  if (/\.(png|jpg|jpeg|svg|ico|webp)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }
});
