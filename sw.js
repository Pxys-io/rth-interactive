const CACHE = 'econtour-v2';
const STATIC = [
    '/',
    '/index.html',
    '/case.html',
    '/db.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    '/all_cases.json',
    '/assets/jquery-3.5.1.min.js',
    '/assets/cornerstone.js',
    '/assets/cornerstoneMath.js',
    '/assets/cornerstoneTools.js',
    '/assets/cornerstoneWebImageLoader.js',
    '/assets/hammerjs.js',
    '/assets/underscore-min.js'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(STATIC))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', e => {
    const url = new URL(e.request.url);
    if (url.origin !== location.origin) return;

    const path = url.pathname;

    // HTML pages - network first, cache fallback
    if (path === '/' || path === '/index.html' || path === '/case.html') {
        e.respondWith(
            fetch(e.request)
                .then(r => { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); return r; })
                .catch(() => caches.match(e.request))
        );
        return;
    }

    // Images (CT, overlays) - cache first
    if (/\.(jpg|jpeg|png|gif|webp)$/i.test(path)) {
        e.respondWith(
            caches.match(e.request)
                .then(cached => {
                    if (cached) return cached;
                    return fetch(e.request).then(r => {
                        if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); }
                        return r;
                    }).catch(() => new Response('', { status: 404, statusText: 'Not Found' }));
                })
        );
        return;
    }

    // JSON data (case metadata, regions, contours) - cache first
    if (path.endsWith('.json') || path.startsWith('/cases/')) {
        e.respondWith(
            caches.match(e.request)
                .then(cached => {
                    if (cached) return cached;
                    return fetch(e.request).then(r => {
                        if (r.ok) { const c = r.clone(); caches.open(CACHE).then(cache => cache.put(e.request, c)); }
                        return r;
                    });
                })
        );
        return;
    }

    // Everything else - cache first, network fallback
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});
