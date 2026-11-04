# Clause: a full-stack contract risk review platform

Upload a contract and see which clauses are risky, why, and what safer wording to ask for. Users sign in, keep a history of reviewed contracts, compare drafts, and correct the model's mistakes. Admins review those corrections and retrain the model.

> **Disclaimer:** educational project. It is not legal advice and no substitute for a lawyer.

The ML engine (clause splitting, TF-IDF + Logistic Regression + rule engine, CUAD data) lives in [`src/`](src) and is documented in [`docs/ENGINE.md`](docs/ENGINE.md). This repository wraps it in a web platform.

```
React + TypeScript (Vite)  ──/api──►  FastAPI  ──►  PostgreSQL (SQLite in dev)
        nginx in Docker                  │
                                         └──►  src/  (scikit-learn models, rules, PDF report)
```

## What the platform adds

| Area | Details |
|---|---|
| **Accounts** | Register / sign in with JWT bearer tokens, bcrypt password hashing, login throttling, per-user data isolation (other users' contracts return 404) |
| **Storage** | Users, contracts, clauses, feedback, comparisons and model runs in SQL (SQLAlchemy 2.0) |
| **Background analysis** | Upload returns immediately (HTTP 202); analysis runs as a background job and the UI polls until it finishes. Jobs interrupted by a restart are marked failed instead of hanging |
| **Contract viewer** | Marked-up clauses with the model's key terms highlighted, risk ruler, per-category breakdown, negotiation suggestions, missing protections, what-if scenarios, PDF download |
| **History** | Search, filter by risk level, pagination, summary stats |
| **Compare** | Pick two of your contracts; see added, removed and reworded clauses with word-level diffs and the risk change |
| **Feedback loop** | Users suggest a corrected category/risk. An admin approves or rejects it; only approved corrections reach the training data |
| **Retraining** | Admin-triggered background job; each run records its accuracy in the database |
| **Quality page** | Cross-validated metrics, including accuracy on 469 unseen real contracts |

## Run it locally

You need Python 3.11+ and Node 20+.

```bash
# 1. backend  (http://localhost:8000/docs)
pip install -r requirements-server.txt
uvicorn server.main:app --reload

# 2. frontend (http://localhost:5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

The first account you register becomes the admin. Locally the database is a SQLite file (`legalrisk.db`).

## Run it with Docker

```bash
cp .env.example .env          # set POSTGRES_PASSWORD and JWT_SECRET
docker compose up --build     # http://localhost:8080
```

Models and approved corrections live in named volumes, so retraining survives restarts.

## API

All routes are under `/api`; interactive docs are at `/docs`.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register`, `/auth/login` | Get a token |
| GET | `/auth/me` | Current user |
| POST | `/contracts` | Upload a PDF/TXT or paste text (multipart); returns 202 |
| GET | `/contracts` | List with `q`, `overall`, `status`, `limit`, `offset` |
| GET | `/contracts/stats` | Counts by risk level |
| GET / DELETE | `/contracts/{id}` | Detail with clauses / delete |
| GET | `/contracts/{id}/report.pdf` | PDF report |
| POST | `/compare` | Compare two contracts |
| POST | `/clauses/{id}/feedback` | Suggest a corrected label |
| GET | `/admin/feedback`, POST `/admin/feedback/{id}/review` | Review queue (admin) |
| POST | `/admin/retrain`, GET `/admin/model-runs` | Retraining (admin) |
| GET | `/meta`, `/metrics`, `/health` | Labels, model metrics, health |

## Tests

```bash
python -m pytest tests server_tests -q      # ML engine + API (auth, isolation, jobs, compare, feedback)
cd frontend && npx tsc -b && npm test       # types + helpers (diffing, highlighting, error parsing)
```

CI runs both plus the Docker builds ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Security notes

- Passwords are hashed with bcrypt; tokens expire after 12 hours (`JWT_EXPIRE_MINUTES`).
- The app refuses to start in production without a custom `JWT_SECRET`.
- Uploads are limited to 10 MB and 300,000 characters; only PDF/TXT are accepted.
- Contract text is rendered as React text (never as HTML), so it cannot inject markup.
- Users can only read, compare, delete or give feedback on their own contracts.

## Known limitations

- Risk rating is the weak half of the model (about 65% accuracy on a small hand-labelled set); category classification is much stronger. The Model page shows both honestly.
- Analysis jobs run inside the API process (FastAPI background tasks). That is fine for one instance; for several instances or heavy load, move them to a queue such as Celery or RQ with Redis.
- Tables are created with `create_all`; there are no Alembic migrations yet.
- The login throttle is in memory and per process.
- The token is kept in `localStorage`; an httpOnly cookie would be stronger.
- Scanned PDFs (no selectable text) are not supported.

## Credits

The classifier is  MIT licensed. Keep the original `LICENSE` file with this repository. Contract data for the category model comes from [CUAD](https://www.atticusprojectai.org/cuad).

## Deployment and operations

CI/CD (GitHub Actions), production compose stack, Terraform for AWS, and Prometheus/Grafana monitoring are documented in [`docs/DEVOPS.md`](docs/DEVOPS.md).
