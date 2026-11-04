import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { Notice } from "../components/ui";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, signIn } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const register = mode === "register";
  if (user) return <Navigate to="/" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await (register ? api.register : api.login)(email, password);
      signIn(res.access_token, res.user);
      nav("/", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally { setBusy(false); }
  }

  return (
    <div className="authwrap">
      <section className="authside" aria-hidden>
        <h1>Read the risky <mark className="high">clauses</mark> first.</h1>
        <p>Upload a contract and see which clauses carry <mark className="medium">penalties</mark>, unlimited liability or one-sided termination, with safer wording to ask for.</p>
      </section>
      <section className="authform">
        <form onSubmit={submit}>
          <h2>{register ? "Create your account" : "Sign in"}</h2>
          {error && <Notice>{error}</Notice>}
          <label className="field"><span>Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label className="field"><span>Password{register ? " (8 characters or more)" : ""}</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={register ? 8 : undefined}
              autoComplete={register ? "new-password" : "current-password"} required /></label>
          <button className="btn primary" disabled={busy} style={{ justifyContent: "center" }}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button>
          <p className="small muted">{register ? <>Already registered? <Link to="/login">Sign in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}</p>
          <p className="small muted">Educational tool. Not legal advice.</p>
        </form>
      </section>
    </div>
  );
}
