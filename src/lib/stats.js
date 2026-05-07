// Real, persistent user stats for RublicX.
// Everything that used to be hardcoded "demo numbers" in the UI is sourced from here.
//
// Storage shape (localStorage key 'rublicx.stats.v1'):
//   {
//     solves: [{ time: number, scramble: string|null, ts: number }, ...],   // every successful timer solve
//     scrambleSolveCount: number,                                            // solver-completed runs (from Scan or in-app scramble)
//     algsViewed: [string, ...],                                             // distinct algorithm notations the user opened
//     lessonOpens: { [lessonId]: number },                                   // how many times each lesson was opened
//     lessonProgress: { [lessonId]: number },                                // 0..1 per lesson
//     activityDays: [yyyymmdd, ...],                                         // distinct days the user did anything
//     achievementsUnlocked: { [id]: ts },                                    // when each achievement was earned
//     createdAt: number,
//     updatedAt: number,
//   }
//
// All numbers shown to the user are derived from this; nothing is faked.

const KEY = 'rublicx.stats.v1';

const EMPTY_STATE = {
  solves: [],
  scrambleSolveCount: 0,
  algsViewed: [],
  lessonOpens: {},
  lessonProgress: {},
  activityDays: [],
  achievementsUnlocked: {},
  createdAt: 0,
  updatedAt: 0,
};

function safeParse(raw) {
  try {
    const obj = JSON.parse(raw);
    return { ...EMPTY_STATE, ...obj };
  } catch {
    return null;
  }
}

export function loadStats() {
  if (typeof localStorage === 'undefined') return { ...EMPTY_STATE };
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const fresh = { ...EMPTY_STATE, createdAt: Date.now(), updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }
  const parsed = safeParse(raw);
  if (!parsed) {
    const fresh = { ...EMPTY_STATE, createdAt: Date.now(), updatedAt: Date.now() };
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }
  return parsed;
}

function saveStats(state) {
  state.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(state));
  try { window.dispatchEvent(new CustomEvent('rublicx-stats-updated', { detail: state })); } catch {}
}

function dayKey(ts) {
  const d = new Date(ts);
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function markActiveToday(state) {
  const k = dayKey(Date.now());
  if (!state.activityDays.includes(k)) state.activityDays.push(k);
}

// ── Public API ────────────────────────────────────────────────────────────

export function recordSolve(timeSec, scramble = null) {
  const state = loadStats();
  state.solves.push({ time: +timeSec, scramble, ts: Date.now() });
  // Cap stored solves at 500 to keep storage small.
  if (state.solves.length > 500) state.solves = state.solves.slice(-500);
  markActiveToday(state);
  saveStats(state);
  refreshAchievements();
  return state;
}

export function recordScrambleSolveCompleted() {
  const state = loadStats();
  state.scrambleSolveCount += 1;
  markActiveToday(state);
  saveStats(state);
  refreshAchievements();
  return state;
}

export function recordAlgViewed(notation) {
  if (!notation) return;
  const state = loadStats();
  if (!state.algsViewed.includes(notation)) {
    state.algsViewed.push(notation);
  }
  markActiveToday(state);
  saveStats(state);
  refreshAchievements();
  return state;
}

export function recordLessonOpened(lessonId) {
  if (!lessonId) return;
  const state = loadStats();
  state.lessonOpens[lessonId] = (state.lessonOpens[lessonId] || 0) + 1;
  // First open counts as 25% progress; subsequent opens nudge up.
  const cur = state.lessonProgress[lessonId] || 0;
  state.lessonProgress[lessonId] = Math.min(1, Math.max(cur, 0.25 + 0.15 * (state.lessonOpens[lessonId] - 1)));
  markActiveToday(state);
  saveStats(state);
  return state;
}

export function setLessonProgress(lessonId, pct) {
  const state = loadStats();
  state.lessonProgress[lessonId] = Math.max(0, Math.min(1, pct));
  saveStats(state);
  return state;
}

// ── Derived selectors ────────────────────────────────────────────────────

export function bestTime(state = loadStats()) {
  if (!state.solves.length) return null;
  return state.solves.reduce((m, s) => Math.min(m, s.time), Infinity);
}

export function recentSolves(state = loadStats(), n = 12) {
  return state.solves.slice(-n);
}

export function avgOf(state, n) {
  const slice = recentSolves(state, n).map(s => s.time);
  if (slice.length < n) return null;
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

// Streak = number of consecutive days (ending today or yesterday) the user was active.
export function currentStreak(state = loadStats()) {
  if (!state.activityDays.length) return 0;
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86400_000);
  const set = new Set(state.activityDays);
  // Streak must include today or yesterday (else streak is broken).
  let cursor;
  if (set.has(today)) cursor = today;
  else if (set.has(yesterday)) cursor = yesterday;
  else return 0;
  let streak = 1;
  for (let i = 0; i < 400; i++) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    const targetDate = new Date(d.getTime() - (i + 1) * 86400_000);
    const k = targetDate.getFullYear() * 10000 + (targetDate.getMonth() + 1) * 100 + targetDate.getDate();
    if (k === cursor) continue;
    if (set.has(k)) {
      streak += 1;
      cursor = k;
    } else {
      // allow one-day grace if the cursor is "today" and the user just hasn't been active yet
      break;
    }
  }
  return streak;
}

