// Zero-dependency offline Service Worker for Autónomo Simulator.
// Build-time precache manifest & version hash are injected into dist/sw.js by vite.config.ts.

const CACHE_VERSION = "__AUTONOMO_SW_VERSION__";
const CACHE_PREFIX = "autonomo-sim-";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const PRECACHE_URLS = /* __AUTONOMO_PRECACHE_MANIFEST__ */ [
  "./",
  "./index.html",
  "./manifest.webmanifest",
];

function resolveScopeUrl(relPath) {
  return new URL(relPath, self.registration.scope).toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const urls = PRECACHE_URLS.map(resolveScopeUrl);
      const batchSize = 12;

      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(async (url) => {
            const response = await fetch(url);
            if (response.ok && response.status === 200) {
              await cache.put(url, response);
            }
          }),
        );
      }

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((staleKey) => caches.delete(staleKey)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch {
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (requestUrl.pathname.endsWith("/sw.js")) {
    return;
  }

  const isNavigation = request.mode === "navigate" || request.destination === "document";

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.ok && networkResponse.type === "basic") {
            const cache = await caches.open(CACHE_NAME);
            void cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cache = await caches.open(CACHE_NAME);
          const cachedDoc =
            (await cache.match(request)) ||
            (await cache.match(resolveScopeUrl("./index.html"))) ||
            (await cache.match(resolveScopeUrl("./")));
          return cachedDoc || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) {
        return cached;
      }

      try {
        const networkResponse = await fetch(request);
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          void cache.put(request, networkResponse.clone());
        }
        return networkResponse;
      } catch {
        return Response.error();
      }
    })(),
  );
});
