# RublicX — Master the Cube

Mobile-first web app that teaches you how to solve Rubik's cubes — beginner 2×2 up to 5×5, including pro and "secret" techniques. Built with **React + Three.js** so the cube renders, animates, and solves entirely on-device.

> **Live demo:** https://xjanova.github.io/RublicX/
>
> Open on a phone for the iPhone-shell layout; on desktop you'll see the device frame.

## Features

- **3D cube renderer** (Three.js via `@react-three/fiber`) — drag-to-rotate, smooth face-rotation animation, supports any N×N×N from 2×2 up to 5×5.
- **Camera scanner** — `getUserMedia` capture, per-cell RGB sampling, **k-means clustering in CIELAB** with auto white-balance for robust sticker color identification.
- **On-device solver** — IDA* search with cancellation pruning for shallow scrambles; LBL fallback for any valid 3×3 state. When the cube was scrambled inside the app, the inverse solution is returned instantly.
- **Method-based teaching** — curated CFOP / OLL / PLL algorithms with side-by-side animated playback.
- **Speed timer** — hold-to-ready, scramble generator, last-12 sparkline, persistent local history.
- **Profile** — XP, weekly goal ring, achievements, language toggle, version + auto-update CTA.
- **Bilingual** — Thai (IBM Plex Sans Thai) / English (Inter), instant toggle.
- **Auto-update** — service worker checks for new builds every 5 minutes; the Profile screen surfaces an "Update now" button when one is available.
- **Auto-release** — every push to `main` builds, deploys to GitHub Pages, and creates a tagged GitHub Release with a versioned zip of the build.

## Quick start

```bash
npm install
npm run dev   # http://localhost:5173
npm run build # produces ./dist
```

## Project layout

```
src/
  App.jsx                   # Tab navigation + i18n provider + iOS frame
  main.jsx                  # React root + service worker registration
  styles.css                # Design tokens & global CSS
  theme.js                  # Color tokens (sourced from rublicx.zip handoff)
  i18n.js                   # Thai/English translations + provider
  update.js                 # Auto-update polling
  components/
    Cube3D.jsx              # Three.js renderer (any N×N×N)
    AnimatedCube.jsx        # Sequence player with eased face rotation
    CubeNet.jsx             # 2D unfolded net + thumbnail
    IOSFrame.jsx            # iPhone chrome (status bar, dynamic island, home bar)
    TabBar.jsx              # Floating glass tab bar
    Icons.jsx               # All UI icons
  lib/
    cube.js                 # Cube state model + move primitives + scramble
    solver.js               # IDA* + LBL solver + tutorial alg library
    colorDetect.js          # RGB → LAB + k-means + auto WB
  screens/
    HomeScreen.jsx
    LearnScreen.jsx
    ScanScreen.jsx          # WebRTC camera + 6-face capture
    SolverScreen.jsx        # 3D playback + step controls
    TimerScreen.jsx         # Hold-to-ready timer + scramble + history
    ProfileScreen.jsx       # Identity, language, version, auto-update
public/
  sw.js                     # Service worker (cache-first + version invalidation)
  icon.svg
.github/workflows/deploy.yml  # CI: build → Pages deploy → tagged release
```

## Auto-update internals

1. Each build embeds `__APP_VERSION__` (from `package.json` + commit SHA).
2. Vite emits `dist/version.json` and a versioned `dist/sw.js`.
3. The page polls `version.json` every 5 minutes and listens for `controllerchange` on the SW.
4. When a mismatch is detected the page dispatches `rublicx-update-available`, which the Profile screen renders as an "Update now" button.
5. Hitting Update reloads the page; the new SW takes control and old caches are purged.

## Auto-release & Pages

`.github/workflows/deploy.yml` is triggered on every push to `main`:

1. **build** — install, run `npm run build` with `VITE_APP_VERSION=<package.version>+<short SHA>` and `VITE_BASE_PATH=/RublicX/`, upload Pages artifact.
2. **deploy** — `actions/deploy-pages@v4` publishes to https://xjanova.github.io/RublicX/.
3. **release** — zips `dist/` as `rublicx-<version>.zip` and `gh release create` produces a tagged release; if the tag already exists the asset is uploaded with `--clobber`.

To enable: in GitHub repo Settings → Pages, set "Source" to **GitHub Actions** (one-time).

## Solver notes

For arbitrary scanned cube states the solver runs IDA* with cancellation up to depth 11 (≤2s on a phone for typical cases). Depths beyond that fall through to a structural-distance LBL pass that always finds *a* solution but isn't optimal. For app-generated scrambles the solver returns the exact inverse instantly.

If you want sub-20-move solutions for arbitrary states, swap `lib/solver.js` for a Kociemba two-phase implementation — the public API (`solveCube(cube, options)`) is stable.

## Color detection notes

The scanner samples a 60% inner box of each grid cell, converts to CIELAB, then runs k-means initialized at the standard cube colors over the 6×N² collected samples. After clustering it computes the offset between the white centroid and standard white (auto WB) and re-snaps each sticker. This handles warm/cool lighting and slightly off-white stickers reliably.

## Credits

- Design tokens, screens, i18n strings ported 1:1 from the `rublicx.zip` design handoff (high-fidelity React/JSX prototypes).
- 3D rendering on `three.js` + `@react-three/fiber`.
- Cube colors follow the WCA standard.

## License

MIT — see `LICENSE`.
