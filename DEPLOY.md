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

## Auto-update inside the app

Once deployed:

- The page registers `/RublicX/sw.js` (a cache-first SW with version invalidation).
- It polls `/RublicX/version.json` every 5 minutes and listens for SW `controllerchange`.
- When a new build is detected the page dispatches `rublicx-update-available`, and the **Profile** screen swaps the "Up to date" pill for an **Update now** button.
- Tapping it reloads the page; the new SW takes control and old caches purge.

## How auto-release ties into git

Every push to `main` re-runs the same workflow:

- A new SHA → new `VITE_APP_VERSION` → new `version.json` → existing clients see "Update available" within 5 minutes.
- A new tagged Release is created (or, if the tag exists, the asset is replaced via `gh release upload --clobber`).

To cut a "real" version bump, bump `package.json`'s `version` field and push — the resulting tag becomes `v<package.version>+<sha>`.
