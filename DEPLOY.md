# Deploy & Auto-Release Setup

The repo is pushed and **GitHub Pages is already enabled with `build_type: workflow`**. The CI workflow file (`.github/workflows/deploy.yml`) is committed locally but **not yet pushed** because the current `gh` CLI token doesn't carry the `workflow` OAuth scope (GitHub blocks pushes that create or modify workflow files unless that scope is granted).

## One-time finish (≈ 30 seconds)

Run these three commands in PowerShell from the repo root (`D:\Code\App\RublicX`):

```powershell
gh auth refresh -s workflow
git push origin main
```

The first command opens a browser tab and asks GitHub to grant the `workflow` scope to the gh CLI — click *Authorize*. The second push will then succeed and the workflow file lands on `main`.

GitHub immediately runs the workflow:

1. **build** — installs deps, runs `npm run build` with the version `package.version + short SHA` and `base = /RublicX/`, uploads the Pages artifact.
2. **deploy** — publishes `dist/` to https://xjanova.github.io/RublicX/.
3. **release** — zips `dist` as `rublicx-<version>.zip` and creates a GitHub Release tagged `v<version>` with that asset attached.

You can watch it live with:

```powershell
gh run watch
```

## Auto-update inside the app (production-grade — installs over each other)

Once deployed, every running client receives new releases automatically:

1. **Service worker registers** at `/RublicX/sw.js` with `updateViaCache: 'none'` so the SW file itself is never cached. Two cache buckets:
   - `rublicx-shell-<version>` — HTML, manifest, icon, sw, version.json. Replaced on each release.
   - `rublicx-assets` — Vite hashed asset bundles (`/assets/*-<hash>.js`). Cache-first forever; safe because filenames change every build.
2. **Polls every 60 seconds** + on tab focus, `online`, and `visibilitychange` — calls `registration.update()` to fetch a new SW. Also fetches `/RublicX/version.json?ts=<now>` as a redundant signal.
3. **New SW found** → installs in the background → `installed` state with an existing controller present means an **upgrade** is waiting → page fires `rublicx-update-available`.
4. **UpdateBanner overlay** appears at the top with a 5-second countdown progress bar:
   - Auto-applies when the timer hits 0 by posting `{type: 'SKIP_WAITING'}` to the waiting worker.
   - User can tap **Update now** to apply immediately, or **Later** to dismiss for the session.
5. The waiting worker calls `self.skipWaiting()` → `self.clients.claim()` → page receives `controllerchange` → single guarded `location.reload()` → fresh worker controls all tabs, old caches purged in `activate`.

End result: **every push to `main` → all open clients install the new build within ~60s with one short banner, no manual download.** Works offline-first; if a user opens the app with no network the previous build runs from cache.

### PWA install ("Add to Home Screen")

`manifest.webmanifest` declares `display: standalone`. On iOS Safari → Share → *Add to Home Screen*; on Chrome/Edge → install prompt or address-bar icon. Once installed the app launches in standalone mode (no browser chrome) and still receives auto-updates the same way — when the user reopens it, the SW polls and shows the banner.

Manifest also defines two shortcuts (`?tab=scan` and `?tab=timer`) so long-press on the home-screen icon jumps directly to those tabs.

## How auto-release ties into git

Every push to `main` re-runs the same workflow:

- A new SHA → new `VITE_APP_VERSION` → new `version.json` → existing clients see "Update available" within 5 minutes.
- A new tagged Release is created (or, if the tag exists, the asset is replaced via `gh release upload --clobber`).

To cut a "real" version bump, bump `package.json`'s `version` field and push — the resulting tag becomes `v<package.version>+<sha>`.
