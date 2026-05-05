import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  type AppState,
  type Category,
  type DefaultCategory,
  type WeekdayDefaults,
  DAY_SEC,
  DEFAULT_POMO_SEC,
  PALETTE,
  categoriesFromDefaults,
  commitActive,
  cryptoId,
  defaultState,
  defaultsForWeekday,
  effectiveBudget,
  ensureSpecialCategories,
  fmtBudget,
  fmtDuration,
  fmtSignedBudget,
  normalizeRemoteState,
  parseBudget,
  pomoSecOf,
  rollOver,
  todayStr,
  todayWeekday,
} from "./types";
import { playPomoDone, playStart, playStop, startAlarm } from "./sounds";
import { archiveDay, deleteAccount, loadState, saveState, wipeAllData } from "./db";
import { supabase } from "./supabase";
import Auth from "./Auth";
import History from "./History";
import Settings from "./Settings";
import "./App.css";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) setShowAuth(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!authReady) return <div className="app-loading">Loading…</div>;
  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? null;
  return (
    <>
      <BudgetApp
        key={userId ?? "local"}
        userId={userId}
        email={email}
        onSignIn={() => setShowAuth(true)}
      />
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </>
  );
}

function BudgetApp({
  userId,
  email,
  onSignIn,
}: {
  userId: string | null;
  email: string | null;
  onSignIn: () => void;
}) {
  const [state, setState] = useState<AppState | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [view, setView] = useState<"today" | "history" | "settings">("today");
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const alarmStopRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<AppState | null>(null);
  stateRef.current = state;

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadState(userId);
        if (cancelled) return;
        if (!loaded) {
          const fresh = defaultState();
          setState(fresh);
          await saveState(userId, fresh);
          return;
        }
        if (loaded.date !== todayStr()) {
          // Day rolled over while offline — commit yesterday up to midnight,
          // archive it, and possibly carry the active timer into today.
          const { committed, next } = rollOver(loaded);
          try {
            await archiveDay(userId, loaded.date, committed.categories);
          } catch (e) {
            console.error("Failed to archive previous day:", e);
          }
          setState(next);
          await saveState(userId, next);
        } else {
          setState(normalizeRemoteState(loaded));
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced save on state changes.
  useEffect(() => {
    if (!state) return;
    const handle = window.setTimeout(() => {
      saveState(userId, state).catch((e) => console.error("Save failed:", e));
    }, 500);
    return () => window.clearTimeout(handle);
  }, [state, userId]);

  // Flush latest state when userId changes (sign-in/out remounts via key).
  // Save as-is so an active timer keeps running across the transition.
  useEffect(() => {
    return () => {
      const s = stateRef.current;
      if (!s) return;
      saveState(userId, s).catch(() => {});
    };
  }, [userId]);

  // Run the alarm while the active timer is over its budget.
  useEffect(() => {
    if (!state) return;
    const active = state.categories.find((c) => c.id === state.activeId);
    const overActive =
      !!active && !active.isIdle && liveSpent(active, state, now) > active.budgetSec;
    const shouldRing = overActive && !state.muted;

    if (shouldRing && !alarmStopRef.current) {
      alarmStopRef.current = startAlarm();
    } else if (!shouldRing && alarmStopRef.current) {
      alarmStopRef.current();
      alarmStopRef.current = null;
    }
  }, [now, state]);

  useEffect(() => {
    return () => {
      if (alarmStopRef.current) {
        alarmStopRef.current();
        alarmStopRef.current = null;
      }
    };
  }, []);

  // Tick + day rollover.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      const s = stateRef.current;
      if (s && s.date !== todayStr()) {
        const { committed, next } = rollOver(s);
        archiveDay(userId, s.date, committed.categories).catch((e) =>
          console.error("History write failed:", e),
        );
        setState(next);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [userId]);

  // Auto-stop when the active category reaches its budget; remaining time
  // beyond budget is naturally absorbed into Idle by the accountedSec math.
  useEffect(() => {
    if (!state || !state.activeId || !state.activeStartedAt) return;
    const active = state.categories.find((c) => c.id === state.activeId);
    if (!active || active.isIdle || active.budgetSec <= 0) return;
    if (liveSpent(active, state, now) < active.budgetSec) return;
    setState((s) => {
      if (!s || !s.activeId || !s.activeStartedAt) return s;
      const c = s.categories.find((x) => x.id === s.activeId);
      if (!c) return s;
      // Stop exactly when liveSpent hits budget (no overage on the category).
      const remaining = c.budgetSec - c.spentSec;
      const stopAtMs =
        remaining > 0 ? s.activeStartedAt + remaining * 1000 : s.activeStartedAt;
      if (!s.muted) playPomoDone();
      return { ...commitActive(s, stopAtMs), pomoEndAt: null };
    });
  }, [now, state]);

  // Pomodoro auto-stop.
  useEffect(() => {
    if (!state || !state.activeId || state.pomoEndAt == null) return;
    if (now >= state.pomoEndAt) {
      setState((s) => {
        if (!s) return s;
        if (!s.muted) playPomoDone();
        return { ...commitActive(s, Date.now()), pomoEndAt: null };
      });
    }
  }, [now, state]);

  // Persist latest state on tab close. Don't commit the active timer —
  // activeStartedAt is preserved so liveSpent picks up off-tab elapsed time on reopen.
  useEffect(() => {
    const handler = () => {
      const s = stateRef.current;
      if (!s) return;
      // Best-effort sync save (browsers limit work in beforeunload).
      saveState(userId, s).catch(() => {});
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [userId]);

  if (loadErr) {
    return (
      <div className="app">
        <p className="auth-err">Failed to load: {loadErr}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  }
  if (!state) return <div className="app-loading">Loading your budget…</div>;

  const startTimer = (id: string) => {
    setState((s) => {
      if (!s) return s;
      const stopped = commitActive(s, Date.now());
      if (!s.muted) playStart();
      return { ...stopped, activeId: id, activeStartedAt: Date.now(), pomoEndAt: null };
    });
  };

  const startPomodoro = (id: string) => {
    setState((s) => {
      if (!s) return s;
      const target = s.categories.find((c) => c.id === id);
      const pomoMs = (target ? pomoSecOf(target) : DEFAULT_POMO_SEC) * 1000;
      const stopped = commitActive(s, Date.now());
      if (!s.muted) playStart();
      return {
        ...stopped,
        activeId: id,
        activeStartedAt: Date.now(),
        pomoEndAt: Date.now() + pomoMs,
      };
    });
  };

  const stopTimer = () => {
    setState((s) => {
      if (!s) return s;
      if (s.activeId && !s.muted) playStop();
      return { ...commitActive(s, Date.now()), pomoEndAt: null };
    });
  };

  const toggleMute = () => {
    setState((s) => (s ? { ...s, muted: !s.muted } : s));
  };

  const addCategory = (name: string, budgetSec: number) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        categories: [
          ...s.categories,
          {
            id: cryptoId(),
            name,
            budgetSec,
            spentSec: 0,
            color: PALETTE[s.categories.length % PALETTE.length],
          },
        ],
      };
    });
  };

  const removeCategory = (id: string) => {
    setState((s) => {
      if (!s) return s;
      const stopped = s.activeId === id ? { ...commitActive(s, Date.now()), pomoEndAt: null } : s;
      return { ...stopped, categories: stopped.categories.filter((c) => c.id !== id) };
    });
  };

  const updateCategory = (id: string, patch: Partial<Category>) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      };
    });
  };

  const completeCategory = (id: string) => {
    setState((s) => {
      if (!s) return s;
      const stopped = s.activeId === id ? { ...commitActive(s, Date.now()), pomoEndAt: null } : s;
      return {
        ...stopped,
        categories: stopped.categories.map((c) => (c.id === id ? { ...c, completed: true } : c)),
      };
    });
  };

  const reopenCategory = (id: string) => {
    setState((s) => {
      if (!s) return s;
      return {
        ...s,
        categories: s.categories.map((c) => (c.id === id ? { ...c, completed: false } : c)),
      };
    });
  };

  const signOut = async () => {
    if (!userId) return;
    const s = stateRef.current;
    if (s) {
      try {
        await saveState(userId, commitActive(s, Date.now()));
      } catch (e) {
        console.error("Final save failed:", e);
      }
    }
    await supabase.auth.signOut();
  };

  const updateDefaults = (defaults: DefaultCategory[]) => {
    setState((s) => (s ? { ...s, defaults } : s));
  };

  const updateWeekdayDefaults = (weekdayDefaults: WeekdayDefaults) => {
    setState((s) => (s ? { ...s, weekdayDefaults } : s));
  };

  const resetToday = () => {
    setState((s) => {
      if (!s) return s;
      const wd = todayWeekday();
      const defs = defaultsForWeekday(s, wd);
      return {
        date: todayStr(),
        categories: ensureSpecialCategories(categoriesFromDefaults(defs)),
        activeId: null,
        activeStartedAt: null,
        pomoEndAt: null,
        muted: s.muted,
        defaults: s.defaults,
        weekdayDefaults: s.weekdayDefaults,
      };
    });
    setView("today");
  };

  const clearAllData = async () => {
    await wipeAllData(userId);
    const fresh = defaultState();
    // Keep the user's edited defaults across a wipe.
    if (state?.defaults && state.defaults.length > 0) {
      fresh.defaults = state.defaults;
      fresh.categories = ensureSpecialCategories(
        categoriesFromDefaults(state.defaults),
      );
    }
    setState(fresh);
    await saveState(userId, fresh);
    setView("today");
  };

  const deleteAccountAction = async () => {
    if (!userId) return;
    await deleteAccount();
    // Auth state listener will flip session to null and remount.
  };

  const userCats = state.categories.filter((c) => !c.isIdle);
  const nowDate = new Date(now);
  const secSinceMidnight =
    nowDate.getHours() * 3600 +
    nowDate.getMinutes() * 60 +
    nowDate.getSeconds();
  const timeLeftSec = Math.max(0, DAY_SEC - secSinceMidnight);
  const coverage = computeCoverage(state, now);

  // Free time = unallocated start + savings from finishing under budget − idle.
  const plannedSec = userCats.reduce((sum, c) => sum + c.budgetSec, 0);
  const freeStartSec = Math.max(0, DAY_SEC - plannedSec);
  const savedSec = userCats.reduce(
    (sum, c) => (c.completed ? sum + Math.max(0, c.budgetSec - c.spentSec) : sum),
    0,
  );
  const usedSec = userCats.reduce(
    (sum, c) => sum + Math.min(liveSpent(c, state, now), c.budgetSec),
    0,
  );
  const idledSec = Math.max(0, secSinceMidnight - usedSec);
  const freeSec = freeStartSec + savedSec - idledSec;

  return (
    <div className="app">
      <header className="header">
        <h1>Time Budget</h1>
        <div className="header-right">
          <button
            className={`btn-icon ${view === "history" ? "btn-active" : ""}`}
            onClick={() => setView(view === "history" ? "today" : "history")}
            title={view === "history" ? "Back to today" : "View past days"}
          >
            {view === "history" ? "Today" : "History"}
          </button>
          <button
            className={`btn-icon-only ${view === "settings" ? "btn-active" : ""}`}
            onClick={() => setView(view === "settings" ? "today" : "settings")}
            aria-label={view === "settings" ? "Back to today" : "Settings"}
            title={view === "settings" ? "Back to today" : "Settings"}
          >
            <GearIcon />
          </button>
          <button
            className="btn-icon-only"
            onClick={toggleMute}
            aria-label={state.muted ? "Unmute sounds" : "Mute sounds"}
            title={state.muted ? "Sound off" : "Sound on"}
          >
            <SpeakerIcon muted={state.muted} />
          </button>
          <p className="date">{state.date}</p>
          {userId ? (
            <button
              className="btn-icon btn-signout"
              onClick={signOut}
              title={email ?? undefined}
            >
              Sign out
            </button>
          ) : (
            <button className="btn-icon btn-signin" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </header>

      {view === "today" ? (
        <>
          <section className={`hero ${freeSec < 0 ? "hero-danger" : ""}`}>
            <div className="hero-label">Free time today</div>
            <div className="hero-value">{fmtSignedBudget(freeSec)}</div>
            <div className="hero-deltas">
              <span className="delta up">
                Saved <b>{fmtBudget(savedSec)}</b>
              </span>
              <span className="delta down">
                Idled <b>{fmtBudget(idledSec)}</b>
              </span>
            </div>
          </section>

          <p className="hero-detail">
            <b>
              Used {fmtBudget(usedSec)} / {fmtBudget(plannedSec)} planned
            </b>{" "}
            · {fmtBudget(timeLeftSec)} left in day
          </p>

          <section className="day-bar-card">
            <DayBar categories={state.categories} state={state} now={now} coverage={coverage} />
          </section>

          <section className="categories">
            {state.categories.filter((c) => !c.isIdle).map((c) => {
              const spent = liveSpent(c, state, now);
              return (
                <CategoryRow
                  key={c.id}
                  category={c}
                  isActive={state.activeId === c.id}
                  liveSpent={spent}
                  coverage={coverage}
                  pomoEndAt={state.activeId === c.id ? state.pomoEndAt : null}
                  now={now}
                  onStart={() => startTimer(c.id)}
                  onPomo={() => startPomodoro(c.id)}
                  onStop={stopTimer}
                  onRemove={() => removeCategory(c.id)}
                  onUpdate={(patch) => updateCategory(c.id, patch)}
                  onComplete={() => completeCategory(c.id)}
                  onReopen={() => reopenCategory(c.id)}
                />
              );
            })}
          </section>

          <AddCategoryForm onAdd={addCategory} />
        </>
      ) : view === "history" ? (
        <History userId={userId} />
      ) : (
        <Settings
          defaults={state.defaults}
          weekdayDefaults={state.weekdayDefaults}
          signedIn={!!userId}
          onUpdateDefaults={updateDefaults}
          onUpdateWeekdayDefaults={updateWeekdayDefaults}
          onResetToday={resetToday}
          onClearAllData={clearAllData}
          onDeleteAccount={deleteAccountAction}
        />
      )}
    </div>
  );
}

type Coverage = {
  totalOverage: number;
  overAllottedBy: number;
};

function computeCoverage(s: AppState, now: number): Coverage {
  let userBudget = 0;
  let totalOverage = 0;
  for (const c of s.categories) {
    if (c.isIdle) continue;
    const eff = effectiveBudget(c);
    userBudget += eff;
    const spent = liveSpent(c, s, now);
    if (spent > eff) totalOverage += spent - eff;
  }
  return {
    totalOverage,
    overAllottedBy: Math.max(0, userBudget - DAY_SEC),
  };
}

function liveSpent(c: Category, s: AppState, now: number): number {
  if (s.activeId === c.id && s.activeStartedAt) {
    return c.spentSec + Math.max(0, Math.floor((now - s.activeStartedAt) / 1000));
  }
  return c.spentSec;
}

function fmtMmSs(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function GearIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {muted ? (
        <>
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </>
      ) : (
        <>
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </>
      )}
    </svg>
  );
}

