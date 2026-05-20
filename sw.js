// sw.js — KhatamKu Service Worker v6
// Strategi: Network-first untuk index.html, Cache-first untuk aset statis

const CACHE_NAME = 'khatamku-v7';
const BASE = '/KhatamKu';

// Aset yang di-cache saat install (BUKAN index.html)
const PRECACHE_URLS = [
  BASE + '/api.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: hapus cache lama ───────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Apps Script API → selalu Network, tidak pernah cache
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
  //    Selalu ambil versi terbaru dari server
  if (url.pathname === BASE + '/' || url.pathname === BASE + '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          // Simpan versi terbaru ke cache sebagai fallback offline
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request)) // offline fallback
    );
    return;
  }

  // 3. CDN eksternal (Tailwind, FontAwesome, Google Fonts)
  //    Network-first, fallback cache
  if (url.hostname !== self.location.hostname) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 4. Aset lokal lain (api.js, icons, manifest) → Cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return res;
      });
    })
  );
});
