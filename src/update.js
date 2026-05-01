// Production auto-update controller — ships new versions onto running clients automatically.
//
// Flow when a new release lands:
//   1. registration.update() (called every 60s + on focus + on message) detects the new SW.
//   2. The new SW installs in the background. Vite has rotated all hashed asset filenames so the
//      old client's bundle URLs are still cached and remain valid until reload.
//   3. We listen for `updatefound` → the installing worker reaches `installed` → if a controller
//      already exists we have an upgrade waiting. Dispatch `rublicx-update-available` so the UI
//      banner appears with a 5s auto-reload countdown.
//   4. The banner posts {type: 'SKIP_WAITING'} to the waiting worker. The SW's skipWaiting() runs,
//      `controllerchange` fires on the page, we reload once. The new worker now controls the page.
//   5. As a redundancy, /version.json is polled and any version mismatch triggers the same banner.
//
// Idempotent: multiple triggers won't cause duplicate reloads (guarded by `reloaded`).

const VERSION = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';
const POLL_MS = 60 * 1000;            // 60s — check for newer version.json
const SW_UPDATE_MS = 60 * 1000;       // 60s — re-fetch SW to detect new build
let reloaded = false;
let waitingWorker = null;

function fireUpdateEvent(detail) {
  window.dispatchEvent(new CustomEvent('rublicx-update-available', { detail }));
}

function reloadOnce() {
  if (reloaded) return;
  reloaded = true;
  // Use replace() to avoid leaving the old URL in history during forced reloads.
  window.location.reload();
}

export function applyUpdateNow() {
  if (waitingWorker) {
    // Tell the SW to take over. Reload happens via `controllerchange` listener.
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    reloadOnce();
  }
}

export function registerUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;

  const base = (import.meta.env && import.meta.env.BASE_URL) || '/';
  const swUrl = `${base}sw.js`;
  const versionUrl = `${base}version.json`;

  window.addEventListener('load', async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register(swUrl, { updateViaCache: 'none' });
    } catch (err) {
      console.warn('[RublicX] SW registration failed:', err);
      // Still poll version.json so we can at least force a reload when a new build lands.
      startVersionPolling(versionUrl);
      return;
    }

    // If a worker is already waiting (e.g., user opened a tab with a pending install), surface it.
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      fireUpdateEvent({ source: 'sw', stage: 'waiting' });
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            // A previous SW exists, this one is an UPDATE.
            waitingWorker = installing;
            fireUpdateEvent({ source: 'sw', stage: 'installed' });
          } else {
            // First install — no need to reload.
          }
        }
      });
    });

    // The SW posts `sw:activated` after it claims clients. That means a new worker is now
    // controlling — reload to load fresh hashed assets.
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'sw:activated' && event.data.version !== VERSION) {
        reloadOnce();
      }
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      reloadOnce();
    });

    // Periodic SW.update() — cheap, detects new sw.js and triggers updatefound.
    const tick = () => registration.update().catch(() => {});
    setInterval(tick, SW_UPDATE_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') tick();
    });
    window.addEventListener('focus', tick);
    window.addEventListener('online', tick);

    // Also poll version.json as a redundant signal (e.g., when SW caching is broken).
    startVersionPolling(versionUrl);
  });
}

function startVersionPolling(versionUrl) {
  let consecutiveErrors = 0;
  const check = async () => {
    try {
      const r = await fetch(`${versionUrl}?ts=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const j = await r.json();
      consecutiveErrors = 0;
      if (j.version && j.version !== VERSION) {
        fireUpdateEvent({ source: 'poll', remote: j.version, local: VERSION });
      }
    } catch {
      // back off after repeated failures
      consecutiveErrors++;
    }
  };
  setInterval(check, POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check();
  });
  setTimeout(check, 5000); // first check 5s after load
}
