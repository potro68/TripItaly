// 687 Italy Service Worker
// Online: always loads the newest app version.
// Offline: falls back to the last cached working version.

const CACHE_NAME = "687-italy-shell-v3";

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

// Guardian push support — ported from 687 Japan.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "687 Trip Guardian";
  const target = ["today","now","prevent","guardian","signals","rescue"].includes(
    String(payload.target || "").toLowerCase()
  )
    ? String(payload.target).toLowerCase()
    : "guardian";

  const options = {
    body: payload.body || "An important change may affect your day.",
    tag: payload.tag || "687-guardian",
    renotify: !!payload.renotify,
    icon: payload.icon || "/icons/68t_italy_192.png",
    badge: payload.badge || "/icons/68t_italy_192.png",
    data: {
      url: payload.url || `/?guardian=${encodeURIComponent(target)}`,
      target
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const target = String(
    event.notification?.data?.target || "guardian"
  ).toLowerCase();

  const desiredUrl =
    event.notification?.data?.url ||
    `/?guardian=${encodeURIComponent(target)}`;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });

    for (const client of windowClients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          client.postMessage({
            type: "687-guardian-open",
            target
          });
          return;
        }
      } catch (_) {}
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(desiredUrl);
    }
  })());
});
