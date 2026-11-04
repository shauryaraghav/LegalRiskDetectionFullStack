import { useState } from "react";
import { api } from "../api";
import { highlightParts, riskTone, titleCase } from "../lib";
import type { Clause } from "../types";
import { RiskChip } from "./ui";

export default function ClauseCard({ clause, categories }: { clause: Clause; categories: string[] }) {
  const [open, setOpen] = useState(false);
  const [fbOpen, setFbOpen] = useState(false);
  const [cat, setCat] = useState(clause.category);
  const [risk, setRisk] = useState<string>(clause.risk);
  const [status, setStatus] = useState(clause.feedback_status);
  const [msg, setMsg] = useState("");
  const tone = riskTone(clause.risk);

  async function send() {
    setMsg("");
    try { await api.sendFeedback(clause.id, cat, risk); setStatus("pending"); setFbOpen(false); }
    catch (e) { setMsg(e instanceof Error ? e.message : "Could not send."); }
  }

  return (
    <article className={`clause ${tone}`}>
      <div className="margin">
        <span><RiskChip level={clause.risk} /></span>
        <span>{titleCase(clause.category)}</span>
        <span>Clause {clause.position}</span>
      </div>
      <div className="body">
        <p className="text">
          {highlightParts(clause.text, clause.risk === "Low" ? [] : clause.key_terms).map((p, i) => p.hit ? <mark key={i} className={tone}>{p.text}</mark> : <span key={i}>{p.text}</span>)}
        </p>
        <div className="row">
          <button className="toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide details" : "Why this rating"}</button>
          {status === "pending" && <span className="chip plain">Correction sent for review</span>}
          {status === "approved" && <span className="chip low">Correction approved</span>}
          {status === "rejected" && <span className="chip plain">Correction not used</span>}
          {!status && <button className="toggle" onClick={() => setFbOpen(!fbOpen)}>Rating looks wrong?</button>}
        </div>
        {open && (
          <div className="detail">
            <p>{clause.explanation}</p>
            {clause.reasons.length > 0 && <ul className="bullets" style={{ margin: 0 }}>{clause.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>}
            <p className="muted small">Category confidence {Math.round(clause.category_confidence)}% · risk confidence {Math.round(clause.risk_confidence)}% · {clause.source}</p>
            {clause.suggestions.map((s, i) => (
              <div className="fix" key={i}><b>{s.action}</b><q>“{s.safer_wording}”</q></div>
            ))}
          </div>
        )}
        {fbOpen && (
          <div className="detail">
            <p>What should this clause be? An admin reviews corrections before they are used to retrain the model.</p>
            <div className="fbform">
              <select aria-label="Correct category" value={cat} onChange={(e) => setCat(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select>
              <select aria-label="Correct risk" value={risk} onChange={(e) => setRisk(e.target.value)}>{["Low", "Medium", "High"].map((r) => <option key={r}>{r}</option>)}</select>
              <button className="btn small primary" onClick={send}>Send correction</button>
              <button className="btn small quiet" onClick={() => setFbOpen(false)}>Cancel</button>
            </div>
            {msg && <span className="small" style={{ color: "var(--hi-ink)" }} role="alert">{msg}</span>}
          </div>
        )}
      </div>
    </article>
  );
}
