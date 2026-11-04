export type Risk = "Low" | "Medium" | "High";
export type Overall = "LOW" | "MEDIUM" | "HIGH";
export type Status = "pending" | "processing" | "done" | "failed";

export interface User { id: number; email: string; role: "user" | "admin" }
export interface Suggestion { action: string; safer_wording: string }

export interface ContractSummary {
  id: number; title: string; filename: string | null; status: Status; error: string | null;
  overall: Overall | null; score: number | null; total: number; high: number; medium: number; low: number;
  created_at: string; completed_at: string | null;
}
export interface Clause {
  id: number; position: number; text: string; category: string; category_confidence: number;
  risk: Risk; risk_confidence: number; source: string; explanation: string;
  reasons: string[]; key_terms: string[]; suggestions: Suggestion[]; feedback_status: string | null;
}
export interface CategoryRow {
  category: string; clauses: number; high: number; medium: number; low: number;
  category_score: number; share_of_total_risk: number;
}
export interface Analysis {
  score: number; band: Overall; summary: string[]; categories: CategoryRow[];
  what_if: { scenario: string; score: number; band: Overall }[];
  reliability: { level: string; low_confidence_clauses: number; avg_confidence: number };
}
export interface ContractDetail extends ContractSummary {
  analysis: Analysis | null;
  action_plan: { clause: string; category: string; risk: Risk; suggestions: Suggestion[] }[];
  missing: { topic: string; issue: string; action: string }[];
  clauses: Clause[]; disclaimer: string;
}
export interface Stats { contracts: number; analysed: number; high: number; medium: number; low: number; average_score: number | null }
export interface Meta { categories: string[]; risk_levels: Risk[]; disclaimer: string }

export interface CompareRow {
  status: "unchanged" | "modified" | "added" | "removed"; clause_a: string; clause_b: string;
  risk_a: Risk | ""; risk_b: Risk | ""; category_a: string; category_b: string;
  trend: "riskier" | "safer" | "same"; removed_words: string[]; added_words: string[]; similarity: number;
}
export interface CompareResult {
  a: { id: number; title: string }; b: { id: number; title: string };
  score_a: number; score_b: number; delta: number; band_a: string; band_b: string;
  counts: Record<string, number>; rows: CompareRow[]; summary: string[];
}
export interface FeedbackItem {
  id: number; clause_text: string; predicted_category: string; predicted_risk: Risk;
  correct_category: string; correct_risk: Risk; status: string; submitted_by: string | null;
}
export interface ModelRun {
  id: number; status: "running" | "done" | "failed"; error: string | null; rows: number | null;
  category_accuracy: number | null; risk_accuracy: number | null; started_at: string; finished_at: string | null;
}
export interface Metrics {
  trained_at: string; rows: number;
  category: { accuracy: number; macro_f1: number; majority_baseline: number };
  risk: { accuracy: number; macro_f1: number; majority_baseline: number };
  risk_hybrid?: { ml_only_accuracy: number; hybrid_accuracy: number; hybrid_macro_f1: number };
  real_contracts?: { test_clauses: number; contracts: number; accuracy: number; macro_f1: number; hand_only_accuracy: number };
  cuad?: { used: boolean; clauses_in_file: number; contracts: number };
}
