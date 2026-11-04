"""Pydantic request/response models."""
import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def _email(cls, v: str) -> str:
        v = v.strip().lower()
        if not EMAIL_RE.match(v):
            raise ValueError("Enter a valid email address.")
        return v


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ContractSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    filename: Optional[str]
    status: str
    error: Optional[str]
    overall: Optional[str]
    score: Optional[float]
    total: int
    high: int
    medium: int
    low: int
    created_at: datetime
    completed_at: Optional[datetime]


class ContractList(BaseModel):
    items: list[ContractSummary]
    total: int


class ClauseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    position: int
    text: str
    category: str
    category_confidence: float
    risk: str
    risk_confidence: float
    source: str
    explanation: str
    reasons: list
    key_terms: list
    suggestions: list
    feedback_status: Optional[str] = None


class ContractDetail(ContractSummary):
    analysis: Optional[dict] = None
    action_plan: list = []
    missing: list = []
    categories: dict = {}
    clauses: list[ClauseOut] = []
    disclaimer: str = ""


class ContractStats(BaseModel):
    contracts: int
    analysed: int
    high: int
    medium: int
    low: int
    average_score: Optional[float]


class FeedbackIn(BaseModel):
    correct_category: str
    correct_risk: Literal["Low", "Medium", "High"]


class FeedbackOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    clause_id: Optional[int]
    clause_text: str
    predicted_category: str
    predicted_risk: str
    correct_category: str
    correct_risk: str
    status: str
    created_at: datetime
    submitted_by: Optional[str] = None


class ReviewIn(BaseModel):
    approve: bool


class CompareIn(BaseModel):
    contract_a_id: int
    contract_b_id: int


class ModelRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    status: str
    error: Optional[str]
    rows: Optional[int]
    category_accuracy: Optional[float]
    risk_accuracy: Optional[float]
    started_at: datetime
    finished_at: Optional[datetime]
