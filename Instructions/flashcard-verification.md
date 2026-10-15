# Adaptive Flashcard Application — Verification Plan and Report Specification

**Document ID:** FCA-VVP-001  
**Version:** 1.0  
**Status:** Verification baseline  
**Applicable specification:** `FCA-SRS-001`, version 1.0

## 1. Purpose

This document defines the activities required to verify the adaptive flashcard application and the structure of the release verification report. It is both:

1. A **verification plan** describing environments, methods, test suites, procedures, acceptance criteria, evidence, anomaly handling, and release gates.
2. A **verification report specification** defining what Antigravity shall generate after executing those activities.

Requirements are written as singular shall statements with measurable evidence because verification requires objective, repeatable criteria rather than implementation assertions.[cite:158][cite:160][cite:164]

## 2. Verification objective

Verification shall establish, for the exact candidate release commit, that:

- Every Must requirement in FCA-SRS-001 has a defined verification method.
- Every linked automated verification has run and passed.
- Every required inspection, analysis, and demonstration has recorded evidence.
- The deployed architecture, schema, algorithms, interfaces, security controls, and operational behavior conform to the specification.
- Results can be reproduced from a clean checkout without production data or credentials.
- The report clearly distinguishes passed, failed, blocked, waived, and not-run activities.

Verification demonstrates conformity to the specified behavior; it does not prove that the learning policy is universally optimal or that a learner will pass an examination.

## 3. Methods

| Code | Method | Definition | Typical evidence |
|---|---|---|---|
| T | Test | Execute controlled inputs and compare observed results with explicit pass criteria. | JUnit/XML, JSON result, database assertion, Playwright trace, screenshot. |
| I | Inspection | Examine an artifact without executing the target behavior. | Reviewed migration, manifest, lockfile, schema diff, configuration, source scan. |
| A | Analysis | Reproduce a calculation or aggregate measurements against a threshold. | Performance dataset, percentile calculation, formula comparison, coverage report. |
| D | Demonstration | Execute a controlled human-observed procedure used where full automation is impractical. | Signed checklist, recording, screenshots, environment and operator identity. |

A requirement is verified only when all methods assigned to it pass. A waived test is not a passed test.

## 4. Roles

| Role | Responsibility |
|---|---|
| Implementer | Writes code and developer tests; may be Google Antigravity. |
| Verification executor | Runs the controlled verification suite and gathers evidence; may be automated CI plus a named human for manual activities. |
| Reviewer | Reviews failed, waived, manual, security, accessibility, and release evidence. |
| Release authority | Accepts residual risk and authorizes production release. |

The same person may hold multiple roles for this personal project, but the report shall identify which role performed each manual approval. Automated evidence shall remain independently reproducible.

## 5. Controlled configuration

Before verification, record and freeze:

- Git repository URL and exact commit SHA.
- Application semantic version.
- Node.js and package-manager versions.
- Dependency lockfile checksum.
- FSRS package and parameter-set versions.
- Scheduling-policy version.
- Supabase CLI and PostgreSQL versions.
- Ordered migration list and resulting migration version.
- Browser and Playwright versions.
- Operating system or CI image.
- Test fixture revision and checksum.
- CI workflow revision.
- Production-build artifact checksum.

Any change to application code, migration, dependency lockfile, scheduling parameters, required fixture, or test expected result after execution invalidates affected verification evidence and requires rerun.

## 6. Environments

### 6.1 Local verification environment

A disposable local environment shall be created through the Supabase CLI from version-controlled migrations and seed data. Supabase documents local development and migration workflows appropriate for reproducible schema setup.[cite:169][cite:172][cite:175]

The local environment shall:

- Use no production identifier or credential.
- Start from an empty database.
- Apply all migrations in order.
- Load only version-controlled non-personal fixtures.
- Provide test authentication without live email delivery.
- Be destroyable and recreatable.

### 6.2 CI environment

