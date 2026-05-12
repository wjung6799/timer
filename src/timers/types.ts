import { cryptoId, PALETTE } from "../types";

// A reusable countdown preset — "Homework, 20 min", "Reading, 15 min", etc.
export type TimerPreset = {
  id: string;
  name: string;
  durationSec: number;
  color: string;
};

// A checklist item shown alongside the timer (the "TASKS" panel in the photo).
export type TaskItem = {
  id: string;
  text: string;
  done: boolean;
};

// The currently running (or paused) timer.
// `endsAt` is the wall-clock ms when it finishes. When paused, `pausedRemainingSec`
// holds the frozen remaining seconds and `endsAt` is stale until resumed.
export type ActiveTimer = {
  presetId: string;
  name: string;
  color: string;
  durationSec: number;
  endsAt: number;
  pausedRemainingSec: number | null;
};

export type TimersState = {
  timers: TimerPreset[];
  tasks: TaskItem[];
  active: ActiveTimer | null;
  muted: boolean;
};

export function defaultTimersState(): TimersState {
  return {
    timers: [
      { id: cryptoId(), name: "Focus", durationSec: 25 * 60, color: PALETTE[0] },
      { id: cryptoId(), name: "Short break", durationSec: 5 * 60, color: PALETTE[2] },
      { id: cryptoId(), name: "Reading", durationSec: 15 * 60, color: PALETTE[1] },
    ],
    tasks: [],
    active: null,
    muted: false,
  };
}

// Defensive normalization for whatever comes back from storage.
export function normalizeTimersState(s: Partial<TimersState> | null | undefined): TimersState {
  const base = defaultTimersState();
  if (!s) return base;
  return {
    timers: Array.isArray(s.timers)
      ? s.timers
          .filter((t): t is TimerPreset => !!t && typeof t.id === "string")
          .map((t) => ({
            id: t.id,
            name: typeof t.name === "string" ? t.name : "Timer",
            durationSec: Number.isFinite(t.durationSec) && t.durationSec > 0 ? Math.floor(t.durationSec) : 60,
            color: typeof t.color === "string" ? t.color : PALETTE[0],
          }))
      : base.timers,
    tasks: Array.isArray(s.tasks)
      ? s.tasks
          .filter((t): t is TaskItem => !!t && typeof t.id === "string")
          .map((t) => ({ id: t.id, text: typeof t.text === "string" ? t.text : "", done: !!t.done }))
      : [],
    active:
      s.active && typeof s.active.presetId === "string" && Number.isFinite(s.active.endsAt)
        ? {
            presetId: s.active.presetId,
            name: typeof s.active.name === "string" ? s.active.name : "Timer",
            color: typeof s.active.color === "string" ? s.active.color : PALETTE[0],
            durationSec:
              Number.isFinite(s.active.durationSec) && s.active.durationSec > 0
                ? Math.floor(s.active.durationSec)
                : 60,
            endsAt: s.active.endsAt,
            pausedRemainingSec:
              s.active.pausedRemainingSec != null && Number.isFinite(s.active.pausedRemainingSec)
                ? Math.max(0, Math.floor(s.active.pausedRemainingSec))
                : null,
          }
        : null,
    muted: !!s.muted,
  };
}

// Remaining whole seconds for an active timer at time `now` (ms).
export function remainingSec(active: ActiveTimer, now: number): number {
  if (active.pausedRemainingSec != null) return active.pausedRemainingSec;
  return Math.max(0, Math.ceil((active.endsAt - now) / 1000));
}

export function fmtClock(totalSec: number): string {
  const a = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(a / 3600);
  const m = Math.floor((a % 3600) / 60);
  const s = a % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}
