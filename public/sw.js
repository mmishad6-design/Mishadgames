const CACHE_NAME = "mishads-ludo-shell-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/ludo-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (url) => {
      try { await cache.add(url); } catch { /* A single optional shell file must not block installation. */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("mishads-ludo-") && key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API, authentication, or realtime endpoints. Online rooms still need a live connection.
  if (/^\/(rest\/v1|auth\/v1|realtime\/v1|functions\/v1)(\/|$)/.test(url.pathname)) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response.clone());
          await cache.put("/", response.clone());
          await cache.put("/index.html", response.clone());
        }
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match("/")) || (await cache.match("/index.html")) || Response.error();
      }
    })());
    return;
  }

  // Vite's fingerprinted production assets are safe to cache for offline play.
  if (url.pathname.startsWith("/assets/") || /\.(?:js|css|svg|png|jpe?g|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return Response.error();
      }
    })());
  }
});