CI shall use a pinned runner image where practical, install dependencies from the lockfile, create the disposable Supabase environment, execute `npm run verify`, and retain required artifacts. Playwright supports Chromium, Firefox, and WebKit in CI and provides traces and screenshots for diagnosis.[cite:152][cite:155][cite:157]

### 6.3 Staging environment

Staging shall use a Supabase project and frontend deployment separate from production. It shall contain only non-personal acceptance data. Staging verification shall confirm deployment configuration, authentication flow, RPC permissions, migrations, diagnostics, and production-build operation.

### 6.4 Reference performance environment

The report shall identify:

- Processor or runner class, memory, and operating system.
- Browser engine and version.
- Database environment and region.
- Client-to-server network latency and any throttling.
- Warm-up procedure.
- Dataset cardinalities.
- Number of measured iterations.
- Raw-measurement artifact.

Performance results without this information shall be reported as invalid.

## 7. Test levels and tools

| Level | Required tool or equivalent | Primary purpose |
|---|---|---|
| Static | TypeScript compiler, ESLint | Type and source-rule conformity. |
| Unit | Vitest | Pure normalization, state, formulas, utility, and validation. |
| Property | TypeScript property-testing library | Invariants over generated valid histories. |
| Database | pgTAP through Supabase CLI | Constraints, RLS, RPCs, atomicity, idempotency, concurrency. |
| Integration | Vitest or Playwright API | Browser client, API, database, and authentication boundaries. |
| End-to-end | Playwright | User-visible behavior in three browser engines. |
| Accessibility | Playwright with axe-core plus manual checks | Automated WCAG defect detection and keyboard/screen-reader behavior. |
| Performance | Controlled scripted harness | Selection, import, and interaction thresholds. |
| Security | pgTAP, secret scan, dependency scan, configuration inspection | Isolation, privilege, and secret controls. |
| Recovery | Fault-injection integration and E2E tests | Retries, refresh, rollback, and conflicting submissions. |

Automated accessibility checks catch only a subset of accessibility problems; manual keyboard and assistive-technology checks remain required.[cite:167][cite:170] Code coverage is a quality indicator and gate, not a substitute for requirement-level tests.[cite:177]

## 8. Entry criteria

Formal release verification shall not begin until:

- All intended Must requirements have implementation status `complete`.
- The repository contains no unapproved placeholder implementation in production paths.
- Migrations apply successfully to an empty local database.
- Unit and database smoke tests pass.
- The traceability checker reports no missing or duplicate IDs.
- The candidate version and Git commit are frozen.
- No known severity-1 anomaly is open.

If an entry criterion fails, the run status shall be `Blocked`, not `Failed` or `Passed`.

## 9. Exit criteria

Release verification passes only when:

- 100% of Must requirements have passing evidence.
- `npm run verify` passes from a clean checkout.
- All required browser workflows pass in Chromium, Firefox, and WebKit.
- All database security and transaction tests pass.
- Required accessibility automation and manual activities pass.
- Coverage and performance thresholds pass.
- No severity-1 or severity-2 anomaly remains open.
- All waivers are approved, bounded, and listed.
- The production artifact checksum matches the verified artifact.
- The completed verification report is approved by the release authority.

## 10. Canonical fixtures

### 10.1 CSV fixtures

| Fixture ID | Content | Expected purpose |
|---|---|---|
| CSV-001 | Empty file | Reject with file-level error. |
| CSV-002 | Header only | Accept preview with zero data rows. |
| CSV-003 | 100 valid unique rows | Exact successful import counts. |
| CSV-004 | Reversed exact headers | Column recognition. |
| CSV-005 | Quoted commas and quotes | CSV syntax handling. |
| CSV-006 | Embedded LF and CRLF | Line handling and normalization. |
| CSV-007 | Unicode composed/decomposed forms | NFC duplicate behavior. |
| CSV-008 | Leading BOM | BOM handling. |
| CSV-009 | Blank questions and answers | Row rejection. |
| CSV-010 | Malformed quoting | Structural rejection. |
| CSV-011 | Exact and normalization duplicates | In-file duplicate behavior. |
| CSV-012 | Existing-card duplicates with history | Preservation of prior state. |
| CSV-013 | Case-only content differences | Confirm case preservation. |
| CSV-014 | 10,000 valid rows | Performance and cardinality. |

