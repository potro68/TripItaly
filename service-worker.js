// 687 Italy — canonical Service Worker V1.13.6E
// Single worker for app shell + Guardian push.
// Online-first for app.html/manifest. Offline fallback to last good copy.

const CACHE_NAME = "687-italy-shell-v1136e";

const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/app.html",
  "/manifest.json",
  "/privacy.html",
  "/terms.html",
  "/support.html",
  "/icons/68t_italy_192.png",
  "/icons/68t_italy_512.png",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/@babel/standalone/babel.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // A single unavailable CDN/static resource must not abort SW installation.
    await Promise.all(
      APP_SHELL_URLS.map(async (url) => {
        try {
          await cache.add(url);
        } catch (_) {}
      })
    );

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();

    // Delete only legacy caches belonging to 687 Italy.
    await Promise.all(
      names
        .filter((name) => name.startsWith("687-italy-") && name !== CACHE_NAME)
        .map((name) => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  if (
    url.origin === self.location.origin &&
    (["/", "/index.html", "/app.html", "/manifest.json"].includes(url.pathname))
  ) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);

      try {
        const request = new Request(event.request, { cache: "no-store" });
        const response = await fetch(request);

        if (response && response.ok) {
          try { await cache.put(event.request, response.clone()); } catch (_) {}
        }

        return response;
      } catch (err) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  const isStaticShell = APP_SHELL_URLS.some(
    (shellUrl) =>
      event.request.url === shellUrl ||
      event.request.url.endsWith(shellUrl)
  );

  if (!isStaticShell) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;

    const response = await fetch(event.request);

    if (response && response.ok) {
      try { await cache.put(event.request, response.clone()); } catch (_) {}
    }

    return response;
  })());
});

// Guardian push support.
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "687 Trip Guardian";
  const requestedTarget = String(payload.target || "").toLowerCase();
  const target = ["today","now","prevent","guardian","signals","rescue"].includes(requestedTarget)
    ? requestedTarget
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
