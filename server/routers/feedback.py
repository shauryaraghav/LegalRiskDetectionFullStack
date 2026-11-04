from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import current_user
from server.models import Clause, Contract, Feedback, User
from server.schemas import FeedbackIn, FeedbackOut
from src.config import CATEGORIES

router = APIRouter(prefix="/api/clauses", tags=["feedback"])


@router.post("/{clause_id}/feedback", response_model=FeedbackOut, status_code=201)
def submit_feedback(clause_id: int, body: FeedbackIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Suggest a corrected category/risk for a clause. It stays 'pending' until an admin approves it."""
    clause = db.scalars(select(Clause).join(Contract).where(Clause.id == clause_id, Contract.user_id == user.id)).first()
    if not clause:
        raise HTTPException(404, "Clause not found.")
    if body.correct_category not in CATEGORIES:
        raise HTTPException(422, f"Unknown category: {body.correct_category!r}")
    existing = db.scalars(select(Feedback).where(Feedback.user_id == user.id, Feedback.clause_id == clause_id)).first()
    if existing and existing.status != "pending":
        raise HTTPException(409, "This clause already has a reviewed correction.")
    fb = existing or Feedback(user_id=user.id, clause_id=clause.id, clause_text=clause.text,
                              predicted_category=clause.category, predicted_risk=clause.risk)
    fb.correct_category, fb.correct_risk = body.correct_category, body.correct_risk
    db.add(fb)
    db.commit()
    return fb