### 10.2 Scheduler fixtures

| Fixture ID | State |
|---|---|
| SCHF-001 | Ten unseen cards, no review cards. |
| SCHF-002 | One failed learning card with delay not met. |
| SCHF-003 | One failed learning card with delay and intervening count met. |
| SCHF-004 | Completed cohort and locked next cohort. |
| SCHF-005 | Manageable due pool plus unseen cards. |
| SCHF-006 | Due workload equal to remaining session capacity. |
| SCHF-007 | Due workload greater than remaining capacity. |
| SCHF-008 | Overdue mandatory cards. |
| SCHF-009 | Equal utility tie candidates with fixed seed. |
| SCHF-010 | Exam in seven days with weak and strong candidates. |
| SCHF-011 | Suspended high-utility card. |
| SCHF-012 | Review card that lapses into relearning. |

### 10.3 Security fixtures

- Authenticated User A with one full dataset.
- Authenticated User B with a distinct full dataset.
- Anonymous role.
- Public client key.
- Canary secrets inserted only into controlled test configuration.
- Security-definer RPC calls using owned and foreign record IDs.

### 10.4 Fault fixtures

- Failure after import processing but before commit.
- Failure after review-event insert but before card update.
- Response loss after successful transaction commit.
- Duplicate request with identical operation ID.
- Two concurrent grades for one opportunity.
- Database unavailable during diagnostics.
- Browser refresh before and after grade confirmation.

## 11. Automated verification activities

### 11.1 Build and static activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-ARC-001 | ARC-001–003, DEL-001–003 | Clean checkout; frozen install; typecheck; lint; production build. | All commands exit 0 and required outputs exist. | Command log, build manifest. |
| VA-ARC-002 | ARC-004–006 | Serve production build; inspect manifest/service worker; simulate network loss. | URL works; PWA metadata valid; documented network error appears. | Playwright result, manifest inspection. |
| VA-TST-001 | TST-001–005 | Run setup twice from empty state and run full verification with external network blocked except loopback. | Both schemas match; suite passes; no uncontrolled service required. | Schema checksums, CI log. |
| VA-COV-001 | TST-012–014 | Run instrumented unit/integration suite. | Module and overall thresholds meet specification. | Coverage JSON and HTML. |

### 11.2 Authentication activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-AUT-001 | AUT-001–005 | Use local auth test path to request sign-in, establish session, refresh, and sign out. | Each state transition matches requirements and private views reject signed-out state. | API and Playwright reports. |
| VA-AUT-002 | AUT-006 | Commit data in Browser A; authenticate same user in Browser B; reload. | Browser B displays committed deck and state. | Cross-context Playwright trace. |
| VA-AUT-003 | AUT-007–009 | Exercise account registration with minimum 6-character password, password authentication, and 6-digit email OTP verification. | New account registers, password authentication establishes valid session, and 6-digit OTP code establishes valid session. | Component unit tests and Playwright reports. |

### 11.3 Deck and data activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-DEK-001 | DEK-001–009 | Exercise valid, boundary, invalid, archive, restore, delete, and settings-change cases. | UI and database values match requirements; history unchanged by settings. | E2E and database assertions. |
| VA-DAT-001 | DAT-001–015 | Inspect schema and run pgTAP constraints, foreign-key, append-only, and migration-reset tests. | Every assertion passes; schema drift absent. | pgTAP output, schema diff. |
| VA-DAT-002 | DAT-012–014 | Evaluate derived values at zero, ordinary, and large counts; query selection while monitoring writes. | Formulas match and untouched rows remain unchanged. | Unit and database log. |

