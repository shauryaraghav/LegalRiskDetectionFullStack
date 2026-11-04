from server_tests.conftest import CONTRACT, signup, upload


def test_compare_two_contracts(client):
    h = signup(client)
    a = upload(client, h, title="v1")
    b = upload(client, h, text=CONTRACT.replace("without notice", "with 60 days written notice"), title="v2")
    r = client.post("/api/compare", json={"contract_a_id": a, "contract_b_id": b}, headers=h)
    assert r.status_code == 200
    d = r.json()
    assert d["a"]["title"] == "v1" and d["counts"]["modified"] >= 1 and d["summary"]
    assert client.post("/api/compare", json={"contract_a_id": a, "contract_b_id": a}, headers=h).status_code == 422


def test_cannot_compare_someone_elses_contract(client):
    h1, h2 = signup(client), signup(client, "bob@example.com")
    a, b = upload(client, h1), upload(client, h1)
    assert client.post("/api/compare", json={"contract_a_id": a, "contract_b_id": b}, headers=h2).status_code == 404


def _first_clause(client, h):
    cid = upload(client, h)
    return client.get(f"/api/contracts/{cid}", headers=h).json()["clauses"][0]["id"]


def test_feedback_review_flow(client, tmp_path):
    admin, user = signup(client), signup(client, "bob@example.com")
    clause_id = _first_clause(client, user)
    r = client.post(f"/api/clauses/{clause_id}/feedback", json={"correct_category": "Payment", "correct_risk": "Low"}, headers=user)
    assert r.status_code == 201 and r.json()["status"] == "pending"
    # resubmitting while pending just updates it
    r2 = client.post(f"/api/clauses/{clause_id}/feedback", json={"correct_category": "Payment", "correct_risk": "Medium"}, headers=user)
    assert r2.json()["id"] == r.json()["id"] and r2.json()["correct_risk"] == "Medium"

    assert client.get("/api/admin/feedback", headers=user).status_code == 403
    queue = client.get("/api/admin/feedback", headers=admin).json()
    assert len(queue) == 1 and queue[0]["submitted_by"] == "bob@example.com"

    done = client.post(f"/api/admin/feedback/{queue[0]['id']}/review", json={"approve": True}, headers=admin)
    assert done.status_code == 200 and done.json()["status"] == "approved"
    assert "Payment" in (tmp_path / "user_feedback.csv").read_text()          # exported for retraining
    assert client.post(f"/api/admin/feedback/{queue[0]['id']}/review", json={"approve": False}, headers=admin).status_code == 409


def test_rejected_feedback_is_not_exported(client, tmp_path):
    admin, user = signup(client), signup(client, "bob@example.com")
    clause_id = _first_clause(client, user)
    fid = client.post(f"/api/clauses/{clause_id}/feedback", json={"correct_category": "Payment", "correct_risk": "Low"}, headers=user).json()["id"]
    client.post(f"/api/admin/feedback/{fid}/review", json={"approve": False}, headers=admin)
    assert not (tmp_path / "user_feedback.csv").exists()


def test_feedback_validation_and_ownership(client):
    h1, h2 = signup(client), signup(client, "bob@example.com")
    clause_id = _first_clause(client, h1)
    assert client.post(f"/api/clauses/{clause_id}/feedback", json={"correct_category": "Nonsense", "correct_risk": "Low"}, headers=h1).status_code == 422
    assert client.post(f"/api/clauses/{clause_id}/feedback", json={"correct_category": "Payment", "correct_risk": "Extreme"}, headers=h1).status_code == 422
    assert client.post(f"/api/clauses/{clause_id}/feedback", json={"correct_category": "Payment", "correct_risk": "Low"}, headers=h2).status_code == 404


def test_retrain_is_admin_only_and_tracked(client, monkeypatch):
    monkeypatch.setattr("src.feedback.retrain_with_feedback", lambda: {"rows": 10, "category": {"accuracy": 0.8}, "risk_hybrid": {"hybrid_accuracy": 0.6}})
    admin, user = signup(client), signup(client, "bob@example.com")
    assert client.post("/api/admin/retrain", headers=user).status_code == 403
    assert client.post("/api/admin/retrain", headers=admin).status_code == 202
    runs = client.get("/api/admin/model-runs", headers=admin).json()
    assert runs[0]["status"] == "done" and runs[0]["category_accuracy"] == 0.8


def test_meta_metrics_health(client):
    h = signup(client)
    assert client.get("/api/health").json()["models_loaded"] is True
    assert "Payment" in client.get("/api/meta").json()["categories"]
    assert client.get("/api/metrics", headers=h).status_code == 200
