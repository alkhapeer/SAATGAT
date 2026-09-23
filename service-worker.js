/* =========================================================
   Hero Academy — Service Worker
   ========================================================= */

const CACHE_VERSION = "v2";
const CACHE_STATIC  = `hero-static-${CACHE_VERSION}`;
const CACHE_RUNTIME = `hero-runtime-${CACHE_VERSION}`;

/* الملفات الأساسية التي يجب تخزينها مسبقًا */
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/splash-1170x2532.png",
  "./icons/splash-1290x2796.png",
  "./icons/splash-1536x2048.png",
  "./icons/splash-1668x2388.png",
  "./icons/splash-2048x2732.png"
];

/* ============ INSTALL ============ */
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);
      // نستخدم addAll مع تجاهل الأخطاء حتى لا يفشل التثبيت لو نقص ملف
      await Promise.all(
        PRECACHE_ASSETS.map(async (url) => {
          try {
            await cache.add(new Request(url, { cache: "reload" }));
          } catch (err) {
            console.warn("[SW] فشل تخزين:", url, err);
          }
        })
      );
      self.skipWaiting();
    })()
  );
});

/* ============ ACTIVATE ============ */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_STATIC && key !== CACHE_RUNTIME)
          .map((key) => caches.delete(key))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

/* ============ FETCH ============ */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // تجاهل غير GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // تجاهل الطلبات الخارجية (نطاقات أخرى)
  if (url.origin !== self.location.origin) return;

  // طلبات التنقل (HTML) => Network First مع fallback إلى الكاش
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;

          const network = await fetch(request);
          const cache = await caches.open(CACHE_STATIC);
          cache.put("./index.html", network.clone());
          return network;
        } catch (err) {
          const cache = await caches.open(CACHE_STATIC);
          const cached = await cache.match("./index.html");
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  // الملفات الثابتة (CSS/JS/Images) => Cache First مع تحديث في الخلفية
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_STATIC);
      const cached = await cache.match(request);

      const fetchAndUpdate = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached || fetchAndUpdate;
    })()
  );
});

/* ============ MESSAGES ============ */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