### 11.4 Import activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-IMP-001 | IMP-001–008, IMP-017 | Preview CSV-001 through CSV-011, delimiter variations (semicolon, tab, pipe), and mapping variants. | Counts, delimiter detection, first 20 rows, mapping, and rejection reasons match fixture expectations. | Unit/E2E reports and snapshots. |
| VA-IMP-002 | IMP-009–015 | Commit CSV-003, CSV-011, CSV-012, and Unicode fixtures. | Exact insert/skip/reject counts; existing state byte-equivalent; timestamps in transaction bounds. | Database snapshots and report. |
| VA-IMP-003 | IMP-013, IMP-016, REL-001 | Inject precommit failure and response loss; retry same operation ID. | Rollback leaves no partial commit; committed retry produces one logical operation. | Fault-injection log. |
| VA-IMP-004 | IMP normalization basis | Run canonical pairs through normalization and SHA-256 vector tests. | Exact normalized strings and hashes equal checked-in golden values. | Golden-vector output. |

### 11.5 Management activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-MGT-001 | MGT-001–008, MGT-010 | Search, create manual card with concatenation to end, edit unique content, attempt duplicate edit, suspend, restore. | Required fields and behaviors match; history preserved; suspended card excluded; manual card concatenated to end with incremented source order. | E2E trace, component tests, and database assertions. |
| VA-MGT-002 | MGT-009 | Export a canonical deck and parse it as UTF-8 CSV. | Content and row count match documented export contract. | Export artifact comparison. |

### 11.6 Study and session activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-UI-001 | UI-001–010 | Execute question, reveal, both grades, pending state, induced failure, undo, and refresh cases. | Visible states and database side effects exactly match requirements. | Cross-browser Playwright reports. |
| VA-UI-002 | UI-011–016 | Complete session using keyboard only; pause controlled clock; resume and inspect counters. | Shortcuts, focus, timing exclusion, and displayed metrics pass. | E2E report and manual checklist. |
| VA-SES-001 | SES-001–010 | Test duration boundaries, normal expiry, early end, ungraded exit, summary, and timing estimate. | Every boundary and aggregate equals expected value. | Unit, E2E, database output. |

### 11.7 Scheduler conformance activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-SCH-001 | SCH-001–009 | Inspect pinned version; run published/reference FSRS vectors and binary grade mappings using fixed clock. | Exact states and enum outputs match; numeric values meet documented tolerance. | Manifest and vector report. |
| VA-SCH-002 | SCH-010–022 | Execute cohort fixtures and boundary tests for size, failures, retries, criterion, transition, and session counts. | Every expected state and eligibility result matches. | Unit/database report. |
| VA-SCH-003 | SCH-023–028 | Execute 900-second session fixtures with fractions and workload values below, equal to, and above boundaries. | Allocation and suppression match exact boundary requirements. | Unit report. |
| VA-SCH-004 | SCH-029–040 | Execute candidate queue, overdue, tie, deterministic, explanation, and no-write tests. | Selected IDs and reason codes match golden scenarios; untouched cards unchanged. | Golden outputs and query log. |
| VA-SCH-005 | TST-010–011 | Generate at least 10,000 valid histories using a recorded seed. | All invariants pass; failing seed would be retained and minimized. | Property-test report. |
| VA-SCH-006 | Utility formula | Independently calculate `R_now`, `P0`, `Pg`, `Pa`, expected gain, and utility for golden vectors. | Application output matches independent calculation within `1e-9` absolute tolerance unless the pinned library documents a larger necessary tolerance. | Analysis worksheet/JSON. |

### 11.8 Review transaction activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-REV-001 | REV-001–009 | Reveal and grade canonical cards; inject failure between event and state update. | Timestamps and exact deltas match; failure commits neither operation. | pgTAP and integration report. |
| VA-REV-002 | REV-004, REV-010, REL-001 | Repeat operation IDs and submit synchronized conflicting grades. | One review event and one counter change; conflict response documented. | Concurrency log. |
| VA-REV-003 | REV-011–013 | Grade, undo, inspect event invalidation, then attempt late undo. | State restoration and rejection behavior match requirements. | Database diff and E2E trace. |
| VA-REV-004 | REV-014 | Submit grades with varying latency. | Latency stored; identical explicit grades produce rating mapping independent of latency. | Unit/database assertions. |