function DayBar({
  categories,
  state,
  now,
  coverage,
}: {
  categories: Category[];
  state: AppState;
  now: number;
  coverage: Coverage;
}) {
  void coverage;
  const segments = categories
    .filter((c) => !c.isIdle)
    .map((c) => {
      const capped = Math.min(liveSpent(c, state, now), effectiveBudget(c));
      return {
        color: c.color,
        width: (capped / DAY_SEC) * 100,
        name: c.name,
      };
    });

  const date = new Date(now);
  const msSinceMidnight =
    date.getHours() * 3600_000 +
    date.getMinutes() * 60_000 +
    date.getSeconds() * 1000 +
    date.getMilliseconds();
  const nowPct = (msSinceMidnight / 86_400_000) * 100;
  const clock = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  return (
    <div className="day-bar-wrap">
      <div className="day-bar-now-label" style={{ left: `${nowPct}%` }}>{clock}</div>
      <div className="day-bar" title={`Now: ${clock}`}>
        <div className="day-bar-past" style={{ width: `${nowPct}%` }} />
        {segments.map((seg, i) => (
          <div
            key={i}
            className="day-seg"
            style={{ width: `${seg.width}%`, background: seg.color }}
            title={`${seg.name}: ${seg.width.toFixed(1)}% of day`}
          />
        ))}
        <div className="day-bar-now" style={{ left: `${nowPct}%` }} title={`Now: ${clock}`} />
      </div>
      <div className="day-bar-axis">
        <span>0:00</span>
        <span>6:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  isActive,
  liveSpent,
  coverage,
  pomoEndAt,
  now,
  onStart,
  onPomo,
  onStop,
  onRemove,
  onUpdate,
  onComplete,
  onReopen,
}: {
  category: Category;
  isActive: boolean;
  liveSpent: number;
  coverage: Coverage;
  pomoEndAt: number | null;
  now: number;
  onStart: () => void;
  onPomo: () => void;
  onStop: () => void;
  onRemove: () => void;
  onUpdate: (patch: Partial<Category>) => void;
  onComplete: () => void;
  onReopen: () => void;
}) {
  void coverage;
  const isCompleted = !!category.completed;
  const displayBudget = category.budgetSec;
  // Visual cap: never show spent above the budget; overage is reflected in
  // the "Idled" delta on the Free-time hero card.
  const displaySpent = Math.min(liveSpent, displayBudget);
  const inPomo = isActive && pomoEndAt != null;
  const pomoLeft = inPomo ? Math.max(0, Math.ceil((pomoEndAt! - now) / 1000)) : 0;
  const showPomoButton = !isCompleted && category.budgetSec >= 3600;
  const showDoneButton = !isCompleted;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [budget, setBudget] = useState(fmtBudget(displayBudget));
  const [pomo, setPomo] = useState(fmtBudget(pomoSecOf(category)));
  const [editErr, setEditErr] = useState<string | null>(null);

  const pct =
    displayBudget > 0 ? Math.min(100, (displaySpent / displayBudget) * 100) : 0;
  const atBudget = !isCompleted && liveSpent >= category.budgetSec;
  const remaining = Math.max(0, displayBudget - liveSpent);

  const beginEdit = () => {
    setName(category.name);
    setBudget(fmtBudget(displayBudget));
    setPomo(fmtBudget(pomoSecOf(category)));
    setEditErr(null);
    setEditing(true);
  };

  const saveEdit = () => {
    const newBudget = parseBudget(budget);
    if (newBudget == null || newBudget <= 0) {
      setEditErr("Budget like '1h', '30m', '1h 30m'");
      return;
    }
    const newPomo = parseBudget(pomo);
    if (newPomo == null || newPomo <= 0) {
      setEditErr("Pomo like '25m', '50m'");
      return;
    }
    onUpdate({
      name: name.trim() || category.name,
      budgetSec: newBudget,
      pomoSec: newPomo,
    });
    setEditErr(null);
    setEditing(false);
  };

  return (
    <div className={`category ${isActive ? "active" : ""} ${atBudget ? "at-budget" : ""} ${isCompleted ? "completed" : ""}`}>
      <div className="cat-color" style={{ background: category.color }} />
      <div className="cat-main">
        <div className="cat-header">
          {editing ? (
            <div className="cat-edit-form">
              <input
                className="cat-name-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                aria-label="Category name"
              />
              <label className="cat-edit-field">
                <span className="cat-edit-label">Budget</span>
                <input
                  className="cat-budget-input"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="e.g. 1h 30m"
                  aria-label="Budget"
                />
              </label>
              <label className="cat-edit-field">
                <span className="cat-edit-label">Pomo</span>
                <input
                  className="cat-budget-input"
                  value={pomo}
                  onChange={(e) => setPomo(e.target.value)}
                  placeholder="e.g. 25m"
                  aria-label="Pomodoro length"
                />
              </label>
              <div className="cat-edit-actions">
                <button className="btn-primary" onClick={saveEdit}>Save</button>
                <button onClick={() => setEditing(false)}>Cancel</button>
              </div>
              {editErr && <span className="form-error">{editErr}</span>}
            </div>
          ) : (
            <>
              <span className="cat-name">
                {category.name}
                {inPomo && <span className="pomo-badge">Pomo {fmtMmSs(pomoLeft)}</span>}
              </span>
              <span className="cat-times">
                <span className="cat-spent">{fmtDuration(displaySpent)}</span>
                <span className="cat-sep"> / </span>
                <span className="cat-budget">{fmtBudget(displayBudget)}</span>
              </span>
            </>
          )}
        </div>
        <div className="cat-bar">
          <div
            className="cat-bar-fill"
            style={{ width: `${pct}%`, background: category.color }}
          />
        </div>
        <div className="cat-meta">
          {isCompleted ? (
            category.budgetSec > category.spentSec ? (
              <span className="completed-text">
                ✓ Done · saved {fmtBudget(category.budgetSec - category.spentSec)} → Free
              </span>
            ) : (
              <span className="completed-text">✓ Done</span>
            )
          ) : atBudget ? (
            <span className="muted">Budget reached</span>
          ) : (
            <span>{fmtDuration(remaining)} left</span>
          )}
        </div>
      </div>
      <div className="cat-actions">
        {!editing && (
          <>
            {isCompleted ? (
              <>
                <button className="btn-reopen" onClick={onReopen}>Reopen</button>
                <button className="btn-icon btn-danger" onClick={onRemove} aria-label="Remove">×</button>
              </>
            ) : (
              <>
                {isActive ? (
                  <button className="btn-stop" onClick={onStop}>Stop</button>
                ) : (
                  <button className="btn-start" onClick={onStart}>Start</button>
                )}
                {showPomoButton && !isActive && (
                  <button
                    className="btn-pomo"
                    onClick={onPomo}
                    title={`Start a ${fmtBudget(pomoSecOf(category))} focus block`}
                  >
                    Pomo
                  </button>
                )}
                {showDoneButton && (
                  <button className="btn-done" onClick={onComplete} title="Mark complete and return any unused budget">Done</button>
                )}
                <button className="btn-icon" onClick={beginEdit}>Edit</button>
                <button className="btn-icon btn-danger" onClick={onRemove} aria-label="Remove">×</button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AddCategoryForm({ onAdd }: { onAdd: (name: string, budgetSec: number) => void }) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    const sec = parseBudget(budget);
    if (sec == null || sec <= 0) {
      setError("Budget like '1h', '30m', '1h 30m'");
      return;
    }
    onAdd(trimmed, sec);
    setName("");
    setBudget("");
    nameRef.current?.focus();
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        ref={nameRef}
        placeholder="Category (e.g. Reading)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="New category name"
      />
      <input
        placeholder="Budget (e.g. 1h 30m)"
        value={budget}
        onChange={(e) => setBudget(e.target.value)}
        aria-label="New category budget"
      />
      <button type="submit">Add</button>
      {error && <span className="form-error">{error}</span>}
    </form>
  );
}
