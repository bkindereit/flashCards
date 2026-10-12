# Adaptive Flashcard Application — Implementation and Verification Plan

**Document ID:** FCA-PLAN-001  
**Applicable Baseline:** `FCA-SRS-001` (v1.0) & `FCA-VVP-001` (v1.0)  
**Status:** Approved for Execution  

---

## 1. Executive Summary & Objective

This plan governs the end-to-end implementation and release verification of the **Adaptive Flashcard Application** (`flashCards`), an AI-assisted, text-only, cloud-synchronized flashcard application tailored for active recall and spaced repetition learning using the Free Spaced Repetition Scheduler (FSRS).

Every requirement designated **Must** in `FCA-SRS-001` is treated as release-blocking. Implementation will proceed strictly according to the defined sequence in Section 18 of the SRS, and verification evidence will be generated for 100% of Must requirements in accordance with `FCA-VVP-001`.

---

## 2. Baseline Alignment & Discrepancy Analysis

Before coding, we cross-analyzed all instructions in the workspace (`flashcard-srs.md`, `flashcard-verification.md`, and `Versioning Instructions.docx`):

### 2.1 Shared Subroutine Versioning Policy vs. Application Dependencies
- **Finding:** `Versioning Instructions.docx` outlines a global policy for pinning an external shared subroutine repository by Git tag or commit. `flashcard-srs.md` specifically designates `ts-fsrs` (pinned in `package-lock.json`) as the memory engine.
- **Resolution:** We have codified the versioning guidelines into `.agents/rules/shared_subroutine_policy.md` and repository standards. `ts-fsrs` will be strictly pinned with an exact version in `package.json` / `package-lock.json`, satisfying `SCH-001`, `SCH-002`, and `CIC-001`.

### 2.2 Local Database Testing Without Docker
- **Finding:** `FCA-SRS-001` specifies Supabase PostgreSQL with migrations, RLS, and RPC functions, and `pgTAP` for database testing via the Supabase CLI. Local machines without a running Docker daemon cannot spin up `supabase start`.
- **Resolution:**
  1. We will author 100% standard, production-ready PostgreSQL migrations (`supabase/migrations/`) containing all required tables, constraints, RLS policies, triggers, and RPC functions.
  2. We will provide full `pgTAP` test suites (`supabase/tests/database/*.sql`) for execution via Supabase CLI in CI.
  3. For hermetic local verification (`npm run verify`) without external dependencies or Docker daemons, we will utilize `@electric-sql/pglite` (WebAssembly Postgres) to run the exact PostgreSQL migrations, RLS checks, and RPC function unit tests in-process.

### 2.3 Exponentially Weighted Average (EWMA) Initial Default
- **Finding:** `SES-010` requires maintaining an exponentially weighted estimate of seconds per review, which feeds into utility calculations (`SCH-033`).
- **Resolution:** Default initial review duration is set to **15.0 seconds** (configurable), updating with `alpha = 0.1` upon each valid interaction.

---

## 3. Architecture & Tech Stack

| Layer | Component | Specification / Version |
|---|---|---|
| **Language & Framework** | TypeScript (Strict Mode) + React 18/19 | Strict compiler options (`noImplicitAny`, `strictNullChecks`, etc.) |
| **Build & Dev Server** | Vite | Static SPA output, HTTPS local dev support |
| **PWA** | Vite PWA Plugin / Service Worker | Web app manifest, offline shell caching, installability criteria |
| **Memory Model** | `ts-fsrs` | Pinned exact version, custom 2-button mapping (`Good` / `Again`) |
| **Backend & Auth** | Supabase (PostgreSQL 15+, Auth, RPCs) | RLS on every table, transactional security-definer RPCs |
| **Database Testing** | `pgTAP` + `@electric-sql/pglite` | pgTAP for Supabase CLI, PGlite for in-memory hermetic test suite |
| **Unit & Integration** | Vitest | >=95% statement, >=90% branch on core modules; >=85% / >=80% overall |
| **E2E & Accessibility** | Playwright + axe-core | Chromium, Firefox, WebKit cross-browser; WCAG 2.1 A/AA scans |
| **Traceability** | Custom bidirectional checker | Validates 1:1 mapping of SRS IDs to tests and evidence |