### 11.9 Security activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-SEC-001 | SEC-001–003 | As User A and anonymous, attempt select/insert/update/delete against User B's records through public API. | Every foreign/anonymous operation is denied or reveals zero records without existence leakage. | pgTAP/API report. |
| VA-SEC-002 | SEC-004 | Scan source, Git history under verification, logs, and production static assets for canary and configured secret patterns. | No privileged secret appears. | Secret-scan report. |
| VA-SEC-003 | SEC-005–006 | Inspect grants and functions; call each RPC with owned and foreign IDs and altered search path. | Minimum role only; foreign access denied; no search-path exploitation. | Inspection checklist and pgTAP output. |
| VA-SEC-004 | SEC-007–009 | Inspect environment separation and attempt destructive test with production ID canary. | Test aborts before mutation; diagnostic artifacts contain no seeded personal canaries. | Configuration and automated output. |

### 11.10 Accessibility and compatibility activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-ACC-001 | ACC-001, UI workflows | Run release-blocking workflows in Chromium, Firefox, and WebKit. | All workflows pass in all engines. | Browser matrix report. |
| VA-ACC-002 | ACC-002–006 | Run axe-core on named views and complete keyboard-only manual procedure. | Zero included A/AA violations; all controls reachable, named, focused, and escapable. | Axe JSON, signed checklist. |
| VA-ACC-003 | ACC-005 | Trigger import, authentication, network, and grade errors with screen reader active. | Errors are announced and focus moves or remains according to documented behavior. | Signed screen-reader checklist and recording. |
| VA-ACC-004 | ACC-007 | Set 1280×720 viewport and 200% zoom; exercise named workflows. | No required text/control is inaccessible and no required horizontal page scrolling prevents use. | Screenshots and checklist. |
| VA-ACC-005 | ACC-008 | Test responsive viewports on mobile phone (390×844 / 360×740) and tablet (768×1024 / 820×1180) across sign-in, deck list, and study views; verify touch targets ≥ 44×44px and no horizontal clipping. | All primary views fit viewport without horizontal overflow; touch targets meet minimum dimensions; complete workflows operable on touch interfaces. | Automated Playwright mobile tests and report. |

### 11.11 Performance and reliability activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-PRF-001 | PRF-001 | Seed 10,000 cards and 100,000 events; warm up; execute at least 1,000 selections. | 95th percentile at or below 500 ms. | Raw CSV/JSON and analysis. |
| VA-PRF-002 | PRF-002 | Preview and commit CSV-014 five times in reset environments. | Every preview and commit at or below 30 s with exact counts. | Raw timings and database counts. |
| VA-PRF-003 | PRF-003 | Load authenticated question view under reference network for at least 100 trials. | 95th percentile interactive time at or below 3 s. | Browser performance data. |
| VA-REL-001 | REL-001–004 | Execute timeout, refresh-before, refresh-after, and database-failure fixtures. | No duplicate or phantom operation; committed state restored; errors recoverable. | Integration/E2E results. |
| VA-REL-002 | REL-005–006 | Export canonical account; inspect JSON; restore through harness in empty environment. | Required entities and versions present; restored defined fields equivalent. | Export and comparison report. |

### 11.12 Diagnostics and CI activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-DIA-001 | DIA-001–005 | Run diagnostics healthy and with database unavailable; inspect downloadable report. | Component statuses correct; no mutation; required metadata present; private canaries absent. | E2E trace and report sample. |
| VA-DIA-002 | DIA-006 | Induce a server error and compare client and server records. | Same correlation ID appears in sanitized records. | Paired logs. |
| VA-CIC-001 | CIC-001–005 | Run CI with passing and deliberately failing temporary branch changes. | Lockfile enforced; failures block; artifacts retained; timeout configured. | CI URLs/IDs and artifact manifest. |
| VA-CIC-002 | CIC-006–008 | Attempt deployment from failed and passed commits. | Failed commit cannot deploy; passed exact SHA deploys; report generated. | Deployment provenance. |
| VA-TRC-001 | TST-016–018 | Run traceability checker normally and with injected missing, duplicate, and orphan IDs. | Normal matrix passes; each injected defect fails with location. | Checker output. |

