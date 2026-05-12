# Dev Diary

After completing a task, switching branches, or making a significant commit, call the devdiary write_entry tool to log what was done and what's next.

# Stack

- Vite + React + TypeScript (web), `react-router-dom` for routing.
- Supabase (auth + Postgres with RLS)
- Capacitor (iOS native shell)
- Web deploys to Vercel from `main`; iOS builds locally via Xcode.

# App structure

The app is a "productivity hub" with module routes:

- `/` — Hub landing (`src/hub/Hub.tsx`), a card grid linking to modules.
- `/timers` — Timers module (`src/timers/`): visual countdown timers + a task checklist. State in `timers_state` table / `timers.state` localStorage.
- `/budget` — the original Time Budget app (`BudgetApp` in `src/App.tsx`). State in `app_state` / `day_history`.

`src/Root.tsx` owns auth bootstrap (session, OAuth deep-link handler) and renders the routes. `src/main.tsx` wraps it in `<BrowserRouter>`. Vercel SPA fallback is in `vercel.json`.
Each module persists with the same pattern as Budget: per-user Supabase table when signed in, localStorage when not, migrating local → remote on first sign-in. Schema in `docs/supabase-schema.sql`.

# Build flow

- `npm run dev` — Vite dev server (web only).
- `npm run build` — produce `dist/` for both web deploy and the iOS bundle.
- `npm run ios:sync` — build web + copy assets into `ios/`.
- `npm run ios:open` — sync + open Xcode (then ⌘R to run on simulator/device).
- After editing `Info.plist`, `PrivacyInfo.xcprivacy`, or any iOS-side file, run `cap sync ios` again.

# OAuth on iOS

- Custom URL scheme: `budgetapp://callback` (in `Info.plist` `CFBundleURLTypes`).
- Supabase Auth → URL Configuration → Redirect URLs must include `budgetapp://**`.
- The deep-link handler is in `src/Root.tsx`; parses the fragment or `?code=` and calls `setSession` / `exchangeCodeForSession`, then closes the in-app browser.

# Apple compliance reminders

- Sign in with Apple is required because Google sign-in is offered.
- `PrivacyInfo.xcprivacy` lives at `ios/App/App/PrivacyInfo.xcprivacy` — must be added to the Xcode project membership manually the first time.
- Privacy policy is `public/privacy.html`, deployed at `/privacy.html`.
- Account deletion already implemented via `delete_user()` Postgres RPC.
