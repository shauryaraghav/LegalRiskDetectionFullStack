import pytest
from fastapi.testclient import TestClient

from server import db

db.configure("sqlite://")            # in-memory database for the whole test run
from server.main import app  # noqa: E402

CONTRACT = ("1. The Client shall pay invoices within 30 days of receipt.\n"
            "2. The Company may terminate this Agreement without notice.\n"
            "3. The Client shall indemnify and hold harmless the Provider against all claims.\n"
            "4. Each party shall keep the other party's information confidential.\n")


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from src import config as ml_config
    monkeypatch.setattr(ml_config, "FEEDBACK_PATH", tmp_path / "user_feedback.csv")   # never touch real data
    db.Base.metadata.drop_all(db.engine)
    with TestClient(app) as c:
        yield c


def signup(client, email="alice@example.com", password="correct-horse"):
    r = client.post("/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def upload(client, headers, text=CONTRACT, title="Test contract"):
    r = client.post("/api/contracts", data={"title": title, "text": text}, headers=headers)
    assert r.status_code == 202, r.text
    return r.json()["id"]
