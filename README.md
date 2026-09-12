<div align="center">

<img src="public/logo.png" alt="CalmLogs Logo" width="72" height="72" style="border-radius: 14px;" />

# CalmLogs

**Minimalist, Edge-Native, Open-Source Distributed Logging for Developers.**  
*Zero code modifications. 1-command stream. Runs 100% free on Cloudflare.*

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Edge Native](https://img.shields.io/badge/Edge%20Native-Cloudflare%20Workers-orange.svg)](https://workers.cloudflare.com/)
[![Security Audit](https://img.shields.io/badge/Security%20Audit-100%2F100%20Pass-emerald.svg)](docs/security-audit.md)
[![Zero SDK Bloat](https://img.shields.io/badge/SDK%20Bloat-Zero-blue.svg)](#)

[**Website (calmlogs.com)**](https://calmlogs.com) &bull; [**Documentation (docs.calmlogs.com)**](https://docs.calmlogs.com) &bull; [**LLM Spec (llms.txt)**](public/llms.txt)

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/SaiAkashNeela/calmlogs">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers" />
  </a>
</p>

</div>

---

## Why CalmLogs?

Most logging solutions force you into an unpleasant trade-off:
1. **Proprietary SaaS (Datadog, New Relic):** Heavy host agents that consume 200MB+ RAM, complex code-level SDKs, and surprise monthly cloud bills.
2. **Heavy Self-Hosted Clusters (Elasticsearch, Loki):** Days of setup, Prometheus/Promtail configurations, and massive Kubernetes overhead.

**CalmLogs takes the Unix philosophy:**
- If your process prints to `stdout` or writes JSON lines, CalmLogs can ingest, index, and live-tail it.
- **Zero code changes** required in your application repository.
- Native **Docker Compose** auto-resolution splits multi-container networks (`api`, `postgres`, `redis`) into separate dashboards on the fly.
- Runs entirely on **Cloudflare's permanent free tier** (R2 + Workers + D1).

---

## Quickstart in 30 Seconds

### 1. Unix Pipe (Zero Configuration)
Pipe your application output directly into the `calmlogs` CLI:

```bash
# Node.js
npm start | npx calmlogs

# Python (unbuffered)
python -u main.py | npx calmlogs

# Go / Rust
go run . | npx calmlogs
cargo run | npx calmlogs
```

*When `--project` or `--service` are omitted, CalmLogs automatically infers the project from your directory name and the service from `package.json` without dropping logs.*

### 2. Process Runner
Run your server as a child process:

```bash
npx calmlogs run --project "core" --service "api" -- npm run dev
```

---

## Docker Compose Sidecar Service

Forward all container logs across your entire `docker-compose.yml` network into CalmLogs by adding 1 drop-in service:

```yaml
services:
  # ... your existing containers (web, api, postgres, redis, etc.) ...

  # CalmLogs Forwarder Service
  calmlogs:
    image: node:alpine
    container_name: calmlogs-forwarder
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    # networks: [backend_net]  # Optional: limit to specific network
    command: >
      sh -c "apk add --no-cache docker-cli docker-cli-compose &&
      docker compose logs -f --no-color | npx -y calmlogs --project 'prod-stack' --key 'cl_live_your_key'"
```

**How Auto-Resolution Works:**  
Docker Compose lines look like `postgres-1 | database ready` or `redis-1 | ready`. CalmLogs parses the container prefix, strips the `-1` instance tag, and dynamically registers `postgres` and `redis` as separate service tabs in your dashboard.

---

## 100% Free on Cloudflare's Free Tier

CalmLogs is engineered specifically around Cloudflare's generous free allowance:

| Service | Included Cloudflare Free Tier | CalmLogs Real-World Capacity |
| :--- | :--- | :--- |
| **Cloudflare R2** | **10 GB / month**, 1M writes, 10M reads | **~100 Million** compressed log lines |
| **Cloudflare Workers** | **100,000 requests / day** (3M / month) | **~5,000,000 logs / day** (batched) |
| **Cloudflare D1 (SQLite)** | **5 GB storage**, 5M reads / 100k writes per day | Millions of segment & index rows |
| **Bandwidth** | **Unlimited $0.00 egress fees** | Zero network bandwidth charges |

---

## Architecture Overview

```
[ Developers / CLI / Docker Compose ]
                 │
                 ▼  (TLS 1.3 / HTTPS)
    [ Cloudflare Worker Edge Gateway ]
    ├─ Ingestion rate limits (5MB body, 1k batch)
    ├─ SHA-256 Key Authentication
    ├─ Input delimiter & path sanitization
    │
    ├──► [ Cloudflare D1 (SQLite) ]
    │    └─ 100% parameterized SQL prepared statements
    │    └─ BetterAuth session & organization RBAC
    │
    └──► [ Durable Objects (LogRingBuffer) ]
         ├─ In-memory ring buffer pub/sub broker
         ├─ Instant client WebSocket fan-out
         └─ Periodic alarm flush
              │
              ▼
         [ Cloudflare R2 (S3 Cold Storage) ]
         └─ Compressed JSONL segment archiving
```

---

## CLI Options Reference

```
Usage:
  <command> | npx calmlogs [options]
  npx calmlogs run [options] -- <command>

Options:
  -p, --project <name>      Project name (default: auto-detected or 'default')
  -s, --service <name>      Service name (default: auto-detected or 'app')
  -k, --key <token>         Ingestion API key (cl_live_...)
  -e, --endpoint <url>      CalmLogs host (default: http://localhost:3000)
  -n, --network <name>      Docker network metadata filter
```

---

## Direct HTTP Ingestion API

```bash
curl -X POST http://localhost:3000/v1/logs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer cl_live_your_key" \
  -d '[
    {
      "project": "finance",
      "service": "billing",
      "level": "info",
      "message": "Invoice #inv_9901 processed",
      "metadata": { "amount": 120.00, "currency": "USD" }
    }
  ]'
```

---

## Security & RBAC

CalmLogs passed a **Defensive Cyber Security Audit**.  
See the full report in [`docs/security-audit.md`](docs/security-audit.md).

- **SHA-256 Key Security:** Plaintext ingestion keys are never stored; only one-way SHA-256 hashes are persisted in SQLite.
- **Tenant Isolation:** Multi-tenant boundaries strictly partition projects and services per organization.
- **Anti-DoS:** Max 5MB body limit, max 1,000 logs per batch, and individual message strings clamped to 64KB.
- **Direct Workspace Invites:** Admins share direct invitation links without requiring third-party SMTP or email credentials. Recipients can review, accept, or decline the invite upon sign-in.

---

## Self-Hosting Guide

### 1-Click Deploy to Cloudflare Workers

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/SaiAkashNeela/calmlogs)

> [!IMPORTANT]
> **CRITICAL CONFIGURATION FOR OPEN-SOURCE DEPLOYMENTS:**
> When self-hosting CalmLogs, you **MUST configure your Google OAuth credentials and URLs** in Cloudflare and in your [Google Cloud Console](https://console.cloud.google.com/apis/credentials):
> 
> 1. **Cloudflare Environment Secrets:**
>    ```bash
>    npx wrangler secret put GOOGLE_CLIENT_ID
>    npx wrangler secret put GOOGLE_CLIENT_SECRET
>    npx wrangler secret put BETTER_AUTH_SECRET
>    ```
> 2. **Cloudflare Environment Variable (`BETTER_AUTH_URL`):**  
>    In `wrangler.toml` or Cloudflare Dashboard, set **`BETTER_AUTH_URL = "https://<your-worker-subdomain>.workers.dev"`** (or your custom domain).
> 
> 3. **Google Cloud Console (OAuth 2.0 Web Client) Settings:**
>    - **Authorized JavaScript origins (JS URL):**  
>      - Production: **`https://<your-worker-subdomain>.workers.dev`** (or `https://<your-custom-domain>`)  
>      - Local Dev: **`http://localhost:3000`**  
>    - **Authorized redirect URIs (OAuth Redirect):**  
>      - Production: **`https://<your-worker-subdomain>.workers.dev/api/auth/callback/google`** (or `https://<your-custom-domain>/api/auth/callback/google`)  
>      - Local Dev: **`http://localhost:3000/api/auth/callback/google`**  

### Or Deploy Manually via CLI

```bash
# 1. Clone the repository
git clone https://github.com/SaiAkashNeela/calmlogs.git
cd calmlogs

# 2. Install dependencies & build
bun install
bun run build

# 3. Apply database migrations to Cloudflare D1
npx wrangler d1 migrations apply DB --remote

# 4. Set required Google OAuth & Auth secrets (BOLD REQUIREMENT)
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put BETTER_AUTH_SECRET

# 5. Deploy worker to edge
npx wrangler deploy
```

---

## Credits & Attribution

- **Author & Engineering:** [Sai Akash Neela](https://saiakashneela.com) ([saiakash.dev](https://saiakash.dev))
- **Design & UX Partner:** [Geeks Designs](https://geeksdesigns.com)
- **Built With:** Cloudflare Workers, Durable Objects, BetterAuth, D1 SQLite, R2, Vite, and React.

## License.

Released under the **[MIT License](LICENSE)**. Free for personal, commercial, and open-source use.
