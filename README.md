# Adaptive Flashcard Application

[![CI Verification](https://github.com/BastianKindereit/flashCards/actions/workflows/verify.yml/badge.svg)](https://github.com/BastianKindereit/flashCards/actions/workflows/verify.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An adaptive, memory-modeled flashcard web application built with **React 18**, **TypeScript (Strict Mode)**, **Vite**, **Tailwind CSS**, and **Supabase (PostgreSQL + RLS)**. Implements the **Free Spaced Repetition Scheduler (FSRS-4.5)** algorithm alongside priority-utility queue optimization for deterministic, mathematically rigorous study sessions.

---

## 1. Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS recommended)
- **npm**: `v10.x` or higher
- **Container Runtime**: Docker Desktop, Colima, or Podman (required for local Supabase CLI stack)
- **Supabase CLI**: `v1.200.0` or higher (`brew install supabase/tap/supabase`)
- **Git**: Modern git client with standard CLI tools (`openssl`, `sha256sum`)

---

## 2. Local Setup

### 2.1 Clone Repository & Install Dependencies
```bash
git clone https://github.com/BastianKindereit/flashCards.git
cd flashCards

# Install exact pinned dependencies from committed package-lock.json (CIC-001)
npm ci
```

### 2.2 Configure Environment
Copy the example environment configuration:
```bash
cp .env.example .env
```
For local development against the local Supabase stack, update `.env`:
```env
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key-from-supabase-status>
```

### 2.3 Local Database Stack
Start the local Supabase container stack and apply migrations:
```bash
npm run test:setup
```
This verifies your container runtime, launches Postgres, Auth, and Storage, resets migrations, seeds deterministic fixtures, and outputs schema checksums.

### 2.4 Start Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 3. Testing & Verification

### 3.1 Unit & Component Test Suite
Runs Vitest with v8 coverage enforcement across unit, component, property-based, and PGlite database tests:
```bash
npm test
# Or with coverage enforcement:
npx vitest run --coverage
```
Strict coverage gates:
- Overall codebase: **>=85% statements**, **>=80% branches** (TST-013)
- Core domain engines (`scheduler.ts`, `fsrsService.ts`, `csvParser.ts`, `normalization.ts`, `useStudySession.ts`): **>=95% statements**, **>=90% branches** (TST-012)

### 3.2 Performance Benchmarks
Runs isolated benchmarks for selection latency (10,000 cards + 100,000 events) and CSV parsing/batch import (10,000 rows):
```bash
npm run test:perf
```

### 3.3 Traceability Verification
Ensures 100% bidirectional coverage between SRS requirements (FCA-SRS-001) and verification activities (FCA-VVP-001):
```bash
npm run test:traceability
```

### 3.4 Secret & Credential Scanning
Scans git-tracked files and dist builds for hardcoded secrets, canary tokens, and private keys:
```bash
npm run secret-scan
```

### 3.5 End-to-End & Accessibility Tests
Runs Playwright across Chromium, Firefox, and WebKit with `@axe-core/playwright` accessibility audits:
```bash
npm run test:e2e
```

### 3.6 Full Orchestrated Verification Suite
Runs the end-to-end verification orchestrator (`scripts/verify.mjs`):
```bash
npm run verify
```
This executes:
1. Frozen lockfile integrity check
2. TypeScript strict compilation (`tsc -b`)
3. ESLint zero-warning linting
4. Full test suite with code coverage enforcement
5. Traceability matrix validation
6. Production build (`vite build`) and asset SHA-256 manifest generation
7. Security and credential scanning
8. Production dependency vulnerability audit
9. Database integration tests (pgTAP) & Playwright E2E suites

---

## 4. Release Report Generation

Generate the human-readable (`verification_report.md`) and schema-validated JSON (`verification_report.json`) release reports:
```bash
npm run report:release
```
In accordance with FCA-VVP-001 Section 20, if any test suite fails, manual procedure is uncompleted, or host environment dependencies are blocked, the report generator will output `do-not-release` and exit non-zero.

---

## 5. Production Build & Deployment

### 5.1 Build
```bash
npm run build
```
Builds optimized, static Single-Page Application assets and PWA service worker into `dist/`.

### 5.2 Deployment
Deploy static assets to any secure static hosting platform (e.g., Cloudflare Pages, Vercel, Netlify, AWS S3/CloudFront).
Ensure appropriate HTTPS headers:
- `Content-Security-Policy`: Default strict policy with Supabase backend domains allowlisted.
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`

---

## 6. Disaster Recovery & Database Restoration

### 6.1 Database Snapshots
Create a point-in-time schema and data snapshot via Supabase CLI:
```bash
supabase db dump -f backup_$(date +%Y%m%d%H%M%S).sql
```

### 6.2 Database Restoration
Restore from an existing SQL backup file:
```bash
supabase db reset
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f backup_<timestamp>.sql
```

### 6.3 Diagnostic State Export
Users can export an authenticated, decrypted JSON diagnostic bundle directly from the UI via the **Diagnostics View** (`DIA-001`).

---

## 7. Known Limitations & Architecture

For details on mathematical retention models, self-reported grading assumptions, and deferred features, refer to:
- [docs/data_dictionary.md](docs/data_dictionary.md) — Comprehensive schema, RLS policies, and RPC specifications.
- [docs/limitations.md](docs/limitations.md) — Residual risks and limitations.
- [docs/decisions.md](docs/decisions.md) — Architectural decisions and verification records.

---

## 8. License

This project is licensed under the [MIT License](LICENSE).