### 11.13 Progress dashboard activities

| Activity ID | Requirements | Procedure | Pass criteria | Evidence |
|---|---|---|---|---|
| VA-PRG-001 | PRG-001–004 | Render learning progress dashboard with test decks and verify segmented mastery breakdown bar, true recall accuracy %, study streak & 28-day activity heatmap, and 7-day upcoming due forecast. | Metrics and proportions accurately reflect card counts, session aggregates, review timestamps, and due dates; deck filter switches scope properly. | Component tests and Playwright reports. |
| VA-PRG-002 | PRG-005–006 | Verify exam readiness and target pace tracking for decks with and without exam dates; verify trouble spots list ranking by lapses and incorrect attempts, answer toggle, and practice actions. | Exam days remaining, daily pace calculation, and readiness progress bar accurately reflect status; trouble spots list top 5 lapsed cards with working collapsible answer reveal and practice button. | Component unit tests and snapshots. |

## 12. Manual verification procedures

### 12.1 Keyboard procedure MAN-ACC-001

1. Begin signed out.
2. Navigate sign-in using `Tab`, `Shift+Tab`, `Enter`, and text input only.
3. Open a deck and import CSV-003 without a pointer.
4. Start a five-minute session.
5. Reveal with keyboard, grade once with `1`, once with `2`, pause, resume, and end early.
6. Open card management, search, edit, suspend, restore, and sign out.
7. Record any unreachable control, missing focus indicator, illogical order, or keyboard trap.

**Pass:** Every action succeeds, focus remains visible, and no trap occurs.

### 12.2 Screen-reader procedure MAN-ACC-002

Use one documented screen-reader/browser pairing supported by the verification environment.

1. Read headings, regions, controls, and status on sign-in and deck views.
2. Trigger invalid CSV, authentication, offline, and grade errors.
3. Run one study card through reveal and both grade-state announcements.
4. Run diagnostics and inspect component statuses.

**Pass:** Controls have meaningful names and states; question, answer, errors, pending state, and status changes are announced without exposing hidden answer content before reveal.

### 12.3 PWA procedure MAN-PWA-001

1. Open the production build in a browser supporting PWA installation.
2. Confirm installability and install.
3. Launch from the installed icon.
4. Sign in and complete one study card.
5. Repeat ordinary browser use in a browser without desktop installation support.

**Pass:** Installed launch uses standalone presentation where supported; ordinary URL operation remains available elsewhere.[cite:9][cite:15]

### 12.4 Exploratory procedure MAN-EXP-001

Perform 30 minutes of exploratory use covering rapid clicking, browser back/forward, multiple tabs, long Unicode text, very narrow and wide windows, session expiration, and network interruption. Record observations as anomalies; exploratory success does not replace scripted acceptance evidence.

## 13. Traceability requirements

The machine-readable requirements traceability matrix shall contain:

| Field | Description |
|---|---|
| `requirement_id` | FCA-SRS requirement identifier. |
| `priority` | Must or Should. |
| `verification_methods` | T, I, A, D. |
| `activity_ids` | One or more activities in this plan. |
| `automated_test_ids` | Test names or stable IDs. |
| `evidence_paths` | CI artifact or repository-relative evidence location. |
| `result` | Pass, Fail, Blocked, Waived, or Not Run. |
| `anomaly_ids` | Linked anomalies, if any. |
| `reviewer` | Required for manual evidence or waiver. |

The checker shall enforce unique requirement and test identifiers, valid references in both directions, and complete coverage of every Must requirement.

## 14. Anomaly management

### 14.1 Severity

