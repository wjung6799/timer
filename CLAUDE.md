# Dev Diary

After completing a task, switching branches, or making a significant commit, call the devdiary write_entry tool to log what was done and what's next.

# Stack

- Vite + React + TypeScript (web)
- Supabase (auth + Postgres with RLS)
- Capacitor (iOS native shell)
- Web deploys to Vercel from `main`; iOS builds locally via Xcode.

# Build flow

- `npm run dev` — Vite dev server (web only).
- `npm run build` — produce `dist/` for both web deploy and the iOS bundle.
- `npm run ios:sync` — build web + copy assets into `ios/`.
- `npm run ios:open` — sync + open Xcode (then ⌘R to run on simulator/device).
- After editing `Info.plist`, `PrivacyInfo.xcprivacy`, or any iOS-side file, run `cap sync ios` again.

# OAuth on iOS

- Custom URL scheme: `budgetapp://callback` (in `Info.plist` `CFBundleURLTypes`).
- Supabase Auth → URL Configuration → Redirect URLs must include `budgetapp://**`.
- The deep-link handler is in `App.tsx` (top-level `App` component); parses the fragment or `?code=` and calls `setSession` / `exchangeCodeForSession`, then closes the in-app browser.

# Apple compliance reminders

- Sign in with Apple is required because Google sign-in is offered.
- `PrivacyInfo.xcprivacy` lives at `ios/App/App/PrivacyInfo.xcprivacy` — must be added to the Xcode project membership manually the first time.
- Privacy policy is `public/privacy.html`, deployed at `/privacy.html`.
- Account deletion already implemented via `delete_user()` Postgres RPC.
