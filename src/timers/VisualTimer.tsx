import { fmtClock } from "./types";

// A Time-Timer-style dial: a colored pie wedge that shrinks clockwise as time
// runs out, with the remaining time shown digitally in the center.
export default function VisualTimer({
  remaining,
  total,
  color,
  label,
  paused,
}: {
  remaining: number; // seconds left
  total: number; // seconds the timer was set for
  color: string;
  label?: string;
  paused?: boolean;
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 14;
  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  // Minute ticks around the rim — denser for short timers, sparse for long ones.
  const totalMin = total / 60;
  const tickStep = totalMin <= 15 ? 1 : totalMin <= 60 ? 5 : 15;
  const tickCount = Math.max(1, Math.round(totalMin / tickStep));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * 360);

  return (
    <svg
      className={`vtimer ${paused ? "vtimer-paused" : ""}`}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label ? label + ": " : ""}${fmtClock(remaining)} remaining`}
    >
      {/* track */}
      <circle cx={cx} cy={cy} r={r} className="vtimer-track" />
      {/* remaining wedge */}
      <Wedge cx={cx} cy={cy} r={r} frac={frac} color={color} />
      {/* rim ticks */}
      {ticks.map((deg, i) => {
        const a = (deg - 90) * (Math.PI / 180);
        const r1 = r;
        const r2 = r - (i % (totalMin <= 15 ? 5 : 1) === 0 ? 10 : 6);
        return (
          <line
            key={i}
            x1={cx + r1 * Math.cos(a)}
            y1={cy + r1 * Math.sin(a)}
            x2={cx + r2 * Math.cos(a)}
            y2={cy + r2 * Math.sin(a)}
            className="vtimer-tick"
          />
        );
      })}
      {/* hub */}
      <circle cx={cx} cy={cy} r={6} className="vtimer-hub" />
      {/* digital readout */}
      <text x={cx} y={cy + 4} className="vtimer-time" textAnchor="middle">
        {fmtClock(remaining)}
      </text>
      {label && (
        <text x={cx} y={cy + 30} className="vtimer-label" textAnchor="middle">
          {paused ? "Paused" : label}
        </text>
      )}
    </svg>
  );
}

function Wedge({
  cx,
  cy,
  r,
  frac,
  color,
}: {
  cx: number;
  cy: number;
  r: number;
  frac: number;
  color: string;
}) {
  if (frac <= 0) return null;
  if (frac >= 1) return <circle cx={cx} cy={cy} r={r} fill={color} />;
  const theta = frac * 2 * Math.PI; // clockwise from 12 o'clock
  const endX = cx + r * Math.sin(theta);
  const endY = cy - r * Math.cos(theta);
  const largeArc = frac > 0.5 ? 1 : 0;
  const d = `M ${cx} ${cy} L ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
  return <path d={d} fill={color} />;
}
