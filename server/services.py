"""Business logic that wraps the ML engine in src/: text extraction, analysis jobs, retraining."""
import io
import logging
import time
from types import SimpleNamespace

import pdfplumber
from fastapi import HTTPException
from prometheus_client import Counter, Histogram

from server import config, db
from server.models import Clause, Contract, ModelRun, now
from src.agreement_analyzer import analyze_agreement
from src.config import DISCLAIMER
from src.report import generate_pdf

log = logging.getLogger("legalrisk")

ANALYSIS_JOBS = Counter("legalrisk_analysis_jobs_total", "Contract analysis jobs by outcome", ["status"])
ANALYSIS_SECONDS = Histogram("legalrisk_analysis_duration_seconds", "Contract analysis job duration")


# --------------------------------------------------------------------------- input
def extract_text(filename: str | None, data: bytes) -> str:
    """Return text from an uploaded PDF or TXT file; raise HTTPException for bad input."""
    name = (filename or "").lower()
    if name.endswith(".pdf") or data[:5] == b"%PDF-":
        try:
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                text = "\n".join((page.extract_text() or "") for page in pdf.pages)
        except Exception:
            raise HTTPException(422, "Could not read this PDF. Try a text-based PDF or paste the text instead.")
        if not text.strip():
            raise HTTPException(422, "This PDF has no selectable text (it may be a scan). Scanned PDFs are not supported.")
        return text
    if name.endswith((".txt", ".md")) or not name:
        return data.decode("utf-8", errors="ignore")
    raise HTTPException(415, "Upload a PDF or TXT file, or paste the contract text.")


def validate_text(text: str) -> str:
    text = (text or "").replace("\x00", "").strip()
    if not text:
        raise HTTPException(422, "The contract is empty.")
    if len(text) > config.MAX_TEXT_CHARS:
        raise HTTPException(413, f"The contract is too long (limit {config.MAX_TEXT_CHARS:,} characters).")
    return text


# --------------------------------------------------------------------------- analysis job
def run_analysis(contract_id: int) -> None:
    """Background job: analyse a contract and persist the clauses and summary."""
    session = db.SessionLocal()
    try:
        contract = session.get(Contract, contract_id)
        if not contract:
            return
        contract.status = "processing"
        session.commit()
        started = time.perf_counter()
        try:
            result = analyze_agreement(contract.text)
            if result["total"] == 0:
                contract.status, contract.error = "failed", "No clauses were detected in this document."
            else:
                for i, p in enumerate(result["predictions"], 1):
                    session.add(Clause(contract_id=contract.id, position=i, text=p.clause, category=p.category,
                                       category_confidence=p.category_confidence, risk=p.risk,
                                       risk_confidence=p.risk_confidence, source=p.source,
                                       explanation=p.explanation, reasons=p.reasons,
                                       key_terms=p.key_terms, suggestions=p.suggestions))
                contract.total, contract.high = result["total"], result["high"]
                contract.medium, contract.low = result["medium"], result["low"]
                contract.score, contract.overall = result["score"], result["overall"]
                contract.result = {"analysis": result["analysis"], "action_plan": result["action_plan"],
                                   "missing": result["missing"], "categories": dict(result["categories"])}
                contract.status, contract.error = "done", None
        except Exception:
            log.exception("analysis failed for contract %s", contract_id)
            session.rollback()
            contract = session.get(Contract, contract_id)
            contract.status, contract.error = "failed", "The analysis failed unexpectedly. Try again."
        contract.completed_at = now()
        session.commit()
        ANALYSIS_JOBS.labels(status=contract.status).inc()
        ANALYSIS_SECONDS.observe(time.perf_counter() - started)
    finally:
        session.close()


def mark_interrupted_jobs() -> None:
    """On startup, jobs left running by a previous process can never finish; fail them visibly."""
    session = db.SessionLocal()
    try:
        for c in session.query(Contract).filter(Contract.status.in_(["pending", "processing"])):
            c.status, c.error = "failed", "The server restarted before this analysis finished. Upload it again."
        for r in session.query(ModelRun).filter(ModelRun.status == "running"):
            r.status, r.error, r.finished_at = "failed", "The server restarted during training.", now()
        session.commit()
    finally:
        session.close()


# --------------------------------------------------------------------------- report
def contract_pdf(contract: Contract) -> bytes:
    """Build the PDF through the existing report generator (it expects prediction-like objects)."""
    preds = [SimpleNamespace(clause=c.text, category=c.category, risk=c.risk, explanation=c.explanation)
             for c in contract.clauses]
    result = {"overall": contract.overall, "score": contract.score or 0.0, "high": contract.high,
              "medium": contract.medium, "low": contract.low, "predictions": preds,
              **{k: (contract.result or {}).get(k) for k in ("analysis", "action_plan", "missing")}}
    return generate_pdf(result)


# --------------------------------------------------------------------------- retraining job
def run_retrain(run_id: int) -> None:
    from src.feedback import retrain_with_feedback

    session = db.SessionLocal()
    try:
        run = session.get(ModelRun, run_id)
        try:
            metrics = retrain_with_feedback()
            run.status, run.rows = "done", metrics.get("rows")
            run.category_accuracy = metrics.get("category", {}).get("accuracy")
            hybrid = metrics.get("risk_hybrid")
            run.risk_accuracy = hybrid.get("hybrid_accuracy") if hybrid else metrics.get("risk", {}).get("accuracy")
        except Exception:
            log.exception("retraining failed")
            run.status, run.error = "failed", "Retraining failed. Check the server logs."
        run.finished_at = now()
        session.commit()
    finally:
        session.close()


DISCLAIMER_TEXT = DISCLAIMER
