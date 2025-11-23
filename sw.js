const CACHE_NAME = 'anesthesia-app-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/app.css',
  '/app.js',
  '/manifest.json',
  '/螢幕擷取畫面 2025-11-24 013105.png'
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())))
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});