export type Category = {
  id: string;
  name: string;
  budgetSec: number;
  spentSec: number;
  color: string;
  isIdle?: boolean;
  completed?: boolean;
  // Per-category pomodoro length in seconds. Falls back to DEFAULT_POMO_SEC.
  pomoSec?: number;
};

// Stored in defaults/templates — no spentSec / completed / id stability concerns.
export type DefaultCategory = {
  id: string;
  name: string;
  budgetSec: number;
  color: string;
  pomoSec?: number;
};

export function effectiveBudget(c: Category): number {
  return c.completed ? c.spentSec : c.budgetSec;
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type WeekdayDefaults = {
  [k in Weekday]?: DefaultCategory[];
};

export type AppState = {
  date: string;
  categories: Category[];
  activeId: string | null;
  activeStartedAt: number | null;
  pomoEndAt: number | null;
  muted: boolean;
  // User-configurable seed list. Used for "Reset today". Excludes Idle.
  defaults?: DefaultCategory[];
  // Per-weekday overrides. Missing key = inherit from `defaults`.
  weekdayDefaults?: WeekdayDefaults;
};

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};

export const WEEKDAY_LABELS_LONG: Record<Weekday, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export function todayWeekday(): Weekday {
  return new Date().getDay() as Weekday;
}

export function defaultsForWeekday(
  s: Pick<AppState, "defaults" | "weekdayDefaults">,
  wd: Weekday,
): DefaultCategory[] {
  const override = s.weekdayDefaults?.[wd];
  if (override !== undefined) return override;
  return s.defaults ?? builtInDefaults();
}

export const DEFAULT_POMO_SEC = 25 * 60;
export const POMODORO_MS = DEFAULT_POMO_SEC * 1000;
export const IDLE_COLOR = "#6b7280";

export function pomoSecOf(c: Category): number {
  return c.pomoSec && c.pomoSec > 0 ? c.pomoSec : DEFAULT_POMO_SEC;
}

export function ensureSpecialCategories(cats: Category[]): Category[] {
  // Strip any legacy Float buffer categories that may exist in saved state.
  let r = (cats as Array<Category & { isBuffer?: boolean }>).filter((c) => !c.isBuffer);
  if (!r.some((c) => c.isIdle)) {
    r = [
      ...r,
      { id: cryptoId(), name: "Idle", budgetSec: 0, spentSec: 0, color: IDLE_COLOR, isIdle: true },
    ];
  }
  return r;
}

export const PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayStr(): string {
  return localDateStr(new Date());
}

// Midnight (00:00 local time) of the day after the given YYYY-MM-DD string.
export function startOfNextDayMs(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
}

export function commitActive(s: AppState, atMs: number): AppState {
  if (!s.activeId || !s.activeStartedAt) return s;
  const elapsed = Math.floor((atMs - s.activeStartedAt) / 1000);
  if (elapsed <= 0) return { ...s, activeId: null, activeStartedAt: null };
  return {
    ...s,
    categories: s.categories.map((c) =>
      c.id === s.activeId ? { ...c, spentSec: c.spentSec + elapsed } : c,
    ),
    activeId: null,
    activeStartedAt: null,
  };
}

