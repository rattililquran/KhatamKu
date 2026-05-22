// sw.js — KhatamKu Service Worker v9
// Network-first untuk index.html, Cache-first untuk aset statis

const CACHE_NAME = 'khatamku-v9';
const BASE = '/KhatamKu';

const PRECACHE_URLS = [
  BASE + '/api.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  BASE + '/assets/tailwind.min.css',
  BASE + '/assets/fontawesome.min.css',
  BASE + '/assets/confetti.min.js',
  BASE + '/assets/webfonts/fa-solid-900.woff2',
  BASE + '/assets/webfonts/fa-regular-400.woff2',
  BASE + '/assets/webfonts/fa-brands-400.woff2',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(() => null))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Apps Script API → selalu Network
  if (url.hostname.includes('script.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({
          ok: false,
          error: 'Kamu sedang offline. Coba lagi saat ada koneksi.'
        }), { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // 2. index.html → Network-first, fallback cache
  if (
    url.pathname === BASE + '/' ||
    url.pathname === BASE + '/index.html' ||
    url.pathname === BASE
  ) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Aset lokal (assets/, icons/) → Cache-first, update background
  if (url.hostname === self.location.hostname) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(res => {
          caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
          return res;
        }).catch(() => null);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // 4. CDN eksternal (Google Fonts) → Network-first, fallback cache
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
