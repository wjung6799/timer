# Gantt-Style Day Timeline — Proposal

**Status:** parked. Prototype at [`prototypes/gantt-bar.html`](prototypes/gantt-bar.html).

## TL;DR

Today the day bar packs every minute of every category against the left edge.
A Gantt-style bar would place each session at the actual time of day it
happened. Same data, but you can finally answer: *when* did I do that?

## What's wrong with the current bar

It tells you **how much**, but lies by omission about **when**.

```
Current bar (cumulative, packed left)
0:00                                                              24:00
├─────────────────────────────────────────────────────────────────┤
[██ Work 4h ██][█ Ex 1h █]·······································│ ← now (15:00)
                                                                  
Reads as: "You've done 4h work + 1h exercise"
Hides:   The work was 8 disconnected 30min sessions across 12 hours.
         The exercise was at 6am, before anything else.
         You haven't been productive since 11am.
```

Two days that look identical on the cumulative bar can be wildly different in
practice. Same totals, very different shapes:

```
Day A: deep work morning, exercise evening
0:00         6:00         12:00        18:00        24:00
├────────────┼────────────┼────────────┼────────────┤
        [████████ Work ████████]      [█ Ex █]
                                       
Day B: scattered work all day, no exercise gap
0:00         6:00         12:00        18:00        24:00
├────────────┼────────────┼────────────┼────────────┤
   [██]   [██] [██]    [██]  [██]    [██]    [██]
   Work   Work Work    Work  Work    Work    Work + Ex squeezed in
```

The cumulative bar shows both as `[████ 4h Work ████][█ 1h Ex █]`. The Gantt
bar shows the truth.

## Why it actually matters

| Question you can't answer today | Gantt answers it |
|---|---|
| "Do I always do my best work in the morning?" | Long unbroken Work segments cluster on the left |
| "Am I exercising at the same time each day?" | Vertical alignment across days |
| "How fragmented is my day?" | Count distinct segments — many short = scattered |
| "When did I lose 3 hours yesterday?" | Find the empty gap between 14:00 and 17:00 |
| "If I keep this pace, when will I hit my Float?" | Project the trend forward from the now-marker |
| "Was this 2h work block actually 2h, or 2h spread over 5h?" | Length of one segment = real focus time |

## Visuals

### Current bar (today)

<svg viewBox="0 0 600 60" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:600px;">
  <rect x="0" y="20" width="600" height="14" rx="7" fill="#1f232c"/>
  <rect x="0" y="20" width="100" height="14" fill="#4f46e5"/>
  <rect x="100" y="20" width="25" height="14" fill="#10b981"/>
  <line x1="375" y1="14" x2="375" y2="40" stroke="#e6e9ef" stroke-width="2"/>
  <text x="375" y="10" font-family="system-ui" font-size="10" fill="#9aa3b2" text-anchor="middle">15:00</text>
  <text x="0" y="52" font-family="system-ui" font-size="9" fill="#6b7280">0:00</text>
  <text x="148" y="52" font-family="system-ui" font-size="9" fill="#6b7280">6:00</text>
  <text x="296" y="52" font-family="system-ui" font-size="9" fill="#6b7280">12:00</text>
  <text x="444" y="52" font-family="system-ui" font-size="9" fill="#6b7280">18:00</text>
  <text x="592" y="52" font-family="system-ui" font-size="9" fill="#6b7280">24:00</text>
</svg>

Work and exercise are stacked left. Where they actually happened is invisible.

### Gantt bar (proposed)

<svg viewBox="0 0 600 60" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:600px;">
  <rect x="0" y="20" width="600" height="14" rx="7" fill="#1f232c"/>
  <!-- past shading -->
  <rect x="0" y="20" width="375" height="14" fill="rgba(125,132,145,0.15)"/>
  <!-- Sessions: exercise 06:00-07:00, work 09:00-11:30, work 13:00-14:30 -->
  <rect x="150" y="20" width="25" height="14" fill="#10b981"/>
  <rect x="225" y="20" width="62" height="14" fill="#4f46e5"/>
  <rect x="325" y="20" width="38" height="14" fill="#4f46e5"/>
  <line x1="375" y1="14" x2="375" y2="40" stroke="#e6e9ef" stroke-width="2"/>
  <text x="375" y="10" font-family="system-ui" font-size="10" fill="#9aa3b2" text-anchor="middle">15:00</text>
  <text x="0" y="52" font-family="system-ui" font-size="9" fill="#6b7280">0:00</text>
  <text x="148" y="52" font-family="system-ui" font-size="9" fill="#6b7280">6:00</text>
  <text x="296" y="52" font-family="system-ui" font-size="9" fill="#6b7280">12:00</text>
  <text x="444" y="52" font-family="system-ui" font-size="9" fill="#6b7280">18:00</text>
  <text x="592" y="52" font-family="system-ui" font-size="9" fill="#6b7280">24:00</text>
</svg>

Same totals. You can see exercise was at 6am, work was two blocks (morning
and after lunch), and there's a real gap from 11:30–13:00 (lunch?) and from
14:30 to now (uh oh).

### Multi-day view (the real unlock)

Stack 7 days of Gantt bars and patterns leap out:

