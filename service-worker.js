// 687 Italy Service Worker
// Online: always loads the newest app version.
// Offline: falls back to the last cached working version.

const CACHE_NAME = "687-italy-shell-v2";

const APP_SHELL_URLS = [
  "/app.html",
  "/manifest.json",
  "/icons/68t_italy_192.png",
  "/icons/68t_italy_512.png",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  if (
    url.origin === self.location.origin &&
    (url.pathname === "/app.html" || url.pathname === "/manifest.json")
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  const isStaticShell = APP_SHELL_URLS.some((shellUrl) =>
    event.request.url.endsWith(shellUrl) || event.request.url === shellUrl
  );

  if (!isStaticShell) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
        }
        return response;
      });
    })
  );
});
