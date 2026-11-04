from server_tests.conftest import signup


def test_register_login_me(client):
    h = signup(client)
    me = client.get("/api/auth/me", headers=h).json()
    assert me["email"] == "alice@example.com" and me["role"] == "admin"        # first user becomes admin
    r = client.post("/api/auth/login", json={"email": "ALICE@example.com", "password": "correct-horse"})
    assert r.status_code == 200 and r.json()["access_token"]


def test_second_user_is_not_admin(client):
    signup(client)
    h2 = signup(client, "bob@example.com")
    assert client.get("/api/auth/me", headers=h2).json()["role"] == "user"


def test_duplicate_and_validation(client):
    signup(client)
    assert client.post("/api/auth/register", json={"email": "alice@example.com", "password": "another-pass"}).status_code == 409
    assert client.post("/api/auth/register", json={"email": "not-an-email", "password": "long-enough-pw"}).status_code == 422
    assert client.post("/api/auth/register", json={"email": "c@example.com", "password": "short"}).status_code == 422


def test_wrong_password_and_throttle(client):
    signup(client)
    for _ in range(5):
        assert client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password"}).status_code == 429


def test_protected_routes_need_token(client):
    assert client.get("/api/contracts").status_code == 401
    assert client.get("/api/auth/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
