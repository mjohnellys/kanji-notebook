// Kanji Notebook service worker: works offline after the first visit.
const VERSION = 'kn-v2';
const CORE = ['./', './index.html', './data.json', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const STROKES = Array.from({ length: 30 }, (_, i) => `./strokes/s${String(i).padStart(2, '0')}.json`);

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(VERSION);
    await c.addAll(CORE);
    // stroke files are nice-to-have; don't fail install if one misses
    await Promise.all(STROKES.map(u => c.add(u).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k);
    self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!sameOrigin && !isFont) return;
  // app page: network first so updates arrive, cache when offline
  if (sameOrigin && (req.mode === 'navigate' || url.pathname.endsWith('index.html'))) {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        const c = await caches.open(VERSION); c.put('./index.html', res.clone());
        return res;
      } catch (err) {
        return (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }
  // everything else: cache first, then network (and store it)
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok || res.type === 'opaque') { const c = await caches.open(VERSION); c.put(req, res.clone()); }
      return res;
    } catch (err) {
      return Response.error();
    }
  })());
});
