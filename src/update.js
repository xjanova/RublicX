// Service worker registration + auto-update polling.
// On a new release, the page receives an `update available` signal and dispatches
// `rublicx-update-available` so the Profile screen can render an "Update now" CTA.
//
// Strategy:
//   1) On load, register /sw.js
//   2) Every 5 minutes, ping /version.json (a build artifact). If its version differs
//      from the currently running version, fire the update event.
//   3) Also listen for `controllerchange` (new SW took control) to fire the same event.

const VERSION = (typeof __APP_VERSION__ !== 'undefined') ? __APP_VERSION__ : 'dev';

export function registerUpdates() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (location.protocol === 'http:' && location.hostname !== 'localhost') return;

  window.addEventListener('load', async () => {
    try {
      const swUrl = `${import.meta.env.BASE_URL || '/'}sw.js`;
      const reg = await navigator.serviceWorker.register(swUrl);
      // Fire update event immediately if we already control a different cached SW
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('rublicx-update-available'));
          }
        });
      });

      // Poll for updates every 5 minutes
      setInterval(() => reg.update().catch(() => {}), 5 * 60 * 1000);

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.dispatchEvent(new CustomEvent('rublicx-update-available'));
      });
    } catch (err) {
      // SW unavailable — fall back to version.json polling
      console.warn('SW register failed', err);
    }

    // Cross-check by fetching version.json (works even if SW failed)
    setInterval(async () => {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL || '/'}version.json?ts=${Date.now()}`, { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (j.version && j.version !== VERSION) {
          window.dispatchEvent(new CustomEvent('rublicx-update-available', { detail: j }));
        }
      } catch {}
    }, 5 * 60 * 1000);
  });
}
