import { useState } from "react";
import { supabase } from "./supabase";

type Mode = "signin" | "signup";

export default function Auth({ onClose }: { onClose?: () => void } = {}) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose?.();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
  };

  const card = (
    <div className="auth-card" onClick={onClose ? (e) => e.stopPropagation() : undefined}>
      {onClose && (
        <button
          type="button"
          className="auth-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      )}
      <h1>Time Budget</h1>
      <p className="auth-sub">{mode === "signup" ? "Create an account" : "Sign in"}</p>

      <button type="button" className="btn-google" onClick={google} disabled={busy}>
        Continue with Google
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={submit} className="auth-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
        <button type="submit" disabled={busy}>
          {busy ? "…" : mode === "signup" ? "Sign up" : "Sign in"}
        </button>
      </form>

      {err && <p className="auth-err">{err}</p>}
      {msg && <p className="auth-msg">{msg}</p>}

      <button
        type="button"
        className="auth-toggle"
        onClick={() => {
          setMode(mode === "signup" ? "signin" : "signup");
          setErr(null);
          setMsg(null);
        }}
      >
        {mode === "signup"
          ? "Already have an account? Sign in"
          : "No account? Sign up"}
      </button>
    </div>
  );

  if (onClose) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        {card}
      </div>
    );
  }
  return <div className="auth-wrap">{card}</div>;
}
