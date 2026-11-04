import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { MiniBar, Notice, RiskChip, usePolled } from "../components/ui";
import { formatDate } from "../lib";
import type { Overall } from "../types";

const PAGE = 15;

export default function Contracts() {
  const [q, setQ] = useState("");
  const [overall, setOverall] = useState<Overall | "">("");
  const [offset, setOffset] = useState(0);
  const stats = usePolled(() => api.stats(), () => false);
  const list = usePolled(() => api.contracts({ q, overall, limit: PAGE, offset }),
    (v) => !!v?.items.some((c) => c.status === "pending" || c.status === "processing"), 2000, [q, overall, offset]);
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const s = stats.data;

  return (
    <div className="stack">
      <div className="page-head">
        <div className="grow"><h1>Your contracts</h1></div>
        <Link to="/new" className="btn primary">Review a contract</Link>
      </div>
      {s && s.contracts > 0 && (
        <div className="statline">
          <span><b>{s.contracts}</b>reviewed</span>
          <span><b>{s.high}</b>high risk</span>
          <span><b>{s.medium}</b>medium</span>
          <span><b>{s.low}</b>low</span>
          {s.average_score != null && <span><b>{s.average_score}%</b>average score</span>}
        </div>
      )}
      <div className="filters">
        <input type="search" placeholder="Search by title" aria-label="Search by title" value={q} style={{ maxWidth: 260 }}
          onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
        {(["", "HIGH", "MEDIUM", "LOW"] as const).map((v) => (
          <button key={v || "all"} className="pill" aria-pressed={overall === v} onClick={() => { setOverall(v); setOffset(0); }}>
            {v ? v[0] + v.slice(1).toLowerCase() : "All"}</button>
        ))}
      </div>
      {list.error && <Notice>{list.error}</Notice>}
      <div className="sheet flush">
        {items.length > 0 && (
          <div className="listrow listhead"><span>Title</span><span>Overall</span><span className="hide-sm">Clauses</span><span className="hide-sm">Added</span><span /></div>
        )}
        {items.map((c) => (
          <Link key={c.id} to={`/contracts/${c.id}`} className="listrow">
            <span className="t">{c.title}</span>
            <span>{c.status === "done" ? <RiskChip level={c.overall} /> :
              <span className={`chip ${c.status === "failed" ? "high" : "plain"}`}>{c.status === "failed" ? "Failed" : "Analysing…"}</span>}</span>
            <span className="hide-sm">{c.status === "done" ? <MiniBar high={c.high} medium={c.medium} low={c.low} /> : "—"}</span>
            <span className="hide-sm muted small">{formatDate(c.created_at)}</span>
            <span className="muted">{c.score != null ? `${Math.round(c.score)}%` : ""}</span>
          </Link>
        ))}
        {list.data && items.length === 0 && (
          <div className="empty">
            {q || overall ? <><h3>No contracts match</h3><p className="muted">Try a different search or clear the filter.</p></> :
              <><h3>No contracts yet</h3><p className="muted">Upload a PDF or paste text to see which clauses to negotiate.</p>
                <Link to="/new" className="btn primary">Review your first contract</Link></>}
          </div>
        )}
      </div>
      {total > PAGE && (
        <div className="row">
          <button className="btn" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>Previous</button>
          <span className="muted small">{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
          <button className="btn" disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>Next</button>
        </div>
      )}
    </div>
  );
}