// Builds the new-day state from a state whose date has rolled over, archiving
// yesterday's elapsed up to midnight and (if today is the immediate next day)
// continuing an active timer onto today's matching category.
export function rollOver(s: AppState): {
  committed: AppState;
  next: AppState;
} {
  const cutoffMs = startOfNextDayMs(s.date);
  const committed = commitActive(s, cutoffMs);

  const today = todayStr();
  const wd = todayWeekday();
  const defs = defaultsForWeekday(s, wd);
  const newCategories = ensureSpecialCategories(categoriesFromDefaults(defs));

  let activeId: string | null = null;
  let activeStartedAt: number | null = null;
  let pomoEndAt: number | null = null;

  const isAdjacent = localDateStr(new Date(cutoffMs)) === today;
  if (isAdjacent && s.activeId && s.activeStartedAt) {
    const oldActive = s.categories.find((c) => c.id === s.activeId);
    if (oldActive && !oldActive.isIdle) {
      const target = oldActive.name.trim().toLowerCase();
      const match = newCategories.find(
        (c) =>
          !c.isIdle &&
          !c.completed &&
          c.name.trim().toLowerCase() === target,
      );
      if (match) {
        activeId = match.id;
        activeStartedAt = cutoffMs;
        if (s.pomoEndAt && s.pomoEndAt > Date.now()) {
          pomoEndAt = s.pomoEndAt;
        }
      }
    }
  }

  return {
    committed,
    next: {
      date: today,
      categories: newCategories,
      activeId,
      activeStartedAt,
      pomoEndAt,
      muted: s.muted,
      defaults: s.defaults,
      weekdayDefaults: s.weekdayDefaults,
    },
  };
}

export function builtInDefaults(): DefaultCategory[] {
  return [
    { id: cryptoId(), name: "Work", budgetSec: 8 * 3600, color: PALETTE[0] },
    { id: cryptoId(), name: "Sleep", budgetSec: 8 * 3600, color: PALETTE[1] },
    { id: cryptoId(), name: "Exercise", budgetSec: 60 * 60, color: PALETTE[2] },
  ];
}

export function categoriesFromDefaults(defs: DefaultCategory[]): Category[] {
  const cats: Category[] = defs.map((d) => ({
    id: cryptoId(),
    name: d.name,
    budgetSec: d.budgetSec,
    spentSec: 0,
    color: d.color,
    pomoSec: d.pomoSec,
  }));
  return ensureSpecialCategories(cats);
}

export function defaultState(): AppState {
  const defaults = builtInDefaults();
  return {
    date: todayStr(),
    categories: categoriesFromDefaults(defaults),
    activeId: null,
    activeStartedAt: null,
    pomoEndAt: null,
    muted: false,
    defaults,
  };
}

// Normalizes a same-day state (ensures special categories, fills muted, etc.).
// For cross-day transitions, callers should use `rollOver` instead so an
// active timer can be carried into the new day.
export function normalizeRemoteState(parsed: AppState): AppState {
  return {
    date: parsed.date,
    categories: ensureSpecialCategories(parsed.categories),
    activeId: parsed.activeId ?? null,
    activeStartedAt: parsed.activeStartedAt ?? null,
    pomoEndAt: parsed.pomoEndAt ?? null,
    muted: parsed.muted ?? false,
    defaults: parsed.defaults,
    weekdayDefaults: parsed.weekdayDefaults,
  };
}

export function cryptoId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function fmtDuration(sec: number): string {
  const sign = sec < 0 ? "-" : "";
  const a = Math.abs(Math.floor(sec));
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = a % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function fmtBudget(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s && !h) parts.push(`${s}s`);
  return parts.join(" ") || "0m";
}

export function parseBudget(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  // Tokenized form: "1h 30m 15s" — any subset, any order
  const tokenRe = /(\d+(?:\.\d+)?)\s*(h|m|s)/g;
  let total = 0;
  let matched = false;
  let consumed = 0;
  for (const m of s.matchAll(tokenRe)) {
    matched = true;
    consumed += m[0].length;
    const n = parseFloat(m[1]);
    if (m[2] === "h") total += n * 3600;
    else if (m[2] === "m") total += n * 60;
    else total += n;
  }
  if (matched) {
    // Reject leftover non-whitespace characters
    const stripped = s.replace(tokenRe, "").trim();
    if (stripped.length > 0) return null;
    return Math.round(total);
  }
  const num = parseFloat(s);
  if (!Number.isNaN(num) && /^\d+(?:\.\d+)?$/.test(s)) return Math.round(num * 3600);
  return null;
}

export function totalBudgetSec(cats: Category[]): number {
  return cats.reduce((sum, c) => sum + c.budgetSec, 0);
}

export const DAY_SEC = 24 * 3600;
