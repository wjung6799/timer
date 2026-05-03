let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(opts: {
  freq: number;
  durationMs: number;
  type?: OscillatorType;
  gain?: number;
  startOffsetMs?: number;
  attackMs?: number;
  releaseMs?: number;
}) {
  const c = getCtx();
  if (!c) return;
  const startAt = c.currentTime + (opts.startOffsetMs ?? 0) / 1000;
  const dur = opts.durationMs / 1000;
  const gainPeak = opts.gain ?? 0.12;
  const attack = (opts.attackMs ?? 5) / 1000;
  const release = (opts.releaseMs ?? 80) / 1000;

  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.freq, startAt);
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(gainPeak, startAt + attack);
  g.gain.setValueAtTime(gainPeak, startAt + Math.max(attack, dur - release));
  g.gain.linearRampToValueAtTime(0, startAt + dur);
  osc.connect(g).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.02);
}

export function playStart() {
  tone({ freq: 660, durationMs: 90, type: "sine", gain: 0.1 });
  tone({ freq: 880, durationMs: 110, type: "sine", gain: 0.1, startOffsetMs: 70 });
}

export function playStop() {
  tone({ freq: 520, durationMs: 90, type: "sine", gain: 0.1 });
  tone({ freq: 360, durationMs: 130, type: "sine", gain: 0.1, startOffsetMs: 70 });
}

// Pleasant 3-note descending chime: "you finished a pomo".
export function playPomoDone() {
  tone({ freq: 1175, durationMs: 200, type: "sine", gain: 0.16, releaseMs: 140 });
  tone({ freq: 988, durationMs: 200, type: "sine", gain: 0.16, releaseMs: 140, startOffsetMs: 180 });
  tone({ freq: 784, durationMs: 380, type: "sine", gain: 0.16, releaseMs: 280, startOffsetMs: 360 });
}

// Two-tone siren alarm. Returns a stop function. Loops until stopped.
export function startAlarm(): () => void {
  const freqs = [880, 620];
  let i = 0;
  const beep = () => {
    tone({
      freq: freqs[i % 2],
      durationMs: 380,
      type: "square",
      gain: 0.22,
      attackMs: 8,
      releaseMs: 40,
    });
    i++;
  };
  beep();
  const id = window.setInterval(beep, 420);
  return () => window.clearInterval(id);
}
