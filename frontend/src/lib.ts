import type { Overall, Risk } from "./types";

export const riskTone = (r: Risk | Overall | "" | null | undefined): "high" | "medium" | "low" | "none" => {
  const v = (r ?? "").toString().toLowerCase();
  return v === "high" || v === "medium" || v === "low" ? v : "none";
};

export const titleCase = (s: string) => s.replace(/_/g, " ");

export const pct = (n: number | null | undefined, digits = 0) => (n == null ? "—" : `${(n * 100).toFixed(digits)}%`);

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export interface Part { text: string; hit: boolean }

/** Split clause text into plain and highlighted parts for the model's key terms. Rendered as React text, never as HTML. */
export function highlightParts(text: string, terms: string[]): Part[] {
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 3))]
    .sort((a, b) => b.length - a.length)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!clean.length) return [{ text, hit: false }];
  const re = new RegExp(`\\b(${clean.join("|")})\\b`, "gi");
  const parts: Part[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: text.slice(last, i), hit: false });
    parts.push({ text: m[0], hit: true });
    last = i + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), hit: false });
  return parts.length ? parts : [{ text, hit: false }];
}

/** Where a 0-100 risk score sits on the Low/Medium/High ruler (bands: <35, 35-60, 60+). */
export const rulerPosition = (score: number) => Math.min(100, Math.max(0, score));

const TOKEN = /[A-Za-z0-9]+|[^A-Za-z0-9]+/g;
export interface DiffPart { text: string; changed: boolean }

/** Word-level diff (longest common subsequence). `a` marks removed words, `b` marks added words. */
export function wordDiff(a: string, b: string): { a: DiffPart[]; b: DiffPart[] } {
  const ta = a.match(TOKEN) ?? [], tb = b.match(TOKEN) ?? [];
  const plain = (t: string[]): DiffPart[] => t.map((text) => ({ text, changed: false }));
  if (ta.length * tb.length > 250_000) return { a: plain(ta), b: plain(tb) };     // very long clause: skip diffing
  const norm = (t: string) => t.toLowerCase();
  const dp = Array.from({ length: ta.length + 1 }, () => new Array<number>(tb.length + 1).fill(0));
  for (let i = ta.length - 1; i >= 0; i--)
    for (let j = tb.length - 1; j >= 0; j--)
      dp[i][j] = norm(ta[i]) === norm(tb[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const outA = plain(ta), outB = plain(tb);
  let i = 0, j = 0;
  while (i < ta.length && j < tb.length) {
    if (norm(ta[i]) === norm(tb[j])) { i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) outA[i++].changed = true;
    else outB[j++].changed = true;
  }
  while (i < ta.length) outA[i++].changed = true;
  while (j < tb.length) outB[j++].changed = true;
  const ws = (p: DiffPart) => /^\s+$/.test(p.text);
  [outA, outB].forEach((o) => o.forEach((p) => { if (ws(p)) p.changed = false; }));
  return { a: outA, b: outB };
}
