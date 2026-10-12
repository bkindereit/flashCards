# Decision & Deviation Log

Baseline: FCA-SRS-001 v1.0 (authoritative implementation) and FCA-VVP-001 v1.0 (acceptance / release gating).

| ID | Date | Requirement(s) | Decision | Approved by | Status |
|---|---|---|---|---|---|
| DEC-001 | 2026-10-10 | Versioning Instructions.docx vs. SCH-001 | Externally versioned subroutines are pinned by exact version + lockfile (`ts-fsrs@4.4.1`); see `.agents/rules/shared_subroutine_policy.md`. | Implementer | Closed |
| DEC-002 | 2026-10-10 | Section 9.4 timing estimate | Initial EWMA review-time default 15.0 s, alpha 0.1. | Implementer | Closed |
| DEC-003 | 2026-10-12 | TST-001, FCA-VVP §6.1, §7 (pgTAP via Supabase CLI) | No container runtime on the development host. **Decision: build to the spec as written.** The repository targets the Supabase CLI local stack (`supabase start`, `supabase db reset`, `supabase test db`). The user will install a container runtime + Supabase CLI. Until then, database/RLS/RPC behaviour is additionally exercised in-process via PGlite; PGlite runs are supplementary evidence and **do not** replace the pgTAP activity. | User (2026-10-12) | Open: environment pending |
| DEC-004 | 2026-10-12 | MAN-ACC-001, MAN-ACC-002, MAN-PWA-001, MAN-EXP-001, VR-009, VR-010, §6.3 staging, CIC-006/007, PRF-003 | Activities requiring a human operator, staging project, deployment target or release authority are reported as `Not Run`/`Blocked`. The release report must recommend `Do Not Release` until they're completed. Signable checklists are provided in `docs/manual-verification/`. | User (2026-10-12) | Open |
| DEC-005 | 2026-10-12 | TST-012, TST-013, TST-014 | A prior session had excluded UI code from the coverage gate, lowered core-module per-file thresholds to 85/80 and added `v8 ignore` comments. These were unapproved reinterpretations and have been **reverted**: gates now match the SRS text exactly. | Implementer (self-correction) | Closed |
| DEC-006 | 2026-10-12 | TST-016..018 | A prior session's matrix covered 74 of 193 Must requirements and marked Pass without existing evidence. The checker now derives the Must list from the SRS and rejects Pass results whose evidence is absent. | Implementer (self-correction) | Closed |

No waivers have been granted.
