import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Notice } from "../components/ui";

const MAX_MB = 10;

export default function NewContract() {
  const nav = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function pick(f: File | undefined) {
    setError("");
    if (!f) return;
    if (!/\.(pdf|txt)$/i.test(f.name)) return setError("Upload a PDF or TXT file.");
    if (f.size > MAX_MB * 1024 * 1024) return setError(`That file is larger than ${MAX_MB} MB.`);
    setFile(f);
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files[0]); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file && !text.trim()) return setError("Upload a file or paste the contract text.");
    setBusy(true); setError("");
    const form = new FormData();
    form.set("title", title);
    if (file) form.set("file", file); else form.set("text", text);
    try {
      const c = await api.createContract(form);
      nav(`/contracts/${c.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit} style={{ maxWidth: 760 }}>
      <div><h1>Review a contract</h1><p className="muted" style={{ marginTop: 6 }}>Analysis takes a few seconds. You can leave this page while it runs.</p></div>
      {error && <Notice>{error}</Notice>}
      <label className="field"><span>Title (optional)</span>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Freelance services agreement" /></label>
      <div className={`drop${over ? " over" : ""}`} role="button" tabIndex={0}
        onClick={() => input.current?.click()} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={onDrop}>
        {file ? <><b>{file.name}</b><p className="muted small">{(file.size / 1024).toFixed(0)} KB · <button type="button" className="toggle" onClick={(e) => { e.stopPropagation(); setFile(null); }}>Remove</button></p></>
          : <><b>Drop a PDF or TXT file here</b><p className="muted small">or click to choose one (up to {MAX_MB} MB). Scanned PDFs without selectable text are not supported.</p></>}
        <input ref={input} type="file" accept=".pdf,.txt,application/pdf,text/plain" hidden onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {!file && (
        <label className="field"><span>Or paste the contract text</span>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="1. The Client shall pay all invoices within 30 days…" /></label>
      )}
      <div className="row"><button className="btn primary" disabled={busy}>{busy ? "Uploading…" : "Analyse contract"}</button></div>
    </form>
  );
}
