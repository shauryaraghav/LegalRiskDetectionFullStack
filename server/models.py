"""Database tables."""
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from server.db import Base


def now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(String(16), default="user")          # user | admin
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    contracts: Mapped[list["Contract"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Contract(Base):
    __tablename__ = "contracts"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    filename: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)   # pending|processing|done|failed
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    overall: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, index=True)  # LOW|MEDIUM|HIGH
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total: Mapped[int] = mapped_column(Integer, default=0)
    high: Mapped[int] = mapped_column(Integer, default=0)
    medium: Mapped[int] = mapped_column(Integer, default=0)
    low: Mapped[int] = mapped_column(Integer, default=0)
    result: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)   # analysis, action_plan, missing, categories
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped[User] = relationship(back_populates="contracts")
    clauses: Mapped[list["Clause"]] = relationship(back_populates="contract", cascade="all, delete-orphan",
                                                   order_by="Clause.position")


class Clause(Base):
    __tablename__ = "clauses"
    id: Mapped[int] = mapped_column(primary_key=True)
    contract_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(40))
    category_confidence: Mapped[float] = mapped_column(Float)
    risk: Mapped[str] = mapped_column(String(8), index=True)
    risk_confidence: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(120))
    explanation: Mapped[str] = mapped_column(Text)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    key_terms: Mapped[list] = mapped_column(JSON, default=list)
    suggestions: Mapped[list] = mapped_column(JSON, default=list)

    contract: Mapped[Contract] = relationship(back_populates="clauses")


class Feedback(Base):
    """A user's correction of a prediction. Admins approve it before it can influence retraining."""
    __tablename__ = "feedback"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    clause_id: Mapped[Optional[int]] = mapped_column(ForeignKey("clauses.id", ondelete="SET NULL"), nullable=True, index=True)
    clause_text: Mapped[str] = mapped_column(Text)
    predicted_category: Mapped[str] = mapped_column(String(40))
    predicted_risk: Mapped[str] = mapped_column(String(8))
    correct_category: Mapped[str] = mapped_column(String(40))
    correct_risk: Mapped[str] = mapped_column(String(8))
    status: Mapped[str] = mapped_column(String(12), default="pending", index=True)   # pending|approved|rejected
    exported: Mapped[bool] = mapped_column(Boolean, default=False)                    # written to the training CSV
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    user: Mapped[User] = relationship()


class Comparison(Base):
    __tablename__ = "comparisons"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    contract_a_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"))
    contract_b_id: Mapped[int] = mapped_column(ForeignKey("contracts.id", ondelete="CASCADE"))
    result: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class ModelRun(Base):
    """One retraining job and the metrics it produced."""
    __tablename__ = "model_runs"
    id: Mapped[int] = mapped_column(primary_key=True)
    triggered_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(12), default="running")   # running|done|failed
    error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rows: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    category_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
