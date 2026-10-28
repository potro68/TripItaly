// 687 Italy - Service Worker V1.14.12 (web/Android)
// Guardian push notifications only. It does NOT intercept page loads any more:
// the app always opens straight from the network (faster start, no white screen).

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith("687-italy-")).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_) {
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "687 Trip Guardian";
  const requestedTarget = String(payload.target || "").toLowerCase();
  const target = ["today", "now", "prevent", "guardian", "signals", "rescue"].includes(requestedTarget)
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
  const target = String(event.notification?.data?.target || "guardian").toLowerCase();
  const desiredUrl = event.notification?.data?.url || `/?guardian=${encodeURIComponent(target)}`;

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windowClients) {
      try {
        const u = new URL(client.url);
        if (u.origin === self.location.origin) {
          await client.focus();
          client.postMessage({ type: "687-guardian-open", target });
          return;
        }
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(desiredUrl);
  })());
});
