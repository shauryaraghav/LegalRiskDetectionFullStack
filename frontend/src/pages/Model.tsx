import { useState } from "react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Notice, RiskChip, Spinner, usePolled } from "../components/ui";
import { formatDate, pct, titleCase } from "../lib";
import type { FeedbackItem, ModelRun } from "../types";

export default function Model() {
  const { user } = useAuth();
  const admin = user?.role === "admin";
  const metrics = usePolled(() => api.metrics(), () => false);
  const m = metrics.data;
  return (
    <div className="stack">
      <div><h1>Model quality</h1><p className="muted" style={{ marginTop: 6 }}>Scores come from cross-validation on a small, hand-labelled set, so treat them as indicative. Risk rating is the weaker half.</p></div>
      {metrics.error && <Notice kind="info">{metrics.error}</Notice>}
      {m && (
        <div className="metrics">
          <div className="sheet metric"><span className="muted small">Category accuracy</span><b>{pct(m.category.accuracy, 1)}</b><span className="muted small">Guessing the most common class: {pct(m.category.majority_baseline, 1)}</span></div>
          {m.real_contracts && <div className="sheet metric"><span className="muted small">On {m.real_contracts.contracts} unseen real contracts</span><b>{pct(m.real_contracts.accuracy, 1)}</b><span className="muted small">Before adding CUAD data: {pct(m.real_contracts.hand_only_accuracy, 1)}</span></div>}
          <div className="sheet metric"><span className="muted small">Risk accuracy (ML + rules)</span><b>{pct(m.risk_hybrid?.hybrid_accuracy ?? m.risk.accuracy, 1)}</b><span className="muted small">{m.risk_hybrid ? `ML alone: ${pct(m.risk_hybrid.ml_only_accuracy, 1)}` : `Baseline: ${pct(m.risk.majority_baseline, 1)}`}</span></div>
          <div className="sheet metric"><span className="muted small">Training clauses</span><b>{m.rows}</b><span className="muted small">Trained {formatDate(m.trained_at)}</span></div>
        </div>
      )}
      {admin ? <AdminPanel /> : <Notice kind="info">Corrections you send from a contract are reviewed by an admin before they are used to retrain the model.</Notice>}
    </div>
  );
}

function AdminPanel() {
  const queue = usePolled<FeedbackItem[]>(() => api.pendingFeedback(), () => false);
  const runs = usePolled<ModelRun[]>(() => api.modelRuns(), (v) => !!v?.some((r) => r.status === "running"), 2500);
  const [msg, setMsg] = useState("");

  async function review(id: number, approve: boolean) {
    setMsg("");
    try { await api.reviewFeedback(id, approve); queue.reload(); } catch (e) { setMsg(e instanceof Error ? e.message : "Review failed."); }
  }
  async function retrain() {
    setMsg("");
    try { await api.retrain(); runs.reload(); } catch (e) { setMsg(e instanceof Error ? e.message : "Could not start training."); }
  }
  const running = !!runs.data?.some((r) => r.status === "running");

  return (<>
    {msg && <Notice>{msg}</Notice>}
    <section className="stack">
      <div className="row"><h2 className="grow">Corrections to review</h2></div>
      {!queue.data ? <Spinner label="Loading…" /> : queue.data.length === 0 ? <p className="muted">No corrections waiting.</p> : (
        <div className="doc">{queue.data.map((f) => (
          <div className="diffrow" style={{ gridTemplateColumns: "1fr auto" }} key={f.id}>
            <div className="diffcell"><p style={{ marginBottom: 8 }}>{f.clause_text}</p>
              <p className="small muted row">From {f.submitted_by}: <RiskChip level={f.predicted_risk} /> {titleCase(f.predicted_category)} → <RiskChip level={f.correct_risk} /> {titleCase(f.correct_category)}</p></div>
            <div className="diffcell row" style={{ borderLeft: 0 }}>
              <button className="btn small primary" onClick={() => review(f.id, true)}>Approve</button>
              <button className="btn small" onClick={() => review(f.id, false)}>Reject</button></div>
          </div>))}</div>
      )}
    </section>
    <section className="stack">
      <div className="row"><h2 className="grow">Retraining</h2><button className="btn primary" disabled={running} onClick={retrain}>{running ? "Training…" : "Retrain with approved corrections"}</button></div>
      <div className="sheet flush"><table>
        <thead><tr><th>Started</th><th>Status</th><th>Rows</th><th>Category acc.</th><th>Risk acc.</th></tr></thead>
        <tbody>{(runs.data ?? []).map((r) => (
          <tr key={r.id}><td>{new Date(r.started_at).toLocaleString()}</td><td>{r.status}{r.error ? ` — ${r.error}` : ""}</td><td>{r.rows ?? "—"}</td><td>{pct(r.category_accuracy, 1)}</td><td>{pct(r.risk_accuracy, 1)}</td></tr>))}
          {runs.data?.length === 0 && <tr><td colSpan={5} className="muted">No training runs yet.</td></tr>}</tbody></table></div>
    </section>
  </>);
}
