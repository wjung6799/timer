import { Link } from "react-router-dom";
import "./Hub.css";

type Module = {
  to?: string;
  title: string;
  blurb: string;
  icon: string;
  soon?: boolean;
};

const MODULES: Module[] = [
  { to: "/timers", title: "Timers", blurb: "Visual countdown timers + a task checklist.", icon: "⏱" },
  { to: "/budget", title: "Time Budget", blurb: "Budget your day by category and track where the hours go.", icon: "📊" },
  { title: "Notes", blurb: "Quick capture for thoughts and lists.", icon: "📝", soon: true },
  { title: "Habits", blurb: "Daily streaks and check-ins.", icon: "✅", soon: true },
];

export default function Hub({
  userId,
  email,
  onSignIn,
  onSignOut,
}: {
  userId: string | null;
  email: string | null;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  return (
    <div className="app hub">
      <header className="header">
        <h1>Hub</h1>
        <div className="header-right">
          {userId ? (
            <button className="btn-icon btn-signout" onClick={onSignOut} title={email ?? undefined}>
              Sign out
            </button>
          ) : (
            <button className="btn-icon btn-signin" onClick={onSignIn}>
              Sign in
            </button>
          )}
        </div>
      </header>

      <p className="hub-tagline">Your productivity hub. More modules on the way.</p>

      <div className="hub-grid">
        {MODULES.map((m) =>
          m.to && !m.soon ? (
            <Link key={m.title} to={m.to} className="hub-card">
              <span className="hub-card-icon">{m.icon}</span>
              <span className="hub-card-title">{m.title}</span>
              <span className="hub-card-blurb">{m.blurb}</span>
            </Link>
          ) : (
            <div key={m.title} className="hub-card hub-card-soon">
              <span className="hub-card-icon">{m.icon}</span>
              <span className="hub-card-title">
                {m.title} <em>soon</em>
              </span>
              <span className="hub-card-blurb">{m.blurb}</span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
