import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Notice, RiskChip, Spinner } from "../components/ui";
import { titleCase, wordDiff } from "../lib";
import type { CompareResult, CompareRow, ContractSummary } from "../types";

/** Clause text with changed words struck through (removed, side A) or highlighted (added, side B). */
function Diff({ parts, kind }: { parts: { text: string; changed: boolean }[]; kind: "ins" | "del" }) {
  return <>{parts.map((p, i) => !p.changed ? <span key={i}>{p.text}</span> : kind === "ins" ? <ins key={i}>{p.text}</ins> : <del key={i}>{p.text}</del>)}</>;
}

const LABEL: Record<CompareRow["status"], string> = { unchanged: "Unchanged", modified: "Changed", added: "Added in B", removed: "Removed in B" };

export default function Compare() {
  const [options, setOptions] = useState<ContractSummary[] | null>(null);
  const [a, setA] = useState(""); const [b, setB] = useState("");
  const [res, setRes] = useState<CompareResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showSame, setShowSame] = useState(false);

  useEffect(() => { api.contracts({ status: "done", limit: 100 }).then((r) => setOptions(r.items)).catch((e) => setError(e.message)); }, []);

  async function run() {
    setBusy(true); setError(""); setRes(null);
    try { setRes(await api.compare(Number(a), Number(b))); } catch (e) { setError(e instanceof Error ? e.message : "Comparison failed."); } finally { setBusy(false); }
  }
  if (!options) return error ? <Notice>{error}</Notice> : <Spinner label="Loading…" />;
  if (options.length < 2) return (
    <div className="empty sheet"><h3>Compare two versions</h3><p className="muted">Review at least two contracts first, for example an original and a revised draft.</p><Link to="/new" className="btn primary">Review a contract</Link></div>);

  const rows = (res?.rows ?? []).filter((r) => showSame || r.status !== "unchanged");
  return (
    <div className="stack">
      <div><h1>Compare versions</h1><p className="muted" style={{ marginTop: 6 }}>See which clauses were added, removed or reworded, and whether the changes make the contract riskier.</p></div>
      <div className="sheet two">
        <label className="field"><span>Version A (original)</span><select value={a} onChange={(e) => setA(e.target.value)}><option value="">Choose a contract</option>{options.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <label className="field"><span>Version B (revised)</span><select value={b} onChange={(e) => setB(e.target.value)}><option value="">Choose a contract</option>{options.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
        <div><button className="btn primary" disabled={!a || !b || a === b || busy} onClick={run}>{busy ? "Comparing…" : "Compare"}</button></div>
      </div>
      {error && <Notice>{error}</Notice>}
      {res && (<>
        <div className="sheet">
          <div className="row" style={{ marginBottom: 8 }}><b style={{ fontFamily: "var(--serif)", fontSize: 22 }}>{res.score_a}% → {res.score_b}%</b>
            <span className={`chip ${res.delta > 2 ? "high" : res.delta < -2 ? "low" : "plain"}`}>{res.delta > 0 ? "+" : ""}{res.delta} points</span></div>
          <ul className="bullets" style={{ marginTop: 0 }}>{res.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div className="filters"><button className="pill" aria-pressed={showSame} onClick={() => setShowSame(!showSame)}>Show unchanged clauses ({res.counts.unchanged})</button></div>
        <div className="doc">
          <div className="diffrow listhead"><div className="diffcell small"><b>{res.a.title}</b></div><div className="diffcell small"><b>{res.b.title}</b></div></div>
          {rows.map((r, i) => {
            const d = r.clause_a && r.clause_b && r.status === "modified" ? wordDiff(r.clause_a, r.clause_b) : null;
            return (
            <div className="diffrow" key={i}>
              <div className="diffcell">{r.clause_a ? <><div className="meta"><RiskChip level={r.risk_a} /><span>{titleCase(r.category_a)}</span><span>{LABEL[r.status]}</span></div>
                {d ? <Diff parts={d.a} kind="del" /> : r.clause_a}</> : <span className="muted small">Not in this version</span>}</div>
              <div className="diffcell">{r.clause_b ? <><div className="meta"><RiskChip level={r.risk_b} /><span>{titleCase(r.category_b)}</span>{r.trend !== "same" && <span className={`chip ${r.trend === "riskier" ? "high" : "low"}`}>{r.trend}</span>}</div>
                {d ? <Diff parts={d.b} kind="ins" /> : r.clause_b}</> : <span className="muted small">Not in this version</span>}</div>
            </div>
          );})}
          {rows.length === 0 && <div className="empty"><p className="muted">No differences found.</p></div>}
        </div>
      </>)}
    </div>
  );
}
