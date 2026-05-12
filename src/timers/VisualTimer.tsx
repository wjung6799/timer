import { fmtClock } from "./types";

// A faithful "Time Timer" dial: a 60-minute clock face — 0 at the top, the
// minutes counting up clockwise (5, 10, … 55), minute ticks (longer every 5),
// and a colored disk whose leading edge points at the minutes remaining. Below
// the dial sits an LCD-style digital readout.
//
// The face is always 60 minutes (like the real device). A 25-minute timer
// therefore starts with red covering ~42% of the dial and shrinks to nothing —
// exactly how a Time Timer behaves. Timers longer than an hour show a full disk
// until they drop under 60 minutes.

const FACE_SEC = 60 * 60;
const VB = 240; // SVG viewBox size
const C = VB / 2;
const R_BEZEL = 118;
const R_FACE = 99;
const R_TICK = 99;
const R_NUM = 108;
const R_WEDGE = 92;

export default function VisualTimer({
  remaining,
  color,
  label,
  paused,
  idle,
}: {
  remaining: number; // seconds left
  color: string;
  label?: string;
  paused?: boolean;
  idle?: boolean; // render an empty placeholder dial
}) {
  const frac = idle ? 0 : Math.max(0, Math.min(1, remaining / FACE_SEC));

  const ticks = Array.from({ length: 60 }, (_, m) => {
    const a = (m / 60) * 2 * Math.PI; // clockwise from 12 o'clock
    const major = m % 5 === 0;
    const len = major ? 9 : 4;
    return {
      key: m,
      x1: C + R_TICK * Math.sin(a),
      y1: C - R_TICK * Math.cos(a),
      x2: C + (R_TICK - len) * Math.sin(a),
      y2: C - (R_TICK - len) * Math.cos(a),
      major,
    };
  });

  const numbers = Array.from({ length: 12 }, (_, k) => {
    const min = k * 5;
    const a = (min / 60) * 2 * Math.PI;
    return { min, x: C + R_NUM * Math.sin(a), y: C - R_NUM * Math.cos(a) };
  });

  const lcd = idle ? "––:––" : fmtClock(remaining);

  return (
    <div className={`vtimer ${paused ? "vtimer-paused" : ""} ${idle ? "vtimer-idle" : ""}`}>
      <svg
        viewBox={`0 0 ${VB} ${VB}`}
        className="vtimer-svg"
        role="img"
        aria-label={idle ? "No timer running" : `${label ? label + ": " : ""}${fmtClock(remaining)} remaining`}
      >
        <circle cx={C} cy={C} r={R_BEZEL} className="vtimer-bezel" />
        <circle cx={C} cy={C} r={R_FACE} className="vtimer-face" />
        <Wedge frac={frac} color={color} />
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            className={t.major ? "vtimer-tick vtimer-tick-major" : "vtimer-tick"}
          />
        ))}
        {numbers.map((n) => (
          <text
            key={n.min}
            x={n.x}
            y={n.y}
            className={n.min === 0 ? "vtimer-num vtimer-num-zero" : "vtimer-num"}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {n.min}
          </text>
        ))}
        <circle cx={C} cy={C} r={11} fill={idle ? "var(--text-faint)" : color} className="vtimer-hub" />
        <circle cx={C} cy={C} r={4.5} className="vtimer-hub-cap" />
      </svg>
      <div className={`vtimer-lcd ${paused ? "vtimer-lcd-paused" : ""}`}>{lcd}</div>
      {!idle && label && <div className="vtimer-name">{paused ? `${label} · paused` : label}</div>}
    </div>
  );
}

function Wedge({ frac, color }: { frac: number; color: string }) {
  if (frac <= 0) return null;
  if (frac >= 1) return <circle cx={C} cy={C} r={R_WEDGE} fill={color} className="vtimer-wedge" />;
  const theta = frac * 2 * Math.PI; // clockwise from 12 o'clock
  const endX = C + R_WEDGE * Math.sin(theta);
  const endY = C - R_WEDGE * Math.cos(theta);
  const largeArc = frac > 0.5 ? 1 : 0;
  const d = `M ${C} ${C} L ${C} ${C - R_WEDGE} A ${R_WEDGE} ${R_WEDGE} 0 ${largeArc} 1 ${endX} ${endY} Z`;
  return <path d={d} fill={color} className="vtimer-wedge" />;
}
