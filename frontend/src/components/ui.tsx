import { useEffect, useRef, useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, Link } from "react-router-dom";
import { useAuth } from "../auth";
import { riskTone, rulerPosition } from "../lib";
import type { Overall, Risk } from "../types";

export function Layout() {
  const { user, loading, signOut } = useAuth();
  if (loading) return <div className="page"><span className="spin" aria-label="Loading" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="brand"><span className="brand-mark"><i /></span>Clause</Link>
          <nav className="nav" aria-label="Main">
            <NavLink to="/" end>Contracts</NavLink>
            <NavLink to="/new">Review a contract</NavLink>
            <NavLink to="/compare">Compare</NavLink>
            <NavLink to="/model">Model</NavLink>
          </nav>
          <span className="who">{user.email}{user.role === "admin" ? " (admin)" : ""}</span>
          <button className="btn quiet" style={{ color: "#c9d1de" }} onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="page"><Outlet /></main>
    </>
  );
}

export const RiskChip = ({ level }: { level: Risk | Overall | "" | null }) =>
  level ? <span className={`chip ${riskTone(level)}`}>{level}</span> : null;

export function Notice({ kind = "error", children }: { kind?: "error" | "info" | "ok"; children: ReactNode }) {
  return <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>{children}</div>;
}

export const Spinner = ({ label }: { label: string }) => <span className="row"><span className="spin" aria-hidden /> {label}</span>;

/** Low / Medium / High ruler with a pin at the score. */
export function Ruler({ score }: { score: number }) {
  return (
    <div role="img" aria-label={`Risk score ${score} out of 100`}>
      <div className="ruler"><span className="pin" style={{ left: `${rulerPosition(score)}%` }} /></div>
      <div className="ruler-scale"><span>Low</span><span>Medium</span><span>High</span></div>
    </div>
  );
}

export function MiniBar({ high, medium, low }: { high: number; medium: number; low: number }) {
  const total = Math.max(1, high + medium + low);
  return (
    <div className="mini" role="img" aria-label={`${high} high, ${medium} medium, ${low} low`}>
      <i style={{ width: `${(high / total) * 100}%` }} /><i style={{ width: `${(medium / total) * 100}%` }} /><i style={{ width: `${(low / total) * 100}%` }} />
    </div>
  );
}

/** Run `load` now and (while `active`) every `ms`. Returns the latest value, an error and a manual reload. */
export function usePolled<T>(load: () => Promise<T>, active: (v: T | null) => boolean, ms = 1500, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const loadRef = useRef(load);
  loadRef.current = load;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let stop = false, timer: number | undefined;
    const run = async () => {
      try {
        const v = await loadRef.current();
        if (stop) return;
        setData(v); setError("");
        if (active(v)) timer = window.setTimeout(run, ms);
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    };
    run();
    return () => { stop = true; window.clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  return { data, error, reload: () => setTick((n) => n + 1) };
}
