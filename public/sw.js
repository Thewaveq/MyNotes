// Minimal Service Worker to enable PWA install
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Just pass through requests, no offline caching logic to avoid bugs
    e.respondWith(fetch(e.request));
});