<svg viewBox="0 0 600 220" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:600px;">
  <!-- Mon -->
  <text x="0" y="22" font-family="system-ui" font-size="10" fill="#9aa3b2">Mon</text>
  <rect x="35" y="14" width="565" height="12" rx="6" fill="#1f232c"/>
  <rect x="178" y="14" width="24" height="12" fill="#10b981"/>
  <rect x="247" y="14" width="71" height="12" fill="#4f46e5"/>
  <rect x="343" y="14" width="59" height="12" fill="#4f46e5"/>
  <!-- Tue -->
  <text x="0" y="44" font-family="system-ui" font-size="10" fill="#9aa3b2">Tue</text>
  <rect x="35" y="36" width="565" height="12" rx="6" fill="#1f232c"/>
  <rect x="174" y="36" width="28" height="12" fill="#10b981"/>
  <rect x="247" y="36" width="83" height="12" fill="#4f46e5"/>
  <rect x="354" y="36" width="47" height="12" fill="#4f46e5"/>
  <!-- Wed -->
  <text x="0" y="66" font-family="system-ui" font-size="10" fill="#9aa3b2">Wed</text>
  <rect x="35" y="58" width="565" height="12" rx="6" fill="#1f232c"/>
  <rect x="247" y="58" width="71" height="12" fill="#4f46e5"/>
  <rect x="343" y="58" width="71" height="12" fill="#4f46e5"/>
  <rect x="461" y="58" width="24" height="12" fill="#10b981"/>
  <!-- Thu -->
  <text x="0" y="88" font-family="system-ui" font-size="10" fill="#9aa3b2">Thu</text>
  <rect x="35" y="80" width="565" height="12" rx="6" fill="#1f232c"/>
  <rect x="180" y="80" width="22" height="12" fill="#10b981"/>
  <rect x="247" y="80" width="59" height="12" fill="#4f46e5"/>
  <rect x="330" y="80" width="71" height="12" fill="#4f46e5"/>
  <!-- Fri -->
  <text x="0" y="110" font-family="system-ui" font-size="10" fill="#9aa3b2">Fri</text>
  <rect x="35" y="102" width="565" height="12" rx="6" fill="#1f232c"/>
  <rect x="247" y="102" width="35" height="12" fill="#4f46e5"/>
  <rect x="318" y="102" width="35" height="12" fill="#4f46e5"/>
  <rect x="378" y="102" width="35" height="12" fill="#4f46e5"/>
  <rect x="437" y="102" width="35" height="12" fill="#4f46e5"/>
  <!-- Annotations -->
  <line x1="186" y1="8" x2="186" y2="96" stroke="#f59e0b" stroke-width="1" stroke-dasharray="3,3" opacity="0.7"/>
  <text x="194" y="146" font-family="system-ui" font-size="11" fill="#f59e0b">↑ You exercise around 6am Mon/Tue/Thu — but skip Wed/Fri</text>
  <line x1="247" y1="8" x2="247" y2="120" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
  <text x="255" y="166" font-family="system-ui" font-size="11" fill="#10b981">↑ Deep work consistently starts at 9am — protect this slot</text>
  <text x="35" y="186" font-family="system-ui" font-size="11" fill="#ef4444">⚠  Friday: 4 fragmented work sessions, no long block — protect mornings?</text>
  <text x="35" y="206" font-family="system-ui" font-size="9" fill="#6b7280">0:00         6:00         12:00         18:00         24:00</text>
</svg>

This is the view that changes how you think about your time. The cumulative
bar can never produce it.

## Concrete benefits

1. **Pattern recognition** — see your daily rhythm without analytics, just by
   looking. The eye picks up vertical alignment across days instantly.
2. **Honest fragmentation signal** — a 4h work total split into 8 sessions
   looks identical to one focused 4h block today. Gantt makes the difference
   visible.
3. **Gap diagnosis** — empty space on the bar tells you where untracked time
   went. "I lost 3 hours after lunch" is a discoverable insight, not a guess.
4. **Forecasting** — extrapolating from "where I am now" to "where I'll end
   up" only makes sense on a real timeline.
5. **Behavioral change loop** — "I want to do focused work in the morning"
   becomes a measurable goal, not a vibe.

## What it costs

### Data model
Currently we store `Category.spentSec` (a counter). Gantt needs sessions:

```ts
type Session = { categoryId: string; startMs: number; endMs: number };
```

Per-day sessions list. ~50–200 sessions/day worst case. Trivially fits in
localStorage.

### Migration
Existing `spentSec` becomes derived — `sum of (endMs - startMs)` across
sessions. Pre-migration data: seed one synthetic session ending at midnight
of that day's reset, so totals don't change.

### UI
- Gantt bar replaces the day bar (or toggleable).
- Hover tooltip per session: category name, start–end, duration.
- Multi-day view as a new tab/section (history).
- Existing per-category rows stay unchanged.

### Effort estimate
Roughly:
- Session log (model + start/stop wiring): half a day.
- Single-day Gantt rendering: half a day.
- Multi-day history view: a day.
- Edge cases (sessions crossing midnight, overlapping sessions if we ever
  allow multi-active, edits): half a day.

Call it **2–3 days** for a polished version.

## Risks

- **Sparse Gantt looks empty.** If someone tracks 30min/day of one category,
  the bar is mostly background. Mitigation: render gaps in a faint pattern,
  or auto-zoom to the active range.
- **Multi-day view scaling.** 30 days of bars = a lot of pixels. Mitigation:
  collapse weekends or use a heatmap as the zoomed-out view.
- **Session edit UX.** Forgot to start the timer? Need a way to add/edit
  sessions. Not in v1 — but eventually required.
- **Sleep crosses midnight.** Sessions that span days need to split or
  display gracefully. Tractable but a finicky edge case.

## Recommendation

Build it after the next round of "do you actually use this?" feedback. If you
keep using the app daily for two weeks, the Gantt view is what makes the data
worth looking at. If you don't, the simpler bar was enough and Gantt would be
polish on a tool nobody uses.

In the meantime: **prototype is at [`prototypes/gantt-bar.html`](prototypes/gantt-bar.html)** — open it
in a browser to interact. Same look as production would have.
