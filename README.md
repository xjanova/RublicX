# RublicX — Master the Cube

Mobile-first web app that teaches you how to solve Rubik's cubes (2×2 and 3×3 today; 4×4/5×5 visualization in progress). Built with **React + Three.js** so the cube renders, animates, and solves entirely on-device.

> **Live demo:** https://xjanova.github.io/RublicX/
>
> Open on a phone for the iPhone-shell layout; on desktop you'll see the device frame.

## Features

- **3D cube renderer** (Three.js via `@react-three/fiber`) — drag-to-rotate, smooth face-rotation animation, renders any N×N×N from 2×2 up to 5×5 (rendering only; solving is 2×2/3×3 today).
- **Camera scanner** — `getUserMedia` capture, per-cell RGB sampling, **k-means clustering in CIELAB** with auto white-balance for robust sticker color identification. Currently exposed for 2×2 and 3×3.
- **Real Kociemba two-phase solver** — uses the [`cubejs`](https://www.npmjs.com/package/cubejs) implementation of Herbert Kociemba's two-phase algorithm. Always returns a solution in **≤22 moves** for any valid 3×3 sticker state, in 1–50 ms once pruning tables are built (~1.5 s warm-up on first solve, kicked off on app start). When the cube was scrambled inside the app, the exact inverse is returned instantly. The 2×2 path uses bounded IDA*. **Failure modes are surfaced honestly**: invalid scan / wrong sticker counts → "Scan incomplete" with a Rescan CTA; solver still warming up → "Warming up solver…"; never a fake "demo" sequence presented as the user's solution.
- **Method-based learning** — a curated CFOP walkthrough plus a small library of common F2L / OLL / PLL algorithms. The Method tab is labeled clearly as a generic walkthrough, not as the solution to your specific cube.
- **Speed timer** — hold-to-ready, scramble generator, last-12 sparkline, persistent local history. New users start with an empty history (no fake seed times).
- **Real profile** — XP / level / streak / best time / total solves / algs viewed are all sourced from real local activity (`lib/stats.js`), not hardcoded. New users see Lv. 1, 0 solves, 0-day streak. Achievements (Sub-30, Sub-20, Sub-15, 3- and 7-day streaks, 10/50 solves, 10 algs viewed, full library) unlock from real predicates.
- **Bilingual** — Thai (IBM Plex Sans Thai) / English (Inter), instant toggle.
- **Auto-update** — service worker checks for new builds every 5 minutes; the Profile screen surfaces an "Update now" button when one is available.
- **Auto-release** — every push to `main` builds, deploys to GitHub Pages, and creates a tagged GitHub Release with a versioned zip of the build.

## What's not yet shipped

To stay honest about the gap between the demo and a finished product:

- **4×4 / 5×5 solving.** The 3D renderer handles any N, and the Scan tab will eventually scan 4×4/5×5, but a real reduction-method solver isn't wired yet. Those sizes are intentionally hidden from the Scan size selector; turning them back on without a solver would lead the user through six faces of scanning only to land on "Size not yet supported."
- **Full OLL/PLL libraries.** The Learn tab counts the algorithms it actually contains rather than claiming the full 57 OLL / 21 PLL. Expanding the library is straightforward — add entries to `TUTORIAL_ALGS` in `src/lib/solver.js` and the counts on the Lessons screen update automatically.

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
    solver.js               # Public solve API + 2×2 IDA* + tutorial alg library
    kociemba.js             # 3×3 Kociemba two-phase wrapper (cubejs)
    solver-shared.js        # Shared move-sequence optimization helpers
    stats.js                # Real persistent stats (XP, streaks, achievements)
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

`solveCube(cube, options)` is the public entry point. Logic in `src/lib/solver.js`:

1. **App-generated scramble path.** When a `history` of in-app moves is supplied, the solver inverts and optimizes it (always optimal, sub-millisecond).
2. **Kociemba path (3×3, scanned cubes).** `src/lib/kociemba.js` wraps `cubejs`. We convert this app's face/sticker model to the canonical 54-character facelet string (`U R F D L B`, row-major), call `Cube.fromString(facelet).solve()`, and parse the resulting move string back into our internal `{face, dir, label}` move format. Pruning tables are built lazily; `warmupKociemba()` is invoked from `main.jsx` on idle so first solves don't block.
3. **2×2 path.** Direct iterative-deepening A* (the state space is small enough that no pruning table is required).
4. **Honest failure.** If the sticker counts don't validate, or the solver returns no solution, `solveCube` returns `{ moves: [], method: 'unsolved'|…, error: <kind> }`. The Solver screen renders a specific message per `error` kind ("Scan incomplete" / "Warming up" / "Could not solve") plus a Rescan CTA — never a fake CFOP demo presented as the user's actual solution.

## Color detection notes

The scanner samples a 60% inner box of each grid cell, converts to CIELAB, then runs k-means initialized at the standard cube colors over the 6×N² collected samples. After clustering it computes the offset between the white centroid and standard white (auto WB) and re-snaps each sticker. This handles warm/cool lighting and slightly off-white stickers reliably.

## Credits

- Design tokens, screens, i18n strings ported 1:1 from the `rublicx.zip` design handoff (high-fidelity React/JSX prototypes).
- 3D rendering on `three.js` + `@react-three/fiber`.
- Cube colors follow the WCA standard.

## License

MIT — see `LICENSE`.
