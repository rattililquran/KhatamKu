// sw.js — KhatamKu Service Worker
// Strategi: Cache-first untuk aset statis, Network-first untuk API

const CACHE_NAME = 'khatamku-v36';
const BASE = '/KhatamKu';
const STATIC_EXTERNAL_HOSTS = new Set([
  'cdnjs.cloudflare.com',
  'cdn.jsdelivr.net',
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'static.qurancdn.com',
]);

function cacheNetworkResponse(request, response, allowOpaque = false) {
  const cacheable = response.ok && response.status !== 206 || allowOpaque && response.type === 'opaque';
  if (!cacheable) return Promise.resolve(response);
  return caches.open(CACHE_NAME)
    .then(cache => cache.put(request, response.clone()))
    .catch(() => {})
    .then(() => response);
}

// Aset yang di-cache saat install (app shell)
const PRECACHE_URLS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/reader.html',
  BASE + '/api.supabase.js',
  BASE + '/potret-content.js',
  BASE + '/manifest.json',
  BASE + '/icons/khatamku-mark.svg',
  BASE + '/icons/icon-192.png',
  BASE + '/icons/icon-512.png',
  // Dzikir & Doa (konten statis + font Arab) — agar bisa dibuka offline
  BASE + '/dzikir/morning-dhikr.json',
  BASE + '/dzikir/evening-dhikr.json',
  BASE + '/dzikir/daily-dua.json',
  BASE + '/dzikir/_index.json',
  BASE + '/fonts/amiri-arabic.woff2',
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
        keys.filter(k => k.startsWith('khatamku-') && k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: strategi berdasarkan URL ─────────────────────────────
self.addEventListener('fetch', event => {
  // Hanya tangani GET; POST/PATCH (Supabase RPC/auth) dibiarkan lewat ke jaringan apa adanya
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const externalStaticAsset = url.hostname !== self.location.hostname &&
    STATIC_EXTERNAL_HOSTS.has(url.hostname) &&
    ['font', 'script', 'style'].includes(event.request.destination) &&
    !event.request.headers.has('authorization');

  // Hanya aset statis CDN yang boleh masuk cache; API eksternal berisi data pengguna.
  if (externalStaticAsset) {
    event.respondWith(
      fetch(event.request)
        .then(res => cacheNetworkResponse(event.request, res, true))
        .catch(() => caches.match(event.request))
    );
    return;
  }
  if (url.hostname !== self.location.hostname) return;

  // Halaman dan kode aplikasi harus mengecek jaringan lebih dulu agar rilis
  // baru tidak tertahan cache lama. Cache tetap dipakai sebagai fallback offline.
  if (event.request.mode === 'navigate' || /\.(?:html|js|css)$/.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(res => {
          if (!res.ok) return res;
          return cacheNetworkResponse(event.request, res);
        })
        .catch(err => caches.match(event.request, { ignoreSearch: event.request.mode === 'navigate' })
          .then(cached => cached || Promise.reject(err)))
    );
    return;
  }

  // Aset lokal lain (data, ikon, font) → Cache-first untuk dukungan offline.
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(res => cacheNetworkResponse(event.request, res));
    })
  );
});
