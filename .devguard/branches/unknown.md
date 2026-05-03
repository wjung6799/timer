# Branch: unknown

---
date: 2026-05-03T08:03:21.606Z
branch: unknown
commit: none
summary: "Built v1 of Time Budget app — daily 24h time-budgeting timer with single active category"
---

# Built v1 of Time Budget app — daily 24h time-budgeting timer with single active category

## What Changed
Scaffolded Vite + React + TS in /Users/wjung/dev/budget. Added src/types.ts (state model, localStorage persistence, parseBudget supporting "1h 30m 15s", fmtDuration/fmtBudget) and rewrote src/App.tsx + App.css for the full UI: header with date, day-summary card (allotted / spent / day-remaining / unallotted-or-over-allotted stats + multi-segment day bar with 24h marker), category rows (color stripe, name, live spent / budget, progress bar with red hatched over-portion, Start/Stop/Edit/×, inline edit), and AddCategoryForm with validation. App auto-stops the previous category when a new one starts; commits elapsed on stop, beforeunload, and day rollover. Daily reset zeros spent for all categories at midnight. Default categories seeded: Work 8h, Sleep 8h, Exercise 1h. Replaced Vite starter index.css with dark/light theme tokens; deleted Vite hero/icon assets.</changes>
<parameter name="decisions">Single-page React + Vite + localStorage (no backend) for fastest path to a usable app. Single active timer enforced at the state-mutation level — startTimer() always commits any active timer first, eliminating multi-active edge cases. Time stored as integer seconds across the board to avoid float drift. Parser is token-based (`(\d+)\s*(h|m|s)`) so "1h 30m" / "10s" / "2h" all work; a bare number is interpreted as hours. Day rollover compares stored date string to today's date in the tick interval — simple and resilient to long sleeps. Over-budget is "soft": row turns red with a hatched stripe and "Over by …" footer, but the timer keeps counting (matches the YNAB-style mental model the user described).</decisions>
<parameter name="issues">Checkmate's accessibility tree returned only "page Time Budget" (no descendant nodes), so role+name locators worked for unique buttons but multiple "Start" rows required nth-child CSS selectors as a fallback. Not a blocker; tests passed. All 4 QA steps in .checkmate/specs/time-budget-core.md passed.</issues>
<parameter name="next_steps">Possible iterations: (a) history view of prior days, (b) keyboard shortcuts (space to toggle active timer), (c) drag-to-reorder categories, (d) export/import JSON for backup, (e) per-category notes/sessions log, (f) weekly aggregate view, (g) progressive web app / install prompt so it lives on the home screen, (h) optional notification when a category goes over budget.</next_steps>
</invoke>


---

<!-- 2026-05-03 03:14 -->

---
date: 2026-05-03T10:14:44.590Z
branch: unknown
commit: none
summary: "Applied initial Supabase schema for app_state and day_history with RLS"
---

# Applied initial Supabase schema for app_state and day_history with RLS

## What Changed
Applied docs/supabase-schema.sql to Supabase project zqefnviebnwlcoeghaxb via MCP apply_migration as init_app_state_and_history. Created public.app_state (user_id PK → auth.users, state jsonb, updated_at) and public.day_history (composite PK user_id+date → auth.users, categories jsonb, created_at) plus day_history_user_date_idx. RLS enabled on both with owner policies (auth.uid() = user_id) for all operations. No app code changed.

## Decisions
Used apply_migration rather than execute_sql so the change is recorded in Supabase's migration history. Kept SQL identical to docs/supabase-schema.sql so the file remains the source of truth.

## Next Steps
In Supabase dashboard (manual, MCP can't do these): 1) Auth → Providers → Google: paste Google Cloud OAuth client ID + secret. 2) Auth → URL Configuration: add http://localhost:5173 to redirect allow-list. 3) Optionally disable email confirmation for dev.


---

<!-- 2026-05-03 03:36 -->

---
date: 2026-05-03T10:36:25.560Z
branch: unknown
commit: none
summary: "Convert History modal into a Today/History tab with a real dashboard view"
---

# Convert History modal into a Today/History tab with a real dashboard view

## What Changed
- App.tsx: replaced showHistory modal state with a "today" | "history" view tab toggle in the header. Wrapped the today UI in a conditional and render <History /> inline when the History tab is active. Added `void coverage;` to CategoryRow to silence a pre-existing TS6133 (unused prop) that surfaced once the build was re-run.
- History.tsx: rewritten from a modal list into a dashboard. Loads up to 60 days, exposes a 7d/14d/30d range selector, computes aggregates (per-category total/avg-per-active-day/days-active/on-budget %, plus range-level total + tracked days + avg per tracked day) and renders:
  - summary stat cards
  - daily totals stacked bar chart (CSS/flex, no chart lib) with hour ticks, x labels, and a category legend
  - per-category stat rows
  - the existing days list at the bottom
- App.css: removed the modal styles for History; added .view-tabs / .view-tab, .dashboard, .range-tabs, .dash-summary, .dash-card, the trend chart styles (.trend-plot/.trend-y-axis/.trend-tick/.trend-bars/.trend-bar/.trend-seg/.trend-x-axis/.trend-legend), and per-category stat row styles.</changes>
<parameter name="decisions">- Dependency-light: hand-rolled the stacked bar chart with flexbox rather than pulling in Recharts. Each bar is a flex column with stacked segments sized by % of the day total, and the bar's height is % of a niceMax y-axis.
- Aggregate categories by id (stable across day rollovers per normalizeRemoteState), using the latest row's name/color so renames/recolors win.
- Used `void coverage;` instead of removing the unused prop from CategoryRow — matches the existing DayBar pattern and keeps the diff minimal.
- Kept the days list inside the dashboard rather than dropping it; it's the most concrete view of what was tracked.</decisions>
<parameter name="issues">- Build initially failed on a pre-existing TS6133 for CategoryRow's unused `coverage` prop; fixed via `void coverage;`.
- Couldn't visually verify the data-rendered dashboard from a fresh local environment (no archived history yet). Verified the tab switch and empty state in the browser; the data path is exercised only by code review + typecheck.</issues>
<parameter name="next_steps">- Once a day rolls over (or via manually seeded localStorage history), open the History tab and visually confirm chart bars, legend, and per-category stats render correctly.
- Consider: highlight today's bar differently if today is included; add a hover tooltip showing per-segment breakdown; add a heatmap/streak strip for at-a-glance consistency.</next_steps>
</invoke>
