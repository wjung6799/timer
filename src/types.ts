export type Category = {
  id: string;
  name: string;
  budgetSec: number;
  spentSec: number;
  color: string;
  isIdle?: boolean;
  completed?: boolean;
};

export function effectiveBudget(c: Category): number {
  return c.completed ? c.spentSec : c.budgetSec;
}

export type AppState = {
  date: string;
  categories: Category[];
  activeId: string | null;
  activeStartedAt: number | null;
  pomoEndAt: number | null;
  muted: boolean;
};

export const POMODORO_MS = 25 * 60 * 1000;
export const IDLE_COLOR = "#6b7280";

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

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function defaultState(): AppState {
  return {
    date: todayStr(),
    categories: [
      { id: cryptoId(), name: "Work", budgetSec: 8 * 3600, spentSec: 0, color: PALETTE[0] },
      { id: cryptoId(), name: "Sleep", budgetSec: 8 * 3600, spentSec: 0, color: PALETTE[1] },
      { id: cryptoId(), name: "Exercise", budgetSec: 60 * 60, spentSec: 0, color: PALETTE[2] },
      { id: cryptoId(), name: "Idle", budgetSec: 0, spentSec: 0, color: IDLE_COLOR, isIdle: true },
    ],
    activeId: null,
    activeStartedAt: null,
    pomoEndAt: null,
    muted: false,
  };
}

export function normalizeRemoteState(parsed: AppState): AppState {
  const muted = parsed.muted ?? false;
  if (parsed.date === todayStr()) {
    return {
      date: parsed.date,
      categories: ensureSpecialCategories(parsed.categories),
      activeId: parsed.activeId ?? null,
      activeStartedAt: parsed.activeStartedAt ?? null,
      pomoEndAt: parsed.pomoEndAt ?? null,
      muted,
    };
  }
  return {
    date: todayStr(),
    categories: ensureSpecialCategories(parsed.categories.map((c) => ({ ...c, spentSec: 0 }))),
    activeId: null,
    activeStartedAt: null,
    pomoEndAt: null,
    muted,
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