| Severity | Definition | Release effect |
|---|---|---|
| 1 — Critical | Data loss/corruption, cross-user disclosure, secret exposure, inability to authenticate or study, or unrecoverable production failure. | Release prohibited. |
| 2 — Major | Must requirement failure without safe workaround, incorrect scheduling state, duplicate grades/imports, or major accessibility failure. | Release prohibited. |
| 3 — Moderate | Limited functional defect with safe workaround and no data/security risk. | Requires approved disposition. |
| 4 — Minor | Cosmetic, documentation, or low-impact issue not preventing required operation. | May release with recorded disposition. |

### 14.2 Anomaly record

Each anomaly shall contain ID, discovery activity, environment, commit, requirement IDs, reproduction steps, expected result, actual result, severity, evidence, root cause when known, corrective commit, retest result, and disposition.

### 14.3 Retest

A corrective change shall rerun:

- The failed activity.
- Tests for directly affected requirements.
- Appropriate regression suites.
- The full release-blocking suite before release.

## 15. Waivers and deviations

A waiver shall not change a test result to Pass. It shall record:

- Requirement and activity IDs.
- Exact unmet criterion.
- Technical reason.
- User and operational effect.
- Security, privacy, data-integrity, and learning impact.
- Workaround.
- Residual risk.
- Approver.
- Expiration date or corrective release milestone.

No severity-1 or severity-2 issue may be waived for production release under this baseline.

## 16. Verification report activities

After execution, Antigravity shall perform these report-generation activities:

### VR-001 — Freeze provenance

Collect and verify the candidate commit, release version, lockfile checksum, migration list, algorithm versions, parameter version, test-fixture checksum, CI run identifiers, deployment artifact checksum, and staging deployment identifier.

### VR-002 — Import machine results

Import static, unit, property, database, integration, browser, accessibility, coverage, performance, security, and traceability results. Preserve original files and calculate counts without manually retyping them.

### VR-003 — Attach manual evidence

Attach signed keyboard, screen-reader, PWA, and exploratory checklists with operator, date, environment, outcomes, and evidence links.

### VR-004 — Resolve traceability

For each requirement, resolve its result from all assigned methods. If any assigned activity fails, is blocked, or is not run, the requirement shall not be reported as Passed.

### VR-005 — Summarize anomalies

List all anomalies and verify their severity, affected requirements, status, corrective commit, retest, and disposition.

### VR-006 — Evaluate entry and exit criteria

Record every criterion as Pass, Fail, or Not Applicable with evidence. Any unmet release exit criterion shall make the report recommendation `Do Not Release`.

### VR-007 — Verify artifact identity

Confirm that the production candidate artifact and migrations correspond to the exact successfully verified commit. A mismatch invalidates the release recommendation.

### VR-008 — Generate report

Generate both human-readable Markdown and machine-readable JSON reports. The JSON report shall be suitable for automated release gating.

### VR-009 — Independent review

A named reviewer shall inspect failures, waivers, manual evidence, security results, accessibility results, performance calculations, and requirement-coverage totals.

### VR-010 — Approval

The release authority shall record `Approved`, `Approved with listed deviations`, or `Rejected`. Approval shall not override prohibited open anomaly severities.

## 17. Verification report template

The generated report shall contain the following sections.

### 17.1 Document control

- Report ID and version.
- Applicable FCA-SRS and FCA-VVP versions.
- Candidate application version and commit SHA.
- Execution start and finish timestamps.
- Authors, verification executor, reviewer, and release authority.

### 17.2 Executive result

| Field | Required value |
|---|---|
| Overall result | Pass, Fail, or Blocked |
| Release recommendation | Release or Do Not Release |
| Must requirements | Total, passed, failed, blocked, waived, not run |
| Automated tests | Total, passed, failed, skipped |
| Manual activities | Total, passed, failed, not run |
| Open anomalies | Count by severity |
| Approved waivers | Count |

### 17.3 Configuration identification

List all controlled configuration fields from Section 5 and their checksums or versions.

### 17.4 Environment record

List local, CI, staging, browser, database, and performance environment details.

### 17.5 Entry and exit criteria

Provide one row per criterion with result and evidence link.

