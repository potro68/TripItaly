// 68T Italy Service Worker
// Caches the "app shell" (the app itself, plus React/Babel and icons) so the
// app can still OPEN without an internet connection. This is separate from
// the in-app "Offline essentials" feature, which handles trip DATA offline —
// this handles the app itself loading offline.
//
// Live data (flights, hotels, weather, translate, Nearby, maps) always needs
// real internet and is intentionally NOT cached here — those already have
// their own honest "couldn't reach..." messages built into the app.

const CACHE_NAME = "68t-italy-shell-v1";

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
  const isAppShellRequest = APP_SHELL_URLS.some((shellUrl) =>
    event.request.url.endsWith(shellUrl) || event.request.url === shellUrl
  );

  // Only intervene for the app shell itself — everything else (API calls,
  // fonts, maps, translations) goes straight to the network as normal.
  if (!isAppShellRequest) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
