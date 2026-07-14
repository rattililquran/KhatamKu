// sw.js — KhatamKu Service Worker
// Strategi: Cache-first untuk aset statis, Network-first untuk API

const CACHE_NAME = 'khatamku-v19';
const BASE = '/KhatamKu';

// Aset yang di-cache saat install (app shell)
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/api.supabase.js',
  BASE + '/manifest.json',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
];

// ── Install: pre-cache app shell ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: hapus cache lama ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategi berdasarkan URL ─────────────────────────────
self.addEventListener('fetch', event => {
  // Hanya tangani GET; POST/PATCH (Supabase RPC/auth) dibiarkan lewat ke jaringan apa adanya
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // CDN eksternal (tailwind, fontawesome, fonts) → Network-first, fallback cache
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

  // Aset lokal (HTML, JS, ikon) → Cache-first
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
