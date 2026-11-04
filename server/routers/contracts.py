from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from server import config, services
from server.db import get_db
from server.deps import current_user
from server.models import Contract, Feedback, User
from server.schemas import ClauseOut, ContractDetail, ContractList, ContractStats, ContractSummary

router = APIRouter(prefix="/api/contracts", tags=["contracts"])


def owned_contract(db: Session, contract_id: int, user: User) -> Contract:
    contract = db.get(Contract, contract_id)
    if not contract or contract.user_id != user.id:      # 404 (not 403) so ids of other users' contracts don't leak
        raise HTTPException(404, "Contract not found.")
    return contract


@router.post("", response_model=ContractSummary, status_code=202)
async def create_contract(background: BackgroundTasks, title: str = Form(""), text: str = Form(""),
                          file: Optional[UploadFile] = File(None), user: User = Depends(current_user),
                          db: Session = Depends(get_db)):
    """Upload a file or paste text. Analysis runs in the background; poll GET /api/contracts/{id}."""
    filename = None
    if file is not None and file.filename:
        data = await file.read(config.MAX_UPLOAD_BYTES + 1)
        if len(data) > config.MAX_UPLOAD_BYTES:
            raise HTTPException(413, f"File is too large (limit {config.MAX_UPLOAD_BYTES // 1024 // 1024} MB).")
        content, filename = services.extract_text(file.filename, data), file.filename
    else:
        content = text
    content = services.validate_text(content)
    name = (title.strip() or (filename.rsplit(".", 1)[0] if filename else "") or "Pasted contract")[:200]
    contract = Contract(user_id=user.id, title=name, filename=filename, text=content)
    db.add(contract)
    db.commit()
    background.add_task(services.run_analysis, contract.id)
    return contract


@router.get("", response_model=ContractList)
def list_contracts(q: str = "", overall: Optional[str] = Query(None, pattern="^(LOW|MEDIUM|HIGH)$"),
                   status: Optional[str] = Query(None, pattern="^(pending|processing|done|failed)$"),
                   limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0),
                   user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Contract).where(Contract.user_id == user.id)
    if q.strip():
        stmt = stmt.where(Contract.title.ilike(f"%{q.strip()}%"))
    if overall:
        stmt = stmt.where(Contract.overall == overall)
    if status:
        stmt = stmt.where(Contract.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(Contract.created_at.desc()).limit(limit).offset(offset)).all()
    return ContractList(items=items, total=total)


@router.get("/stats", response_model=ContractStats)
def stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Contract).where(Contract.user_id == user.id)).all()
    done = [c for c in rows if c.status == "done"]
    count = lambda lvl: sum(c.overall == lvl for c in done)  # noqa: E731
    return ContractStats(contracts=len(rows), analysed=len(done), high=count("HIGH"), medium=count("MEDIUM"),
                         low=count("LOW"), average_score=round(sum(c.score for c in done) / len(done), 1) if done else None)


@router.get("/{contract_id}", response_model=ContractDetail)
def get_contract(contract_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    contract = db.scalars(select(Contract).options(selectinload(Contract.clauses))
                          .where(Contract.id == contract_id, Contract.user_id == user.id)).first()
    if not contract:
        raise HTTPException(404, "Contract not found.")
    clause_ids = [c.id for c in contract.clauses]
    fb = {}
    if clause_ids:
        for f in db.scalars(select(Feedback).where(Feedback.user_id == user.id, Feedback.clause_id.in_(clause_ids))):
            fb[f.clause_id] = f.status
    result = contract.result or {}
    clauses = []
    for c in contract.clauses:
        out = ClauseOut.model_validate(c)
        out.feedback_status = fb.get(c.id)
        clauses.append(out)
    detail = ContractDetail.model_validate(contract)
    detail.analysis, detail.action_plan = result.get("analysis"), result.get("action_plan", [])
    detail.missing, detail.categories = result.get("missing", []), result.get("categories", {})
    detail.clauses, detail.disclaimer = clauses, services.DISCLAIMER_TEXT
    return detail


@router.delete("/{contract_id}", status_code=204)
def delete_contract(contract_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned_contract(db, contract_id, user))
    db.commit()
    return Response(status_code=204)


@router.get("/{contract_id}/report.pdf")
def report(contract_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    contract = owned_contract(db, contract_id, user)
    if contract.status != "done":
        raise HTTPException(409, "The analysis is not finished yet.")
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "_" for ch in contract.title)[:60] or "contract"
    return Response(services.contract_pdf(contract), media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{safe}-risk-report.pdf"'})


