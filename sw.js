// Diário de Macros — service worker (offline app shell)
const CACHE = "macros-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the AI calls (Gemini / Anthropic / proxy) — always go to network.
  if (/generativelanguage\.googleapis\.com|api\.anthropic\.com/.test(url.href)) return;

  // Google Fonts: cache-first, store for offline.
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.href)) {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match(req).then((hit) =>
          hit || fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit)
        )
      )
    );
    return;
  }

  // App shell & same-origin: cache-first, fall back to network, then to cached page.
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (url.origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"))
    )
  );
});
