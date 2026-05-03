# Time Budget — Core QA

A daily time-budgeting timer. Users allot 24 hours across categories, then start a timer when they do that activity.

## Steps

1. **Initial load** — App shows "Time Budget" header with today's date. Day summary card shows total allotted time, spent today (00:00:00), and day remaining (24:00:00). Three default categories are visible: Work (8h), Sleep (8h), Exercise (1h), each with their own progress bar at 0%.

2. **Start a timer** — Click "Start" on the Work category. The Work row should highlight with an accent border, the button should change to "Stop", and the spent counter should begin ticking up (00:00:01, 00:00:02, ...).

3. **Single active timer** — While Work is running, click "Start" on Exercise. Work should auto-stop (its accumulated time persists), and Exercise should now be the active one ticking up.

4. **Stop a timer** — Click "Stop" on the active category. The button reverts to "Start", and the spent time freezes.

5. **Add a new category** — Type "Reading" in the name field, "30m" in the budget field, and click Add. The new category appears at the bottom with a 30m budget and 0 spent.

6. **Edit a category** — Click "Edit" on Reading. Change budget to "1h 15m" and save. Display updates to "1h 15m".

7. **Remove a category** — Click "×" on Reading. The row is removed.

8. **Day summary updates** — Spent-today and day-remaining values update live as the active timer ticks.