### 17.6 Requirement compliance matrix

| Requirement | Priority | Methods | Activity IDs | Result | Evidence | Anomalies/Waiver |
|---|---|---|---|---|---|---|

Every Must requirement shall appear exactly once.

### 17.7 Test-suite results

For each suite, report tool and version, start/end time, duration, total, pass, fail, skip, retry, and artifact paths. A retried pass shall disclose the initial failure and shall not conceal flakiness.

### 17.8 Coverage results

Report overall statement and branch coverage plus separate values for scheduling, normalization, duplicate handling, and review transactions. Include thresholds and raw report path.

### 17.9 Performance results

Report raw sample count, warm-up, minimum, median, 95th percentile, 99th percentile, maximum, threshold, environment, and pass/fail for each performance requirement. Do not report only averages.

### 17.10 Security results

Report RLS operation matrix, anonymous-access results, RPC grant inspection, security-definer checks, secret scan, dependency findings, environment-isolation check, and unresolved security anomalies.

### 17.11 Accessibility results

Report automated axe results by view and browser, keyboard checklist, screen-reader pairing and checklist, zoom results, and unresolved accessibility anomalies.

### 17.12 Recovery results

Report transaction rollback, retry after lost response, duplicate operation, concurrent grade, refresh-before, refresh-after, and database-unavailable cases.

### 17.13 Anomalies

Provide all anomaly fields defined in Section 14, including closed anomalies discovered during the release cycle.

### 17.14 Deviations and waivers

List every approved departure and its residual risk. If none, state `None`.

### 17.15 Residual risks and limitations

At minimum, restate that:

- Grades are self-reported after answer reveal.
- FSRS and the custom utility policy estimate memory and do not guarantee learning outcomes.
- Default cohort and time-allocation settings are engineering defaults.
- Version 1 requires connectivity for study operations.
- Automated accessibility testing is incomplete without manual evidence.

### 17.16 Approval

| Role | Name | Decision | Timestamp | Signature or recorded approval |
|---|---|---|---|---|

## 18. Machine-readable report

The JSON report shall include at least:

```json
{
  "reportVersion": "1.0",
  "specificationVersion": "1.0",
  "commitSha": "...",
  "applicationVersion": "...",
  "overallResult": "pass|fail|blocked",
  "releaseRecommendation": "release|do-not-release",
  "configuration": {},
  "environments": [],
  "requirements": [],
  "testSuites": [],
  "coverage": {},
  "performance": [],
  "security": [],
  "accessibility": [],
  "anomalies": [],
  "waivers": [],
  "artifacts": [],
  "approvals": []
}
```

The report generator shall validate this output against a version-controlled JSON Schema. Schema failure shall fail the release-verification workflow.

## 19. Required evidence retention

For each candidate release, retain:

- Human-readable and JSON verification reports.
- Requirement matrix.
- Raw test and coverage results.
- Playwright traces and failure screenshots.
- Database test output and schema drift result.
- Performance raw data and calculations.
- Accessibility automated and manual evidence.
- Security scan and RLS/RPC test results.
- Build manifest and artifact checksum.
- Anomaly and waiver records.

Evidence shall be linked to the commit and CI run. Diagnostic or verification artifacts shall not contain user personal data or production secrets.

## 20. Final release rule

The release-verification workflow shall return a nonzero status and the report shall recommend `Do Not Release` if any of the following is true:

- A Must requirement is Failed, Blocked, Not Run, or unapproved Waived.
- A required test suite fails or does not run.
- Coverage, performance, security, accessibility, or compatibility gates fail.
- A severity-1 or severity-2 anomaly is open.
- Traceability is incomplete.
- The candidate artifact does not match the verified commit.
- Required approval is absent.

**Confidence: High** that this plan provides objective, reproducible requirement verification and an auditable release decision. **Confidence: Medium** in the initial numeric performance and coverage gates because final suitability depends on the chosen hosting tier and observed application structure; any revision shall occur through a controlled specification change, not an ad hoc test exception.
