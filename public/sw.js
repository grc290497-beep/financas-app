// Two jobs: when a page can't load (no signal), show /offline.html instead of
// the browser's error page; and show push notifications (/api/cron/notifications).
// Everything else goes straight to the network, so the app never shows stale data.
const CACHE = "financas-offline-v2";
const OFFLINE = ["/offline.html", "/icon/192"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
  } else if (new URL(request.url).pathname === "/icon/192") {
    event.respondWith(fetch(request).catch(() => caches.match("/icon/192")));
  }
});
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Finanças", {
      body: data.body || "",
      icon: "/icon/192",
      badge: "/icon/192",
      lang: "pt-BR",
      data: { url: data.url || "/app" },
    }),
  );
});

// Tapping the notification opens (or focuses) the app on the screen it is about.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/app", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});
