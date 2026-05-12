import { useRef } from "react";
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
//
// When `onSet` is given the dial becomes interactive: drag (or tap) anywhere on
// it to set the minutes, just like twisting a real Time Timer.

const FACE_SEC = 60 * 60;
const FACE_MIN = 60;
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
  onSet,
}: {
  remaining: number; // seconds shown (remaining, or the draft when setting)
  color: string;
  label?: string;
  paused?: boolean;
  onSet?: (sec: number) => void; // present → dial is draggable to set minutes
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const lastMin = useRef<number | null>(null);

  const interactive = !!onSet;
  const frac = Math.max(0, Math.min(1, remaining / FACE_SEC));
  const handleAngle = frac * 2 * Math.PI;
  const handleX = C + R_WEDGE * Math.sin(handleAngle);
  const handleY = C - R_WEDGE * Math.cos(handleAngle);

  const ticks = Array.from({ length: FACE_MIN }, (_, m) => {
    const a = (m / FACE_MIN) * 2 * Math.PI; // clockwise from 12 o'clock
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
    const a = (min / FACE_MIN) * 2 * Math.PI;
    return { min, x: C + R_NUM * Math.sin(a), y: C - R_NUM * Math.cos(a) };
  });

  // --- drag-to-set ---------------------------------------------------------
  function minutesFromEvent(e: React.PointerEvent): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return null;
    const x = ((e.clientX - rect.left) / rect.width) * VB;
    const y = ((e.clientY - rect.top) / rect.height) * VB;
    const dx = x - C;
    const dy = y - C;
    if (Math.hypot(dx, dy) < 10) return null; // too close to the hub — ambiguous
    let theta = Math.atan2(dx, -dy); // 0 at top, increasing clockwise
    if (theta < 0) theta += 2 * Math.PI;
    let min = Math.round((theta / (2 * Math.PI)) * FACE_MIN);
    // Don't let a drag jump across the 0/60 seam at the top.
    const last = lastMin.current;
    if (last != null) {
      if (last >= 45 && min <= 15) min = FACE_MIN;
      else if (last <= 15 && min >= 45) min = 0;
    }
    return Math.max(0, Math.min(FACE_MIN, min));
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!interactive) return;
    dragging.current = true;
    lastMin.current = null;
    svgRef.current?.focus();
    const min = minutesFromEvent(e);
    if (min != null) {
      lastMin.current = min;
      onSet!(min * 60);
    }
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!interactive || !dragging.current) return;
    const min = minutesFromEvent(e);
    if (min == null) return;
    lastMin.current = min;
    onSet!(min * 60);
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!interactive) return;
    dragging.current = false;
    lastMin.current = null;
    try {
      svgRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!interactive) return;
    const cur = Math.round(remaining / 60);
    let next = cur;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") next = cur + 1;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") next = cur - 1;
    else if (e.key === "PageUp") next = cur + 5;
    else if (e.key === "PageDown") next = cur - 5;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = FACE_MIN;
    else return;
    e.preventDefault();
    onSet!(Math.max(0, Math.min(FACE_MIN, next)) * 60);
  }

  return (
    <div className={`vtimer ${paused ? "vtimer-paused" : ""} ${interactive ? "vtimer-set" : ""}`}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB} ${VB}`}
        className={`vtimer-svg ${interactive ? "vtimer-svg-set" : ""}`}
        role={interactive ? "slider" : "img"}
        aria-label={interactive ? `Set timer minutes` : `${label ? label + ": " : ""}${fmtClock(remaining)} remaining`}
        aria-valuemin={interactive ? 0 : undefined}
        aria-valuemax={interactive ? FACE_MIN : undefined}
        aria-valuenow={interactive ? Math.round(remaining / 60) : undefined}
        aria-valuetext={interactive ? `${Math.round(remaining / 60)} minutes` : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
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
        {interactive && <circle cx={handleX} cy={handleY} r={9} className="vtimer-handle" style={{ stroke: color }} />}
        <circle cx={C} cy={C} r={11} fill={color} className="vtimer-hub" />
        <circle cx={C} cy={C} r={4.5} className="vtimer-hub-cap" />
      </svg>
      <div className={`vtimer-lcd ${paused ? "vtimer-lcd-paused" : ""}`}>{fmtClock(remaining)}</div>
      {!interactive && label && <div className="vtimer-name">{paused ? `${label} · paused` : label}</div>}
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
