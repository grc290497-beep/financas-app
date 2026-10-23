// Only job: when a page can't load (no signal), show /offline.html instead of
// the browser's error page. Everything else goes straight to the network, so
// the app never shows stale data.
const CACHE = "financas-offline-v1";
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