export function totalSolves(state = loadStats()) {
  // Real solves come from the timer + completed solver runs.
  return state.solves.length + state.scrambleSolveCount;
}

export function level(state = loadStats()) {
  // XP curve: ~10 XP per timer solve, 5 per solver run, 3 per distinct alg viewed, 2 per active day.
  const xp = state.solves.length * 10
    + state.scrambleSolveCount * 5
    + state.algsViewed.length * 3
    + state.activityDays.length * 2;
  // Level n requires 50 * n^1.4 cumulative XP.
  let lvl = 1, need = 0;
  while (true) {
    const next = Math.round(50 * Math.pow(lvl + 1, 1.4));
    if (xp < need + next) break;
    need += next;
    lvl += 1;
    if (lvl > 99) break;
  }
  const intoLevel = xp - need;
  const nextLevelCost = Math.round(50 * Math.pow(lvl + 1, 1.4));
  return { xp, level: lvl, progress: nextLevelCost ? intoLevel / nextLevelCost : 1 };
}

export function weeklyGoalProgress(state = loadStats()) {
  // Goal: 7 active days within the last 7. Returns { active, goal, pct }.
  const goal = 7;
  const today = new Date();
  const set = new Set(state.activityDays);
  let active = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const k = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    if (set.has(k)) active += 1;
  }
  return { active, goal, pct: active / goal };
}

// ── Achievements ────────────────────────────────────────────────────────

// Each achievement has a `check(state)` predicate. `refreshAchievements` evaluates them and
// stamps unlocks; the UI only renders an achievement as "earned" if its id appears in
// `state.achievementsUnlocked`.
export const ACHIEVEMENTS = [
  {
    id: 'sub30', icon: '🥉',
    titleEn: 'Sub-30',  titleTh: 'ต่ำกว่า 30s',
    check: (s) => (bestTime(s) ?? Infinity) < 30,
  },
  {
    id: 'sub20', icon: '🥈',
    titleEn: 'Sub-20',  titleTh: 'ต่ำกว่า 20s',
    check: (s) => (bestTime(s) ?? Infinity) < 20,
  },
  {
    id: 'sub15', icon: '🥇',
    titleEn: 'Sub-15',  titleTh: 'ต่ำกว่า 15s',
    check: (s) => (bestTime(s) ?? Infinity) < 15,
  },
  {
    id: 'streak3', icon: '🔥',
    titleEn: '3-day streak', titleTh: 'สตรีค 3 วัน',
    check: (s) => currentStreak(s) >= 3,
  },
  {
    id: 'streak7', icon: '🔥',
    titleEn: '7-day streak', titleTh: 'สตรีค 7 วัน',
    check: (s) => currentStreak(s) >= 7,
  },
  {
    id: 'first10', icon: '⚡',
    titleEn: 'First 10 solves', titleTh: 'ครบ 10 ครั้ง',
    check: (s) => totalSolves(s) >= 10,
  },
  {
    id: 'first50', icon: '🎯',
    titleEn: '50 solves', titleTh: 'ครบ 50 ครั้ง',
    check: (s) => totalSolves(s) >= 50,
  },
  {
    id: 'algs10', icon: '🧠',
    titleEn: '10 algs viewed', titleTh: 'เปิดสูตร 10',
    check: (s) => s.algsViewed.length >= 10,
  },
  {
    id: 'algsAll', icon: '🧬',
    titleEn: 'Alg encyclopedia', titleTh: 'ครบทุกสูตรในแอพ',
    check: (s) => s.algsViewed.length >= 18,
  },
];

export function refreshAchievements() {
  const state = loadStats();
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (state.achievementsUnlocked[a.id]) continue;
    if (a.check(state)) {
      state.achievementsUnlocked[a.id] = Date.now();
      changed = true;
    }
  }
  if (changed) saveStats(state);
  return state.achievementsUnlocked;
}

// React hook helper: subscribe to live updates.
export function subscribeStats(cb) {
  const handler = () => cb(loadStats());
  window.addEventListener('rublicx-stats-updated', handler);
  return () => window.removeEventListener('rublicx-stats-updated', handler);
}

// One-off migration: scrub the legacy demo seed from older builds.
export function migrateLegacy() {
  // Older versions seeded localStorage 'rublicx.history' with demo solve times.
  const legacy = localStorage.getItem('rublicx.history');
  if (legacy) {
    try {
      const arr = JSON.parse(legacy);
      // Detect the well-known demo seed and discard.
      const demoSig = [18.2, 16.4, 17.1, 14.8, 15.2, 13.6, 14.3, 16.0, 13.8, 12.4, 14.7, 11.84];
      const isDemoSeed = Array.isArray(arr) && arr.length === demoSig.length
        && arr.every((v, i) => Math.abs(v - demoSig[i]) < 0.01);
      if (isDemoSeed) localStorage.removeItem('rublicx.history');
    } catch {}
  }
}
