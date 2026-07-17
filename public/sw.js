// iCapOS service worker.
//
// Purpose: make the app installable (Chrome requires a service worker with a fetch
// handler and offline capability before it will offer "Install"), WITHOUT caching app
// content — stale-asset bugs are far worse than the small benefit of offline browsing.
//
// It therefore does exactly one thing: if a page navigation fails because the network
// is down, it serves a small offline fallback. Everything else goes straight to the
// network, untouched, exactly as if no service worker existed.

const CACHE = "icapos-offline-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).then(() => self.skipWaiting()),
  );
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
  // Only page navigations are intercepted, and only to provide an offline fallback.
  // API calls, assets and data always hit the network — nothing is served stale.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL)),
  );
});
