// RublicX service worker — production-grade auto-update.
//
// Strategy:
//   • VERSION_CACHE  — versioned bucket holding HTML/manifest/sw/version.json. Replaced on each release.
//   • IMMUTABLE_CACHE — hashed asset bucket (Vite emits filenames like `index-abc123.js`).
//                       These are content-addressed so we cache them forever and never revalidate.
//
// Lifecycle:
//   install   → precache shell into VERSION_CACHE, self.skipWaiting() so we don't wait for tabs to close.
//   activate  → drop all caches not matching the current VERSION_CACHE; clients.claim() so we control
//              already-open pages immediately. Broadcast `activated` to clients with the new version.
//   fetch     → for navigations and root assets, use network-first with offline fallback to cached HTML.
//              For hashed assets in `/assets/`, use cache-first (they never change).
//   message   → SKIP_WAITING is supported so the page can force-promote a waiting worker.
//
// The version is injected at build time by vite.config.js (replaces self.__RUBLICX_VERSION__).

const VERSION = self.__RUBLICX_VERSION__ || 'dev';
const VERSION_CACHE = `rublicx-shell-${VERSION}`;
const IMMUTABLE_CACHE = `rublicx-assets`;

// Things to precache so the app is usable on first offline open
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './version.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION_CACHE);
    await Promise.all(SHELL_ASSETS.map((u) =>
      fetch(u, { cache: 'reload' }).then((r) => r.ok && cache.put(u, r.clone())).catch(() => {})
    ));
    // Don't wait for old tabs to close — promote this worker immediately.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k !== VERSION_CACHE && k !== IMMUTABLE_CACHE)
        .map((k) => caches.delete(k))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach((c) => c.postMessage({ type: 'sw:activated', version: VERSION }));
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Hashed Vite assets: cache-first forever (filenames change on every build).
  if (url.pathname.includes('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(IMMUTABLE_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // version.json: network-first, no cache fallback (we only need fresh data here).
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req, { cache: 'no-store' });
        if (res && res.status === 200) {
          const cache = await caches.open(VERSION_CACHE);
          cache.put(req, res.clone());
        }
        return res;
      } catch {
        const cache = await caches.open(VERSION_CACHE);
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  // HTML / shell / other root files: network-first, fall back to cache, finally to index.html.
  event.respondWith((async () => {
    const cache = await caches.open(VERSION_CACHE);
    try {
      const res = await fetch(req);
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    } catch {
      const hit = await cache.match(req);
      if (hit) return hit;
      const fallback = await cache.match('./index.html') || await cache.match('./');
      if (fallback) return fallback;
      return Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data) return;
  if (data === 'SKIP_WAITING' || data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'sw:version', version: VERSION });
  }
});
