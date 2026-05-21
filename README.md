# RaceOps

RaceOps is a data analytics tool for race directors. It turns race registration exports and race results exports into practical, export-friendly reports without retaining personally identifiable information.

The app currently supports CSV uploads. If a platform provides an Excel export, save or export it as CSV before uploading.

## Current Workflows

### Registration Analytics

Upload registration/export CSVs from UltraSignup to analyze registrants and participants before race day. Registration Analytics supports single-year reports and multi-year comparisons, including:

- registration totals and active participant counts
- registration trends, timing, drops, waitlist/status breakdowns, coupons, and comped entries
- demographics, age distribution, geography, distance traveled, teams, and cross-event comparisons
- report headers that identify the registration import source

### Race Results

Upload results/timing CSVs from UltraSignup to analyze what happened on race day. Race Results supports single-year reports and multi-year comparisons, including:

- total participants/entrants, starters, finishers, DNS, DNF, and finish rate
- finish times, pace, and distance where applicable to the race format
- finisher demographics, age-group/division performance, geography, and cross-event results
- weather context when race date/time and venue are supplied
- report headers that retain results format terminology

RaceOps also includes synthetic demo data for both workflows and report views that can be saved as PDF from the browser.

---

## Local Development

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:3001
- Session store: in-memory (no AWS credentials required)

---

## Project Structure

```
racestats/
├── packages/
│   ├── server/        Node.js/Express API (TypeScript)
│   │   ├── src/
│   │   │   ├── adapters/      Platform-specific CSV parsers
│   │   │   ├── geo/           Geocoding and distance calculations
│   │   │   ├── parser/        CSV parsing
│   │   │   ├── routes/        Express route handlers
│   │   │   ├── session/       Session store (in-memory or S3)
│   │   │   └── stats/         Statistics engine
│   │   └── data/
│   │       └── zip-centroids.csv   42,354 US zip code centroids
│   └── client/        React/Vite frontend (TypeScript)
├── scripts/
│   ├── build/         Build scripts
│   ├── deploy/        Deploy scripts
│   ├── env/           Environment config
│   ├── release-backend.sh
│   └── release-ui.sh
├── Dockerfile.backend
└── .env.example
```

---

## AWS Architecture

```
Browser → CloudFront → S3               (static frontend)
Browser → App Runner                    (API, api.racestats.robfiero.net)
App Runner → S3 sessions bucket         (ephemeral session storage)
```

- **Frontend**: S3 (private) + CloudFront with OAC
- **Backend**: App Runner (ECR-backed container, port 8080)
- **Sessions**: S3 bucket with 24-hour lifecycle rule on `sessions/` prefix
- **Domains**: `racestats.robfiero.net` → CloudFront, `api.racestats.robfiero.net` → App Runner

---

## AWS Resource Setup (one-time)

### 1. ECR Repository
```bash
aws ecr create-repository \
  --repository-name racestats-backend \
  --region us-east-1
```

### 2. S3 — Sessions Bucket
```bash
aws s3api create-bucket \
  --bucket racestats-sessions-prod \
  --region us-east-1

aws s3api put-public-access-block \
  --bucket racestats-sessions-prod \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# 24-hour lifecycle rule
aws s3api put-bucket-lifecycle-configuration \
  --bucket racestats-sessions-prod \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-sessions",
      "Status": "Enabled",
      "Filter": {"Prefix": "sessions/"},
      "Expiration": {"Days": 1}
    }]
  }'
```

### 3. S3 — Frontend Bucket
Create a private S3 bucket for static files. Block all public access. Apply the CloudFront OAC bucket policy from the deployment document.

### 4. ACM Certificate
Request a certificate for `racestats.robfiero.net` and `api.racestats.robfiero.net` in **us-east-1** (required for CloudFront).

### 5. CloudFront Distribution
- Origin: the frontend S3 bucket (OAC)
- Default behavior: redirect HTTP→HTTPS, `Managed-CachingOptimized`
- Error pages: 403→`/index.html` (200), 404→`/index.html` (200)
- Custom domain: `racestats.robfiero.net`

### 6. App Runner Service
- Source: ECR image (`racestats-backend:latest`)
- Port: **8080**
- Environment variables:
  ```
  NODE_ENV=production
  PORT=8080
  SESSION_BUCKET=racestats-sessions-prod
  CLIENT_ORIGIN=https://racestats.robfiero.net
  AWS_REGION=us-east-1
  ```
- Health check: `GET /api/health`, interval 10s, timeout 5s, threshold 1/5
- IAM instance role: see below

### 7. App Runner IAM Instance Role
Trust policy principal: `tasks.apprunner.amazonaws.com`

Inline policy — S3 session access:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "SessionStoreAccess",
    "Effect": "Allow",
    "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
    "Resource": "arn:aws:s3:::racestats-sessions-prod/sessions/*"
  }]
}
```

### 8. Route 53
- `racestats.robfiero.net` → A alias → CloudFront distribution
- `api.racestats.robfiero.net` → A alias → App Runner custom domain

---

## Deployment

### Configure

Copy and fill in your values:
```bash
cp scripts/env/prod.env.example scripts/env/prod.local.env
# Edit prod.local.env — this file is gitignored
```

### Deploy Backend
```bash
./scripts/release-backend.sh
```
Builds the Docker image, pushes to ECR, triggers App Runner deployment.

### Deploy Frontend
```bash
./scripts/release-ui.sh
```
Builds the Vite app with `VITE_API_BASE_URL` set, syncs to S3, invalidates CloudFront.

---

## Environment Variables

| Variable | Where set | Description |
|---|---|---|
| `SESSION_BUCKET` | App Runner | S3 bucket for session storage. Absence triggers in-memory store (local dev). |
| `CLIENT_ORIGIN` | App Runner | Allowed CORS origin (e.g. `https://racestats.robfiero.net`) |
| `PORT` | App Runner | Server port (set to `8080`) |
| `NODE_ENV` | App Runner | Set to `production` |
| `AWS_REGION` | App Runner | AWS region for S3 client |
| `VITE_API_BASE_URL` | Build time | App Runner public URL (set by `release-ui.sh`) |
