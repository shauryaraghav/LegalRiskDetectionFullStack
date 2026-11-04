# DevOps: pipeline, infrastructure, monitoring

```
git push ─► GitHub Actions ─► ruff + pytest (90 tests, >=80% coverage gate) + tsc/vitest/build
                           ─► docker build (cached) ─► Trivy scan (CRITICAL fails the build)
                           ─► push to GHCR (:sha, :latest)
                           ─► [main only] ssh to EC2 ─► pull ─► up -d ─► wait for health ─► rollback on failure
                           ─► smoke test https://<domain>/api/health

Internet ─► Caddy (auto TLS) ─► nginx (SPA + /api proxy) ─► FastAPI ─► PostgreSQL
                                                              │
Prometheus ◄─ backend /metrics, node-exporter, cAdvisor ──────┘      Grafana (SSH tunnel only)
```

## What lives where
| Path | Purpose |
|---|---|
| `.github/workflows/ci-cd.yml` | Lint, test, build, scan, push, deploy |
| `Dockerfile.backend`, `frontend/Dockerfile` | Non-root images with health checks |
| `docker-compose.yml` | Local / single-machine stack |
| `docker-compose.prod.yml` | Production stack (Caddy, app, DB, monitoring) |
| `infra/terraform/` | EC2, Elastic IP, security group, IAM role, encrypted S3 backup bucket |
| `deploy/` | Caddyfile, Prometheus + alert rules, Grafana dashboard, `deploy.sh`, `backup.sh` |

## One-time setup
1. **Infrastructure.**
   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars   # fill in
   terraform init && terraform apply
   ```
   No domain needed: the hostname defaults to `<ip-with-dashes>.sslip.io` (see the `domain` output). Set `domain` only if you own one.
2. (nothing to do for DNS)
3. **GitHub settings.** Secrets: `EC2_HOST` (the IP), `EC2_SSH_KEY` (private key matching `ssh_public_key`).
   Variables: `DOMAIN` (the `domain` output), `DEPLOY_ENABLED=true`. Create an environment named `production`.
4. **Deploy.** Push to `main`. The first run uploads the compose file and config, pulls images, and Caddy issues the certificate.

## AWS Academy Learner Lab
Works with two changes in `terraform.tfvars`: `region = "us-east-1"` and `existing_instance_profile = "LabInstanceProfile"`.
- Credentials expire every session. Each time: Learner Lab -> AWS Details -> copy the three values into `~/.aws/credentials`
  (`aws_access_key_id`, `aws_secret_access_key`, `aws_session_token`) before running Terraform.
- The instance is stopped when the lab session ends; start the lab again to bring it back (Elastic IP and hostname stay the same).
  CI deploys only work while the lab is running.
- Budget is limited, so `terraform destroy` when you are done.

## Operations
- **Grafana:** `ssh -L 3000:localhost:3000 ec2-user@<ip>` then http://localhost:3000 (user `admin`, password in `/opt/legalrisk/.env`).
- **Alerts:** rules are in `deploy/prometheus/alerts.yml` and visible at Prometheus `:9090/alerts` (tunnel port 9090 the same way). There is no Alertmanager yet, so nothing is sent anywhere.
- **Rollback:** automatic if the backend is unhealthy after deploy. Manual: `cd /opt/legalrisk && ./deploy/scripts/deploy.sh <older-sha>`.
- **Backups:** cron runs `backup.sh` daily at 02:17 UTC, 30-day retention in S3. Restore command is in the script header. Only Postgres is backed up (not the `models`/`data` volumes).
- **Tear down:** `terraform destroy` (the backup bucket must be emptied first).

## Known limits
- Single instance, no HA. Postgres runs on the same box as the app.
- Terraform state is local. Move it to an S3 backend before sharing the project.
- `ssh-keyscan` trusts the host key on first connection (trust-on-first-use) in CI.
- Analysis jobs run in the API process (FastAPI background tasks), so a restart marks in-flight jobs failed.
