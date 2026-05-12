import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cryptoId, fmtBudget, parseBudget, PALETTE } from "../types";
import { playPomoDone, playStart, playStop } from "../sounds";
import { cancelTimerNotification, scheduleTimerEnd } from "../notify";
import {
  defaultTimersState,
  fmtClock,
  normalizeTimersState,
  remainingSec,
  type ActiveTimer,
  type TimerPreset,
  type TimersState,
} from "./types";
import { loadTimersState, saveTimersState } from "./db";
import VisualTimer from "./VisualTimer";
import "./Timers.css";

// Classic Time-Timer red, used for the drag-to-set dial and ad-hoc timers.
const DIAL_COLOR = "#e8400f";

export default function TimersApp({
  userId,
  email,
  onSignIn,
  onSignOut,
}: {
  userId: string | null;
  email: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const [state, setState] = useState<TimersState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState<string | null>(null);
  const [draftSec, setDraftSec] = useState(25 * 60); // duration set via the dial
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const stateRef = useRef<TimersState | null>(null);
  stateRef.current = state;

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadTimersState(userId);
        if (cancelled) return;
        if (loaded) {
          setState(normalizeTimersState(loaded));
        } else {
          const fresh = defaultTimersState();
          setState(fresh);
          await saveTimersState(userId, fresh);
        }
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced save.
  useEffect(() => {
    if (!state) return;
    const h = window.setTimeout(() => {
      saveTimersState(userId, state).catch((e) => console.error("Timers save failed:", e));
    }, 500);
    return () => window.clearTimeout(h);
  }, [state, userId]);

  // Flush on unmount / before unload.
  useEffect(() => {
    const flush = () => {
      const s = stateRef.current;
      if (s) saveTimersState(userId, s).catch(() => {});
    };
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("beforeunload", flush);
      flush();
    };
  }, [userId]);

  // 1s tick.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Completion: active, not paused, ran out.
  useEffect(() => {
    if (!state?.active || state.active.pausedRemainingSec != null) return;
    if (remainingSec(state.active, now) > 0) return;
    const name = state.active.name;
    setState((s) => (s ? { ...s, active: null } : s));
    setFinished(name);
    cancelTimerNotification();
    const s = stateRef.current;
    if (!s?.muted) playPomoDone();
  }, [now, state]);

  // Auto-dismiss the "time's up" banner after a while.
  useEffect(() => {
    if (!finished) return;
    const h = window.setTimeout(() => setFinished(null), 12_000);
    return () => window.clearTimeout(h);
  }, [finished]);

  if (loadErr) {
    return (
      <div className="app">
        <p className="auth-err">Failed to load timers: {loadErr}</p>
        <button onClick={() => location.reload()}>Retry</button>
      </div>
    );
  }
  if (!state) return <div className="app-loading">Loading timers…</div>;

  const active = state.active;
  const remaining = active ? remainingSec(active, now) : 0;
  const paused = !!active && active.pausedRemainingSec != null;

  const startPreset = (p: TimerPreset) => {
    const startMs = Date.now();
    const a: ActiveTimer = {
      presetId: p.id,
      name: p.name,
      color: p.color,
      durationSec: p.durationSec,
      endsAt: startMs + p.durationSec * 1000,
      pausedRemainingSec: null,
    };
    setState((s) => (s ? { ...s, active: a } : s));
    setFinished(null);
    if (!state.muted) playStart();
    scheduleTimerEnd(p.name, a.endsAt);
  };

  const startDraft = () => {
    if (draftSec < 1) return;
    const startMs = Date.now();
    const a: ActiveTimer = {
      presetId: "",
      name: "Timer",
      color: DIAL_COLOR,
      durationSec: draftSec,
      endsAt: startMs + draftSec * 1000,
      pausedRemainingSec: null,
    };
    setState((s) => (s ? { ...s, active: a } : s));
    setFinished(null);
    if (!state.muted) playStart();
    scheduleTimerEnd("Timer", a.endsAt);
  };

  const saveDraftAsPreset = () => {
    if (draftSec < 1) return;
    addPreset(`${Math.round(draftSec / 60)} min`, draftSec);
  };

  const pause = () => {
    setState((s) => {
      if (!s?.active || s.active.pausedRemainingSec != null) return s;
      return {
        ...s,
        active: { ...s.active, pausedRemainingSec: remainingSec(s.active, Date.now()) },
      };
    });
    cancelTimerNotification();
  };

  const resume = () => {
    setState((s) => {
      if (!s?.active || s.active.pausedRemainingSec == null) return s;
      const endsAt = Date.now() + s.active.pausedRemainingSec * 1000;
      scheduleTimerEnd(s.active.name, endsAt);
      return { ...s, active: { ...s.active, endsAt, pausedRemainingSec: null } };
    });
  };

  const stop = () => {
    if (state.active && !state.muted) playStop();
    cancelTimerNotification();
    setState((s) => (s ? { ...s, active: null } : s));
  };

  const addTime = (sec: number) => {
    setState((s) => {
      if (!s?.active) return s;
      if (s.active.pausedRemainingSec != null) {
        return { ...s, active: { ...s.active, pausedRemainingSec: s.active.pausedRemainingSec + sec } };
      }
      const endsAt = s.active.endsAt + sec * 1000;
      scheduleTimerEnd(s.active.name, endsAt);
      return { ...s, active: { ...s.active, endsAt } };
    });
  };

  const toggleMute = () => setState((s) => (s ? { ...s, muted: !s.muted } : s));

  const addPreset = (name: string, durationSec: number) => {
    setState((s) =>
      s
        ? {
            ...s,
            timers: [
              ...s.timers,
              { id: cryptoId(), name, durationSec, color: PALETTE[s.timers.length % PALETTE.length] },
            ],
          }
        : s,
    );
  };

  const updatePreset = (id: string, patch: Partial<TimerPreset>) => {
    setState((s) =>
      s ? { ...s, timers: s.timers.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : s,
    );
  };

  const removePreset = (id: string) => {
    setState((s) =>
      s
        ? {
            ...s,
            timers: s.timers.filter((t) => t.id !== id),
            active: s.active?.presetId === id ? s.active : s.active, // keep running even if preset deleted
          }
        : s,
    );
  };

  const addTask = (text: string) => {
    setState((s) => (s ? { ...s, tasks: [...s.tasks, { id: cryptoId(), text, done: false }] } : s));
  };

  const toggleTask = (id: string) => {
    setState((s) =>
      s ? { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) } : s,
    );
  };

  const removeTask = (id: string) => {
    setState((s) => (s ? { ...s, tasks: s.tasks.filter((t) => t.id !== id) } : s));
  };

  const clearDoneTasks = () => {
    setState((s) => (s ? { ...s, tasks: s.tasks.filter((t) => !t.done) } : s));
  };

  const doneCount = state.tasks.filter((t) => t.done).length;

  return (
    <div className="app timers">
      <header className="header">
        <div className="header-left">
          <Link className="btn-icon" to="/">
            ← Hub
          </Link>
          <h1>Timers</h1>
        </div>
        <div className="header-right">
          <button
            className="btn-icon-only"
            onClick={toggleMute}
            aria-label={state.muted ? "Unmute" : "Mute"}
            title={state.muted ? "Sound off" : "Sound on"}
          >
            {state.muted ? "🔇" : "🔔"}
          </button>
          {userId ? (
            <button className="btn-icon btn-signout" onClick={onSignOut} title={email ?? undefined}>
              Sign out
            </button>
          ) : (
            <button className="btn-icon btn-signin" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </header>

      {finished && (
        <div className="timer-banner">
          <span>⏰ {finished} — time's up</span>
          <button className="btn-icon" onClick={() => setFinished(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="timers-layout">
        <section className="timer-stage">
          {active ? (
            <>
              <VisualTimer remaining={remaining} color={active.color} label={active.name} paused={paused} />
              <div className="timer-active-meta">
                {fmtBudget(active.durationSec)} timer · {paused ? "paused" : "running"}
              </div>
              <div className="timer-controls">
                {paused ? (
                  <button className="btn-primary" onClick={resume}>
                    Resume
                  </button>
                ) : (
                  <button className="btn-primary" onClick={pause}>
                    Pause
                  </button>
                )}
                <button onClick={() => addTime(60)}>+1 min</button>
                <button className="btn-danger-outline" onClick={stop}>
                  Stop
                </button>
              </div>
            </>
          ) : (
            <>
              <VisualTimer remaining={draftSec} color={DIAL_COLOR} onSet={setDraftSec} />
              <div className="timer-active-meta">Drag the dial to set a timer</div>
              <div className="timer-controls">
                <button className="btn-primary" onClick={startDraft} disabled={draftSec < 60}>
                  Start{draftSec >= 60 ? ` ${fmtClock(draftSec)}` : ""}
                </button>
                <button onClick={saveDraftAsPreset} disabled={draftSec < 60}>
                  Save
                </button>
              </div>
              <p className="timer-set-hint">…or pick one of your timers below</p>
            </>
          )}
        </section>

        <section className="tasks-panel">
          <h2>Tasks</h2>
          {state.tasks.length === 0 ? (
            <p className="tasks-empty">No tasks yet.</p>
          ) : (
            <ul className="task-list">
              {state.tasks.map((t) => (
                <li key={t.id} className={t.done ? "task done" : "task"}>
                  <label className="task-label">
                    <input type="checkbox" checked={t.done} onChange={() => toggleTask(t.id)} />
                    <span>{t.text}</span>
                  </label>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => removeTask(t.id)}
                    aria-label="Remove task"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <AddTextForm placeholder="Add a task" buttonLabel="Add" onAdd={addTask} />
          {doneCount > 0 && (
            <button className="link-btn" onClick={clearDoneTasks}>
              Clear {doneCount} done
            </button>
          )}
        </section>
      </div>

      <section className="timer-presets">
        <h2>My timers</h2>
        <div className="preset-list">
          {state.timers.map((t) => (
            <TimerPresetRow
              key={t.id}
              preset={t}
              isActive={active?.presetId === t.id}
              onStart={() => startPreset(t)}
              onUpdate={(patch) => updatePreset(t.id, patch)}
              onRemove={() => removePreset(t.id)}
            />
          ))}
        </div>
        <AddTimerForm onAdd={addPreset} />
      </section>
    </div>
  );
}

function TimerPresetRow({
  preset,
  isActive,
  onStart,
  onUpdate,
  onRemove,
}: {
  preset: TimerPreset;
  isActive: boolean;
  onStart: () => void;
  onUpdate: (patch: Partial<TimerPreset>) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(preset.name);
  const [dur, setDur] = useState(fmtBudget(preset.durationSec));
  const [err, setErr] = useState<string | null>(null);

  const beginEdit = () => {
    setName(preset.name);
    setDur(fmtBudget(preset.durationSec));
    setErr(null);
    setEditing(true);
  };

  const save = () => {
    const sec = parseBudget(dur);
    if (sec == null || sec <= 0) {
      setErr("Duration like '20m', '1h 30m'");
      return;
    }
    onUpdate({ name: name.trim() || preset.name, durationSec: sec });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="preset-row editing">
        <span className="preset-dot" style={{ background: preset.color }} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Timer name" />
        <input value={dur} onChange={(e) => setDur(e.target.value)} placeholder="e.g. 20m" aria-label="Duration" />
        <button className="btn-primary" onClick={save}>
          Save
        </button>
        <button onClick={() => setEditing(false)}>Cancel</button>
        {err && <span className="form-error">{err}</span>}
      </div>
    );
  }

  return (
    <div className={`preset-row ${isActive ? "active" : ""}`}>
      <span className="preset-dot" style={{ background: preset.color }} />
      <button className="preset-main" onClick={onStart} title={`Start ${preset.name}`}>
        <span className="preset-name">{preset.name}</span>
        <span className="preset-dur">{fmtClock(preset.durationSec)}</span>
      </button>
      <button className="btn-start" onClick={onStart}>
        Start
      </button>
      <button className="btn-icon" onClick={beginEdit}>
        Edit
      </button>
      <button className="btn-icon btn-danger" onClick={onRemove} aria-label="Delete timer">
        ×
      </button>
    </div>
  );
}

function AddTimerForm({ onAdd }: { onAdd: (name: string, durationSec: number) => void }) {
  const [name, setName] = useState("");
  const [dur, setDur] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("Name required");
      return;
    }
    const sec = parseBudget(dur);
    if (sec == null || sec <= 0) {
      setErr("Duration like '20m', '1h 30m'");
      return;
    }
    onAdd(trimmed, sec);
    setName("");
    setDur("");
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <input placeholder="Timer name (e.g. Homework)" value={name} onChange={(e) => setName(e.target.value)} aria-label="New timer name" />
      <input placeholder="Duration (e.g. 20m)" value={dur} onChange={(e) => setDur(e.target.value)} aria-label="New timer duration" />
      <button type="submit">Add timer</button>
      {err && <span className="form-error">{err}</span>}
    </form>
  );
}

function AddTextForm({
  placeholder,
  buttonLabel,
  onAdd,
}: {
  placeholder: string;
  buttonLabel: string;
  onAdd: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText("");
  };
  return (
    <form className="add-form" onSubmit={submit}>
      <input placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value)} aria-label={placeholder} />
      <button type="submit">{buttonLabel}</button>
    </form>
  );
}
