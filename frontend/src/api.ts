import type {
  CompareResult, ContractDetail, ContractSummary, FeedbackItem, Meta, Metrics, ModelRun, Stats, User,
} from "./types";

const TOKEN_KEY = "clause.token";
export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t: string | null) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** FastAPI errors are {detail: string} or {detail: [{msg, loc}]}; turn both into one readable line. */
export function errorMessage(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown })?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    return (first.msg ?? fallback).replace(/^Value error, /, "");
  }
  return fallback;
}

async function raw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!res.ok) {
    if (res.status === 401 && token) window.dispatchEvent(new Event("auth:expired"));
    let body: unknown = null;
    try { body = await res.json(); } catch { /* not JSON */ }
    throw new ApiError(res.status, errorMessage(body, `Request failed (${res.status}).`));
  }
  return res;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await raw(path, init);
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const body = (data: unknown): RequestInit => ({
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
});

export const api = {
  register: (email: string, password: string) => json<{ access_token: string; user: User }>("/auth/register", body({ email, password })),
  login: (email: string, password: string) => json<{ access_token: string; user: User }>("/auth/login", body({ email, password })),
  me: () => json<User>("/auth/me"),
  meta: () => json<Meta>("/meta"),

  contracts: (p: { q?: string; overall?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    Object.entries(p).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
    return json<{ items: ContractSummary[]; total: number }>(`/contracts?${qs}`);
  },
  stats: () => json<Stats>("/contracts/stats"),
  contract: (id: number) => json<ContractDetail>(`/contracts/${id}`),
  createContract: (form: FormData) => json<ContractSummary>("/contracts", { method: "POST", body: form }),
  deleteContract: (id: number) => json<void>(`/contracts/${id}`, { method: "DELETE" }),
  reportPdf: async (id: number) => (await raw(`/contracts/${id}/report.pdf`)).blob(),

  compare: (a: number, b: number) => json<CompareResult>("/compare", body({ contract_a_id: a, contract_b_id: b })),
  sendFeedback: (clauseId: number, correct_category: string, correct_risk: string) =>
    json<FeedbackItem>(`/clauses/${clauseId}/feedback`, body({ correct_category, correct_risk })),

  metrics: () => json<Metrics>("/metrics"),
  pendingFeedback: () => json<FeedbackItem[]>("/admin/feedback?status=pending"),
  reviewFeedback: (id: number, approve: boolean) => json<FeedbackItem>(`/admin/feedback/${id}/review`, body({ approve })),
  retrain: () => json<ModelRun>("/admin/retrain", { method: "POST" }),
  modelRuns: () => json<ModelRun[]>("/admin/model-runs"),
};
