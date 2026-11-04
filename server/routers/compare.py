from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from server.db import get_db
from server.deps import current_user
from server.models import Comparison, User
from server.routers.contracts import owned_contract
from server.schemas import CompareIn
from src.compare import compare_agreements

router = APIRouter(prefix="/api/compare", tags=["compare"])


@router.post("")
def compare(body: CompareIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Compare two of your analysed contracts (e.g. original vs revised draft)."""
    if body.contract_a_id == body.contract_b_id:
        raise HTTPException(422, "Pick two different contracts.")
    a, b = owned_contract(db, body.contract_a_id, user), owned_contract(db, body.contract_b_id, user)
    if a.status != "done" or b.status != "done":
        raise HTTPException(409, "Both contracts must finish analysis before they can be compared.")
    result = compare_agreements(a.text, b.text)
    row = Comparison(user_id=user.id, contract_a_id=a.id, contract_b_id=b.id, result=result)
    db.add(row)
    db.commit()
    return {"id": row.id, "a": {"id": a.id, "title": a.title}, "b": {"id": b.id, "title": b.title}, **result}
