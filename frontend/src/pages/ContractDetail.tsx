import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import ClauseCard from "../components/ClauseCard";
import { Notice, RiskChip, Ruler, Spinner, usePolled } from "../components/ui";
import { riskTone, titleCase } from "../lib";
import type { ContractDetail, Meta, Risk } from "../types";

type Tab = "clauses" | "plan" | "missing" | "whatif";

export default function ContractPage() {
  const id = Number(useParams().id);
  const nav = useNavigate();
  const { data: c, error } = usePolled<ContractDetail>(() => api.contract(id), (v) => v?.status === "pending" || v?.status === "processing", 1500, [id]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [tab, setTab] = useState<Tab>("clauses");
  const [filter, setFilter] = useState<Risk | "All">("All");
  const [actionErr, setActionErr] = useState("");

  useEffect(() => { api.meta().then(setMeta).catch(() => undefined); }, []);

  async function download() {
    setActionErr("");
    try {
      const url = URL.createObjectURL(await api.reportPdf(id));
      const a = Object.assign(document.createElement("a"), { href: url, download: `${c?.title ?? "contract"}-risk-report.pdf` });
      a.click(); URL.revokeObjectURL(url);
    } catch (e) { setActionErr(e instanceof Error ? e.message : "Download failed."); }
  }
  async function remove() {
    if (!window.confirm("Delete this contract and its analysis? This cannot be undone.")) return;
    try { await api.deleteContract(id); nav("/"); } catch (e) { setActionErr(e instanceof Error ? e.message : "Delete failed."); }
  }

  if (error && !c) return <Notice>{error} <Link to="/">Back to contracts</Link></Notice>;
  if (!c) return <Spinner label="Loading contract…" />;
  if (c.status === "pending" || c.status === "processing") return <div className="sheet stack"><h2>{c.title}</h2><Spinner label="Analysing clauses… this page updates by itself." /></div>;
  if (c.status === "failed" || !c.analysis) return (
    <div className="stack"><h1>{c.title}</h1><Notice>{c.error ?? "The analysis failed."}</Notice>
      <div className="row"><Link to="/new" className="btn primary">Try another contract</Link><button className="btn danger" onClick={remove}>Delete</button></div></div>
  );

  const a = c.analysis;
  const clauses = c.clauses.filter((x) => filter === "All" || x.risk === filter);
  const counts = { clauses: c.clauses.length, plan: c.action_plan.length, missing: c.missing.length, whatif: a.what_if.length };

  return (
    <div>
      <div className="page-head">
        <div className="grow"><p className="small"><Link to="/">All contracts</Link></p><h1>{c.title}</h1></div>
        <button className="btn" onClick={download}>Download PDF</button>
        <button className="btn danger quiet" onClick={remove}>Delete</button>
      </div>
      {actionErr && <Notice>{actionErr}</Notice>}

      <section className="sheet summary" aria-label="Summary">
        <div>
          <div className="score-line"><span className="big">{Math.round(c.score ?? 0)}%</span><RiskChip level={c.overall} />
            <span className="muted">{c.total} clauses: {c.high} high, {c.medium} medium, {c.low} low</span></div>
          <Ruler score={c.score ?? 0} />
          <ul className="bullets">{a.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
        <div>
          <h3 style={{ marginBottom: 12 }}>Where the risk comes from</h3>
          <div className="bars">
            {a.categories.filter((r) => r.share_of_total_risk > 0).slice(0, 6).map((r) => (
              <div className="bar" key={r.category} title={`${r.high} high, ${r.medium} medium, ${r.low} low`}>
                <span>{titleCase(r.category)}</span><span className="track"><span className="fill" style={{ width: `${r.share_of_total_risk}%`, display: "block" }} /></span>
                <span className="muted">{Math.round(r.share_of_total_risk)}%</span></div>
            ))}
            {a.categories.every((r) => r.share_of_total_risk === 0) && <p className="muted">No risky clauses found.</p>}
          </div>
        </div>
      </section>

      <div className="tabs" role="tablist">
        {([["clauses", "Clauses"], ["plan", "What to negotiate"], ["missing", "Missing protections"], ["whatif", "What if"]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}<span className="count">{counts[k]}</span></button>
        ))}
      </div>

      {tab === "clauses" && (<>
        <div className="filters">
          {(["All", "High", "Medium", "Low"] as const).map((f) => (
            <button key={f} className="pill" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}{f !== "All" && ` (${c.clauses.filter((x) => x.risk === f).length})`}</button>
          ))}
          <span className="muted small">In medium and high clauses, highlighted words are what the model weighed most.</span>
        </div>
        <div className="doc">
          {clauses.map((cl) => <ClauseCard key={cl.id} clause={cl} categories={meta?.categories ?? [cl.category]} />)}
          {clauses.length === 0 && <div className="empty"><p className="muted">No {filter.toLowerCase()}-risk clauses.</p></div>}
        </div>
      </>)}

      {tab === "plan" && (
        <div className="stack">
          {c.action_plan.length === 0 && <p className="muted">Nothing needs renegotiating.</p>}
          {c.action_plan.map((p, i) => (
            <div className="sheet" key={i}>
              <div className="row" style={{ marginBottom: 8 }}><RiskChip level={p.risk} /><span className="muted small">{titleCase(p.category)}</span></div>
              <p style={{ font: "16px/1.6 var(--serif)", marginBottom: 12 }}>{p.clause}</p>
              <div className="stack">{p.suggestions.map((s, j) => <div className="fix" key={j}><b>{s.action}</b><q>“{s.safer_wording}”</q></div>)}</div>
            </div>
          ))}
        </div>
      )}

      {tab === "missing" && (
        <div className="stack">
          {c.missing.length === 0 && <p className="muted">All the common protections we check for appear somewhere in the text.</p>}
          {c.missing.map((m) => <div className="sheet" key={m.topic}><h3>{m.topic}</h3><p style={{ margin: "6px 0" }}>{m.issue}</p><p className="muted">{m.action}</p></div>)}
        </div>
      )}

      {tab === "whatif" && (
        <div className="sheet stack">
          <p className="muted">How the overall score would change if you renegotiated these clauses.</p>
          {a.what_if.map((w) => (
            <div className="row" key={w.scenario}><span className="grow">{w.scenario}</span><b>{w.score}%</b><span className={`chip ${riskTone(w.band)}`}>{w.band}</span></div>
          ))}
          {a.what_if.length === 0 && <p>No High or Medium clauses to renegotiate.</p>}
        </div>
      )}

      {a.reliability.level !== "High" && <div style={{ marginTop: 24 }}><Notice kind="info">Reliability is {a.reliability.level.toLowerCase()}: {a.reliability.low_confidence_clauses} clauses have low model confidence. Treat the score as a starting point.</Notice></div>}
      <p className="muted small" style={{ marginTop: 24 }}>{c.disclaimer}</p>
    </div>
  );
}
