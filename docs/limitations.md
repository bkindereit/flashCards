# Adaptive Flashcard Application — Residual Risks & Limitations (DEL-009)

This document formalizes the known constraints, residual risks, and deferred non-mandatory requirements for the current release candidate of the Adaptive Flashcard Application in accordance with FCA-SRS-001 and FCA-VVP-001 Section 17.15.

---

## 1. Core System Limitations & Assumptions

### 1.1 Self-Reported Grading
- **Assumption**: Recall evaluations are self-reported by the learner (`1` = Incorrect, `2` = Correct) upon answer reveal.
- **Residual Risk**: User bias or subjective grading variations directly influence stability and difficulty parameters calculated by FSRS. The application cannot independently assess semantic correctness.

### 1.2 Algorithmic Estimation
- **Assumption**: The Free Spaced Repetition Scheduler (FSRS-4.5) algorithm and the priority utility function model cognitive retention decay mathematically based on population averages.
- **Residual Risk**: Memory estimation does not guarantee specific individual recall outcomes or academic exam performance.

### 1.3 Default Scheduling Parameters
- **Assumption**: Default parameters (target retention: 90%, cohort size: 10, new card fraction: 30%, failed card spacing: 60s / 3 intervening cards) are engineering baseline defaults.
- **Mitigation**: Users may customize deck retention and cohort sizes within validated bounds (`0.70`–`0.97` retention, `5`–`20` cohort size) in Deck Settings.

### 1.4 Network Connectivity & PWA Mode
- **Assumption**: While the application provides a Service Worker and PWA webmanifest for asset caching, study sessions and database mutations require active HTTPS connectivity to Supabase backend services.
- **Residual Risk**: Offline study queuing is not supported in Version 1. Network disconnection triggers an immediate error banner and blocks card rating submission until connectivity is restored.

### 1.5 Accessibility Verification Scope
- **Assumption**: Automated accessibility scanners (`@axe-core/playwright`, vitest component checks) verify WCAG 2.1 AA structural syntax, ARIA attributes, contrast ratios, and focus indicator styles.
- **Residual Risk**: Automated tests cover approximately 30–50% of real-world accessibility barriers. Full compliance release gating requires human operator sign-off of manual protocols (`MAN-ACC-001`, `MAN-ACC-002`).

### 1.6 Remote Reference Network Performance (PRF-003)
- **Assumption**: Initial load to interactive study view within 3.0 seconds at p95 requires an operational remote reference network and warm cache.
- **Residual Risk**: In local test environments without remote network conditions, PRF-003 is tracked as unmeasured / blocked per DEC-004 pending production staging benchmark execution.

---

## 2. Deferred Non-Mandatory Requirements

In accordance with Section 17.14 and 17.15 of the VVP, all 209 **Must** requirements are implemented and verified. The following 2 **Should** requirements from FCA-SRS-001 are documented as deferred:

| Requirement ID | Priority | Description | Status | Rationale |
|---|---|---|---|---|
| `MGT-009` | Should | The system should support exporting cards from a deck in CSV format. | Deferred | Export is deferred to Version 1.1 in favor of the structured diagnostic export (`DIA-001`). Card creation and import are fully verified. |
| `REL-006` | Should | The system should provide an automated JSON backup and restore verification harness. | Deferred | Database disaster recovery is provided by PostgreSQL WAL backups and pg_dump snapshot tools in Supabase. A standalone UI harness is scheduled for Version 1.1. |

---

## 3. Waivers and Deviations

**Zero waivers or deviations have been requested or approved.**
All gates and criteria are evaluated strictly according to FCA-VVP-001.
