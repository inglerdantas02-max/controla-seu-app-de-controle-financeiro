// CONTROLA Service Worker
// Versioned cache - bump CACHE_VERSION to invalidate old caches on deploy.
const CACHE_VERSION = "v1";
const RUNTIME_CACHE = `controla-runtime-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  // Activate new SW immediately
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Clear old caches
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Network-first for navigations (always try fresh HTML so users get latest version)
// Cache-first fallback for static assets (hashed by Vite, safe to cache long term)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept Supabase / API / auth callback URLs
  if (url.pathname.startsWith("/~oauth")) return;

  const isNavigation = req.mode === "navigate";

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(RUNTIME_CACHE);
          const cached = await cache.match(req);
          return cached || cache.match("/");
        }
      })()
    );
    return;
  }

  // Static assets: cache-first
  if (/\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        const fresh = await fetch(req);
        if (fresh.ok) cache.put(req, fresh.clone());
        return fresh;
      })()
    );
  }
});

// Listen for messages from the page (e.g. force update)
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
