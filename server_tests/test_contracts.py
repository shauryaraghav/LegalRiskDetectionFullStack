from server_tests.conftest import CONTRACT, signup, upload


def test_upload_analyses_and_stores_clauses(client):
    h = signup(client)
    cid = upload(client, h)
    d = client.get(f"/api/contracts/{cid}", headers=h).json()
    assert d["status"] == "done" and d["total"] == 4 and len(d["clauses"]) == 4
    assert d["overall"] in ("LOW", "MEDIUM", "HIGH") and d["analysis"] and d["disclaimer"]
    assert d["high"] + d["medium"] + d["low"] == d["total"]
    assert any(c["risk"] == "High" and c["category"] == "Termination" for c in d["clauses"])


def test_txt_file_upload_and_pdf_report(client):
    h = signup(client)
    r = client.post("/api/contracts", files={"file": ("lease.txt", CONTRACT.encode(), "text/plain")}, headers=h)
    assert r.status_code == 202 and r.json()["title"] == "lease"
    pdf = client.get(f"/api/contracts/{r.json()['id']}/report.pdf", headers=h)
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")


def test_rejects_bad_input(client):
    h = signup(client)
    assert client.post("/api/contracts", data={"text": "  "}, headers=h).status_code == 422
    assert client.post("/api/contracts", files={"file": ("x.exe", b"MZ", "application/octet-stream")}, headers=h).status_code == 415
    assert client.post("/api/contracts", files={"file": ("x.pdf", b"%PDF- not really", "application/pdf")}, headers=h).status_code == 422


def test_no_clauses_marks_job_failed(client):
    h = signup(client)
    cid = upload(client, h, text="Hello.")
    d = client.get(f"/api/contracts/{cid}", headers=h).json()
    assert d["status"] == "failed" and "No clauses" in d["error"]
    assert client.get(f"/api/contracts/{cid}/report.pdf", headers=h).status_code == 409


def test_users_cannot_see_each_others_contracts(client):
    h1, h2 = signup(client), signup(client, "bob@example.com")
    cid = upload(client, h1)
    assert client.get(f"/api/contracts/{cid}", headers=h2).status_code == 404
    assert client.delete(f"/api/contracts/{cid}", headers=h2).status_code == 404
    assert client.get("/api/contracts", headers=h2).json()["total"] == 0


def test_list_filter_stats_delete(client):
    h = signup(client)
    a = upload(client, h, title="Alpha lease")
    upload(client, h, title="Beta services")
    assert client.get("/api/contracts?q=alpha", headers=h).json()["total"] == 1
    assert client.get("/api/contracts?limit=1", headers=h).json()["total"] == 2
    st = client.get("/api/contracts/stats", headers=h).json()
    assert st["contracts"] == 2 and st["analysed"] == 2 and st["average_score"] is not None
    assert client.delete(f"/api/contracts/{a}", headers=h).status_code == 204
    assert client.get("/api/contracts", headers=h).json()["total"] == 1
