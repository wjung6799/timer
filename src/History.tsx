import { useEffect, useMemo, useState } from "react";
import { loadHistory, type DayHistoryRow } from "./db";
import { type Category, fmtDuration } from "./types";

type Range = 7 | 14 | 30;

type CategoryAgg = {
  id: string;
  name: string;
  color: string;
  totalSec: number;
  daysActive: number;
  avgPerActiveDay: number;
  daysWithBudget: number;
  underBudgetDays: number;
};

type DayPoint = {
  date: string;
  total: number;
  segments: { id: string; sec: number; color: string }[];
};

type CategoryWithFlags = Category & { isBuffer?: boolean };

function isUserCat(c: CategoryWithFlags): boolean {
  return !c.isIdle && !c.isBuffer;
}

export default function History({ userId }: { userId: string | null }) {
  const [rows, setRows] = useState<DayHistoryRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [range, setRange] = useState<Range>(14);

  useEffect(() => {
    loadHistory(userId, 60)
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [userId]);

  const view = useMemo(() => {
    if (!rows) return null;
    const visible = rows.slice(0, range);
    const aggs = new Map<string, CategoryAgg>();
    const daysChrono: DayPoint[] = [];
    let maxDayTotal = 0;
    let totalSec = 0;

    // rows arrive newest-first; iterate in that order, then reverse for chart.
    for (const row of visible) {
      const userCats = (row.categories as CategoryWithFlags[]).filter(isUserCat);
      let dayTotal = 0;
      const segments: DayPoint["segments"] = [];
      for (const c of userCats) {
        dayTotal += c.spentSec;
        segments.push({ id: c.id, sec: c.spentSec, color: c.color });
        let agg = aggs.get(c.id);
        if (!agg) {
          agg = {
            id: c.id,
            name: c.name,
            color: c.color,
            totalSec: 0,
            daysActive: 0,
            avgPerActiveDay: 0,
            daysWithBudget: 0,
            underBudgetDays: 0,
          };
          aggs.set(c.id, agg);
        }
        agg.name = c.name;
        agg.color = c.color;
        agg.totalSec += c.spentSec;
        if (c.spentSec > 0) agg.daysActive += 1;
        if (c.budgetSec > 0) {
          agg.daysWithBudget += 1;
          if (c.spentSec <= c.budgetSec) agg.underBudgetDays += 1;
        }
      }
      daysChrono.push({ date: row.date, total: dayTotal, segments });
      if (dayTotal > maxDayTotal) maxDayTotal = dayTotal;
      totalSec += dayTotal;
    }

    const byCategory = [...aggs.values()]
      .map((a) => ({
        ...a,
        avgPerActiveDay: a.daysActive > 0 ? Math.round(a.totalSec / a.daysActive) : 0,
      }))
      .sort((a, b) => b.totalSec - a.totalSec);

    const trackedDays = daysChrono.filter((d) => d.total > 0).length;
    const avgPerTrackedDay = trackedDays > 0 ? Math.round(totalSec / trackedDays) : 0;

    return {
      visible,
      byCategory,
      days: daysChrono.reverse(),
      maxDayTotal,
      totalSec,
      trackedDays,
      avgPerTrackedDay,
    };
  }, [rows, range]);

  if (err) {
    return (
      <div className="dashboard">
        <p className="auth-err">{err}</p>
      </div>
    );
  }
  if (rows == null) {
    return (
      <div className="dashboard">
        <p className="muted-text">Loading…</p>
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <div className="dashboard">
        <p className="muted-text">
          No history yet — past days will appear here after midnight rolls over.
        </p>
      </div>
    );
  }
  if (!view) return null;

  const yMax = niceMax(view.maxDayTotal);

  return (
    <div className="dashboard">
      <div className="dashboard-controls">
        <div className="range-tabs" role="tablist" aria-label="History range">
          {([7, 14, 30] as Range[]).map((n) => (
            <button
              key={n}
              role="tab"
              aria-selected={range === n}
              className={`range-tab ${range === n ? "active" : ""}`}
              onClick={() => setRange(n)}
            >
              {n}d
            </button>
          ))}
        </div>
      </div>

      <section className="dash-summary">
        <Stat label="Total tracked" value={fmtDuration(view.totalSec)} />
        <Stat label="Days tracked" value={`${view.trackedDays} / ${view.days.length}`} />
        <Stat label="Avg per tracked day" value={fmtDuration(view.avgPerTrackedDay)} />
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Daily totals</h3>
        <TrendChart days={view.days} max={yMax} />
        <Legend cats={view.byCategory} />
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">By category</h3>
        {view.byCategory.length === 0 ? (
          <p className="muted-text">No tracked time in this range.</p>
        ) : (
          <ul className="cat-stats">
            {view.byCategory.map((a) => (
              <li key={a.id} className="cat-stat-row">
                <span className="cat-stat-head">
                  <span className="cat-stat-swatch" style={{ background: a.color }} />
                  <span className="cat-stat-name">{a.name}</span>
                </span>
                <span className="cat-stat-figs">
                  <Fig label="Total" value={fmtDuration(a.totalSec)} />
                  <Fig label="Avg/day" value={fmtDuration(a.avgPerActiveDay)} />
                  <Fig label="Days" value={`${a.daysActive}`} />
                  {a.daysWithBudget > 0 && (
                    <Fig
                      label="On budget"
                      value={`${Math.round((a.underBudgetDays / a.daysWithBudget) * 100)}%`}
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="dash-card">
        <h3 className="dash-card-title">Days</h3>
        <ul className="history-list">
          {view.visible.map((row) => {
            const userCats = (row.categories as CategoryWithFlags[]).filter(isUserCat);
            const total = userCats.reduce((s, c) => s + c.spentSec, 0);
            return (
              <li key={row.date} className="history-row">
                <div className="history-row-head">
                  <span className="history-date">{row.date}</span>
                  <span className="history-total">{fmtDuration(total)}</span>
                </div>
                <div className="history-cats">
                  {userCats.map((c) => (
                    <span key={c.id} className="history-cat">
                      <span className="history-swatch" style={{ background: c.color }} />
                      {c.name} · {fmtDuration(c.spentSec)}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <span className="cat-stat-fig">
      <span className="cat-stat-fig-label">{label}</span>
      <span className="cat-stat-fig-val">{value}</span>
    </span>
  );
}

function Legend({ cats }: { cats: CategoryAgg[] }) {
  if (cats.length === 0) return null;
  return (
    <div className="trend-legend">
      {cats.map((c) => (
        <span key={c.id} className="trend-legend-item">
          <span className="trend-legend-swatch" style={{ background: c.color }} />
          {c.name}
        </span>
      ))}
    </div>
  );
}

function TrendChart({ days, max }: { days: DayPoint[]; max: number }) {
  const ticks = computeTicks(max);
  return (
    <div className="trend-chart">
      <div className="trend-plot">
        <div className="trend-y-axis" aria-hidden="true">
          {ticks.map((t) => (
            <div
              key={t}
              className="trend-tick"
              style={{ bottom: `${(t / max) * 100}%` }}
            >
              <span className="trend-tick-label">{t / 3600}h</span>
              <span className="trend-tick-line" />
            </div>
          ))}
        </div>
        <div className="trend-bars">
          {days.map((day) => {
            const heightPct = max > 0 ? (day.total / max) * 100 : 0;
            return (
              <div
                key={day.date}
                className="trend-bar-wrap"
                title={`${day.date}: ${fmtDuration(day.total)}`}
              >
                <div className="trend-bar-track">
                  <div className="trend-bar" style={{ height: `${heightPct}%` }}>
                    {day.segments.map((seg, i) => (
                      <div
                        key={i}
                        className="trend-seg"
                        style={{
                          flexBasis: `${day.total > 0 ? (seg.sec / day.total) * 100 : 0}%`,
                          background: seg.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="trend-x-axis">
        {days.map((day) => (
          <div key={day.date} className="trend-x-label">
            {shortDate(day.date)}
          </div>
        ))}
      </div>
    </div>
  );
}

function niceMax(maxSec: number): number {
  const hours = Math.max(1, Math.ceil(maxSec / 3600));
  const step = hours <= 4 ? 1 : hours <= 8 ? 2 : hours <= 16 ? 4 : 6;
  const rounded = Math.ceil(hours / step) * step;
  return rounded * 3600;
}

function computeTicks(maxSec: number): number[] {
  const hours = Math.round(maxSec / 3600);
  const step = hours <= 4 ? 1 : hours <= 8 ? 2 : hours <= 16 ? 4 : 6;
  const out: number[] = [];
  for (let h = 0; h <= hours; h += step) out.push(h * 3600);
  return out;
}

function shortDate(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}