---

## 4. Work Breakdown Structure & Implementation Phases

### Phase 1: Project Shell, TypeScript, Vite & Tooling
- Initialize `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, ESLint, Prettier.
- Configure PWA manifest, service worker, icons, and offline detection.
- Setup test harness, factories (`src/testing/factories/`), and canonical fixtures (`tests/fixtures/`).

### Phase 2: PostgreSQL Schema, Migrations, RLS & RPCs
- **Tables:** `profiles`, `decks`, `import_batches`, `cards`, `study_sessions`, `session_card_state`, `review_events`, `selection_events`, `grade_operations`.
- **Integrity Constraints:** `correct_count + incorrect_count = review_count`, unique active `(user_id, deck_id, content_hash)`, UUID PKs, timezone-aware UTC timestamps.
- **RPC Functions:**
  - `submit_grade(op_id, session_id, card_id, rating, timing_data)`: Atomic grade, counter update, review event append, idempotency check.
  - `undo_grade(op_id, session_id)`: Atomic rollback, event invalidation, counter adjustment.
  - `commit_import(batch_id, deck_id, cards_data)`: Atomic batch card insertion, duplicate skipping.
- **RLS:** Policies enforcing authenticated user ownership across all operations.

### Phase 3: FSRS Integration & Adaptive Selection Engine
- Integrate `ts-fsrs` with pinned version.
- Implement canonical candidate generator:
  - Queue 1: Eligible Relearning (anti-echo delay & intervening cards)
  - Queue 2: Mandatory Overdue (`> max(7 days, scheduled_interval)`)
  - Queue 3: Due Review
  - Queue 4: Active Cohort (subject to 30% acquisition ceiling)
  - Queue 5: Early Review (if beneficial)
- Implement utility calculation:
  $$expected\_gain = R_{now} \times P_g + (1 - R_{now}) \times P_a - P_0$$
  $$base\_utility = \frac{importance\_weight \times expected\_gain}{estimated\_review\_seconds}$$
- Implement deterministic tie-breaking via seeded random generator (`TST-007`).
- Property-based tests verifying 10,000 generated histories (`TST-010`, `TST-011`).

### Phase 4: Canonical Normalization & CSV Import
- Canonical 7-step UTF-8 NFC pipeline.
- SHA-256 content hashing with ASCII unit-separator `0x1F`.
- RFC 4180 parsing with preview (first 20 rows, insert/duplicate/reject counts).
- Atomic commit and duplicate preservation.

### Phase 5: Study Interface, Keyboard Accessibility & Sessions
- Question reveal (`Space` / `Enter` / `Give me the answer`).
- Grading (`1` for `I got it!`, `2` for `Dang, I missed it!`).
- `Undo last grade` action control.
- Pause / resume timer logic excluding paused time from review metrics.
- Timed sessions (5, 10, 15, 20, 30 min presets + custom 1-240 min).
- Session summary view with stats.

### Phase 6: Card Management, Diagnostics & Data Export
- Search, filter, edit Q/A, suspend, restore.
- Settings view with `Run diagnostics` (health checks, FSRS conformance vector, schema verification).
- JSON export of all owned data (`REL-005`).

### Phase 7: Verification & Release Gating
- Traceability matrix validation (`npm run test:traceability`).
- Coverage evaluation (>=95% core, >=85% overall).
- Automated accessibility scans (axe-core WCAG 2.1 A/AA).
- Performance benchmarking (10,000 cards, 100,000 events selection <500ms 95th percentile).
- Release verification report generation (`verification_report.md` and `verification_report.json`).
