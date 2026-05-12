import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Hub from "./hub/Hub";
import { BudgetApp } from "./App";
import TimersApp from "./timers/TimersApp";
import "./App.css";

export default function Root() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      if (sess) setShowAuth(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Native deep-link handler for OAuth callbacks (budgetapp://callback#…).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = CapApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith("budgetapp://")) return;
      try {
        const hashIdx = url.indexOf("#");
        if (hashIdx >= 0) {
          // Implicit flow: tokens in fragment.
          const params = new URLSearchParams(url.slice(hashIdx + 1));
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        } else {
          // PKCE flow: ?code=…
          const queryIdx = url.indexOf("?");
          if (queryIdx >= 0) {
            const params = new URLSearchParams(url.slice(queryIdx + 1));
            const code = params.get("code");
            if (code) {
              await supabase.auth.exchangeCodeForSession(code);
            }
          }
        }
      } catch (e) {
        console.error("OAuth callback failed:", e);
      } finally {
        Browser.close().catch(() => {});
      }
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  if (!authReady) return <div className="app-loading">Loading…</div>;

  const userId = session?.user.id ?? null;
  const email = session?.user.email ?? null;
  const onSignIn = () => setShowAuth(true);
  const onSignOut = () => {
    supabase.auth.signOut().catch((e) => console.error("Sign out failed:", e));
  };

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={<Hub userId={userId} email={email} onSignIn={onSignIn} onSignOut={onSignOut} />}
        />
        <Route
          path="/timers"
          element={
            <TimersApp
              key={userId ?? "local"}
              userId={userId}
              email={email}
              onSignIn={onSignIn}
              onSignOut={onSignOut}
            />
          }
        />
        <Route
          path="/budget"
          element={
            <BudgetApp key={userId ?? "local"} userId={userId} email={email} onSignIn={onSignIn} />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
    </>
  );
}
