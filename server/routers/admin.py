import json

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from server import services
from server.db import get_db
from server.deps import admin_user, current_user
from server.models import Feedback, ModelRun, User, now
from server.schemas import FeedbackOut, ModelRunOut, ReviewIn
from src import config as ml_config
from src.feedback import save_feedback

router = APIRouter(prefix="/api", tags=["model"])


@router.get("/meta")
def meta():
    return {"categories": ml_config.CATEGORIES, "risk_levels": ml_config.RISK_LEVELS, "disclaimer": ml_config.DISCLAIMER}


@router.get("/metrics")
def metrics(_: User = Depends(current_user)):
    if not ml_config.METRICS_PATH.exists():
        raise HTTPException(404, "No metrics yet. Retrain the model first.")
    return json.loads(ml_config.METRICS_PATH.read_text())


@router.get("/admin/feedback", response_model=list[FeedbackOut])
def list_feedback(status: str = Query("pending", pattern="^(pending|approved|rejected)$"),
                  _: User = Depends(admin_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Feedback).where(Feedback.status == status).order_by(Feedback.created_at.desc()).limit(200)).all()
    return [FeedbackOut.model_validate(r).model_copy(update={"submitted_by": r.user.email}) for r in rows]


@router.post("/admin/feedback/{feedback_id}/review", response_model=FeedbackOut)
def review_feedback(feedback_id: int, body: ReviewIn, _: User = Depends(admin_user), db: Session = Depends(get_db)):
    fb = db.get(Feedback, feedback_id)
    if not fb:
        raise HTTPException(404, "Feedback not found.")
    if fb.status != "pending":
        raise HTTPException(409, "This correction has already been reviewed.")
    if body.approve:
        try:     # approved corrections go to the training CSV used by the next retrain
            save_feedback(fb.clause_text, fb.correct_category, fb.correct_risk, fb.predicted_category, fb.predicted_risk)
            fb.exported = True
        except ValueError as exc:
            raise HTTPException(422, f"Cannot be used for training: {exc}")
    fb.status, fb.reviewed_at = ("approved" if body.approve else "rejected"), now()
    db.commit()
    return FeedbackOut.model_validate(fb).model_copy(update={"submitted_by": fb.user.email})


@router.post("/admin/retrain", response_model=ModelRunOut, status_code=202)
def retrain(background: BackgroundTasks, admin: User = Depends(admin_user), db: Session = Depends(get_db)):
    if db.scalars(select(ModelRun).where(ModelRun.status == "running")).first():
        raise HTTPException(409, "A training run is already in progress.")
    run = ModelRun(triggered_by=admin.id)
    db.add(run)
    db.commit()
    background.add_task(services.run_retrain, run.id)
    return run


@router.get("/admin/model-runs", response_model=list[ModelRunOut])
def model_runs(_: User = Depends(admin_user), db: Session = Depends(get_db)):
    return db.scalars(select(ModelRun).order_by(ModelRun.started_at.desc()).limit(20)).all()
