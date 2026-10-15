# Adaptive Flashcard Application — Software Requirements Specification

**Document ID:** FCA-SRS-001  
**Version:** 1.0  
**Status:** Implementation baseline  
**Intended executor:** Google Antigravity  
**Companion document:** `flashcard-verification.md`

## 1. Execution directive

Google Antigravity shall implement the application described in this specification and shall treat every requirement marked **Must** as release-blocking. It shall implement each requirement together with its associated tests, execute the complete verification suite, and produce the verification evidence required by the companion document.

Antigravity shall not silently reinterpret, omit, weaken, or replace a requirement. If a requirement is technically contradictory or cannot be implemented as written, Antigravity shall stop, identify the requirement ID, explain the conflict, and propose a measurable change for approval before continuing.

## 2. Product objective

The product is a text-only, cloud-synchronized flashcard application for one or more authenticated users. It imports two-column question-and-answer CSV files, preserves existing study history when duplicates are imported, presents one card at a time, records binary self-grades, and selects subsequent cards to maximize expected retention per unit of study time.

The learning design combines retrieval practice, corrective feedback, spacing, and successive relearning. These methods have broad empirical support, although their effects vary by material, learner, and study context.[cite:39][cite:51][cite:140][cite:148] The scheduler shall therefore be adaptive and measurable rather than presented as a guaranteed universal optimum.

## 3. Scope

### 3.1 Included

- Browser access from ordinary desktop and laptop computers.
- Optional Progressive Web App installation where the browser supports it.
- Email-based authentication and cloud synchronization.
- Deck creation and management.
- UTF-8 CSV import, validation, preview, duplicate prevention, and reporting.
- Text-only question and answer presentation.
- Binary self-grading.
- Configurable timed study sessions.
- Controlled introduction of new cards in cohorts.
- FSRS-based memory-state updates and due dates.
- Exam-horizon-aware card prioritization.
- Immutable review history and reversible accidental grades.
- User-owned data export.
- Automated tests, local self-test capability, runtime diagnostics, CI, and release verification evidence.

### 3.2 Excluded from version 1

- Images, audio, video, mathematical rendering beyond ordinary text, handwriting, and OCR.
- Automatic judging of free-text answers.
- Shared or collaborative decks.
- Public deck marketplace.
- Native iOS, Android, macOS, or Windows packages.
- Guaranteed offline study and conflict reconciliation.
- AI-generated cards or answers.
- Claims that use of the application guarantees examination success.

## 4. Definitions

| Term | Definition |
|---|---|
| Card | One question-and-answer pair plus its current learning state. |
| Deck | A user-owned collection of cards with common settings. |
| Review event | An immutable record of one revealed and graded retrieval attempt. |
| New card | A card with no valid review event. |
| Learning card | A new card in the active cohort that has not met the current session criterion. |
| Review card | A card managed by the long-term spaced-repetition model. |
| Relearning card | A previously reviewed card that was graded incorrect and is awaiting short-delay retry. |
| Cohort | The limited set of unseen cards currently eligible for first learning. |
| Due card | A review card whose `next_due_at` is at or before the selection timestamp. |
| Retrievability | The scheduler's estimated probability of successful recall at a specified time. |
| Stability | The scheduler's estimate of memory durability, expressed in days. |
| Difficulty | The scheduler's estimate of the inherent difficulty of a card for a learner. |
| Exam horizon | The deck's exam date or, when absent, the long-term retention date used for prioritization. |
| Valid interaction time | Question-to-grade time excluding paused periods and events flagged as interrupted. |
| Must | Release-blocking requirement. |
| Should | Desired requirement that may be deferred only through an approved waiver. |

## 5. Design basis

Retrieval practice generally improves delayed retention compared with passive restudy, and corrective feedback is important when retrieval fails.[cite:52][cite:57][cite:140] Spacing retrieval events is more effective than massing them, but evidence does not support one fixed interval ladder for every context.[cite:51][cite:92] Successive relearning combines criterion-based retrieval with return to the same material across later sessions and directly supports the cohort design used here.[cite:53][cite:54][cite:55]

The selected memory model is the Free Spaced Repetition Scheduler, or FSRS. It maintains difficulty and stability as stored card state and calculates time-varying retrievability; its implementation shall be version-pinned and conformance-tested.[cite:66][cite:71][cite:78] The application adds a time-budgeted session policy around FSRS. The default cohort size of 10 and 30% acquisition-time ceiling are explicit engineering defaults, not claimed cognitive constants.

## 6. System architecture

| Layer | Required selection |
|---|---|
| Client | React single-page application written in strict TypeScript |
| Build | Vite |
| Delivery | Responsive Progressive Web App served over HTTPS |
| Backend | Supabase project using PostgreSQL, Auth, and database RPC functions |
| Authentication | Passwordless email one-time link or one-time code |
| Scheduling library | Maintained TypeScript FSRS implementation, exact version pinned in lockfile |
| Unit and integration tests | Vitest |
| Browser tests | Playwright |
| Database tests | pgTAP through the Supabase CLI |
| Accessibility tests | Playwright plus axe-core |
| CI | GitHub Actions or equivalent commit-addressable CI |

A PWA remains accessible as a normal website even when desktop installation is unavailable; browser installation behavior varies by browser.[cite:9][cite:15] Supabase provides PostgreSQL, authentication, database functions, migrations, a local development stack, and row-level security appropriate to this architecture.[cite:7][cite:13][cite:169][cite:175]

## 7. Requirement conventions

Every mandatory statement below uses **shall**. Requirement IDs are permanent and shall not be reused. Verification methods are defined in the companion document as Test (`T`), Inspection (`I`), Analysis (`A`), and Demonstration (`D`).

## 8. Product requirements

### 8.1 Repository and architecture

| ID | Priority | Requirement |
|---|---|---|
| ARC-001 | Must | The repository shall contain the frontend, Supabase migrations, database tests, application tests, configuration, CI workflow, and operator documentation required to build and verify the product. |
| ARC-002 | Must | The frontend shall be a React application written with TypeScript strict mode enabled. |
| ARC-003 | Must | The application shall produce a static production build through Vite. |
| ARC-004 | Must | The application shall be usable through a browser URL without installing local application software. |
| ARC-005 | Must | The application shall include a valid web app manifest and service worker sufficient for installability where the browser supports PWA installation. |
| ARC-006 | Must | Version 1 study operations shall require an active network connection and shall display a recoverable network-error state when connectivity is unavailable. |
| ARC-007 | Must | The browser shall communicate with Supabase only through the public client key and authenticated user session. |
| ARC-008 | Must | Privileged data mutations shall execute in PostgreSQL transactions exposed through narrowly permissioned RPC functions. |
| ARC-009 | Must | The scheduling domain shall be separated from React components and database transport code. |
| ARC-010 | Must | The scheduling domain shall obtain time and random values only through injectable interfaces. |

### 8.2 Authentication and users

| ID | Priority | Requirement |
|---|---|---|
| AUT-001 | Must | The application shall allow a user to request passwordless sign-in using an email address. |
| AUT-002 | Must | The application shall establish an authenticated session only after successful Supabase Auth verification. |
| AUT-003 | Must | The application shall restore a valid existing session after browser refresh. |
| AUT-004 | Must | The application shall provide an explicit sign-out control. |
| AUT-005 | Must | Signing out shall remove locally held authentication state and return the interface to the sign-in view. |
| AUT-006 | Must | The application shall synchronize the authenticated user's committed data when the same account is used on another supported computer. |
| AUT-007 | Must | The application shall allow a new user to create an account by providing an email address and a password of at least 6 characters. |
| AUT-008 | Must | The application shall allow a user to authenticate directly using an email address and password. |
| AUT-009 | Must | The application shall allow a user to verify an email sign-in using a 6-digit one-time code sent to their email address. |

### 8.3 Deck configuration

| ID | Priority | Requirement |
|---|---|---|
| DEK-001 | Must | The user shall be able to create, rename, archive, restore, and delete a deck. |
| DEK-002 | Must | Permanent deck deletion shall require an explicit confirmation naming the deck. |
| DEK-003 | Must | Each deck shall store an optional exam date. |
| DEK-004 | Must | Each deck shall store a desired-retention value from 0.70 through 0.97 inclusive with a default of 0.90. |
| DEK-005 | Must | Each deck shall store a new-card cohort size from 5 through 20 inclusive with a default of 10. |
| DEK-006 | Must | Each deck shall store a new-learning time fraction from 0.00 through 0.50 inclusive with a default of 0.30. |
| DEK-007 | Must | Each deck shall store a minimum failed-card retry delay with a default of 60 seconds. |
| DEK-008 | Must | Each deck shall store a minimum intervening-card count with a default of 3. |
| DEK-009 | Must | A settings change shall affect future selections and shall not rewrite historical review events. |

### 8.4 Data model

#### 8.4.1 Required entities

The database shall contain the following user-owned entities. Supabase Auth owns the authentication identity.

| Entity | Required purpose |
|---|---|
| `profiles` | User-level defaults and creation timestamps. |
| `decks` | Deck identity, status, exam horizon, and scheduler settings. |
| `import_batches` | File-level import audit and counts. |
| `cards` | Text content, duplicate key, aggregate counters, and current memory state. |
| `study_sessions` | Session target, timestamps, status, and aggregates. |
| `session_card_state` | Session-specific criterion, failure, and intervening-card state. |
| `review_events` | Immutable pre-state, grade, timing, and post-state for each attempt. |
| `selection_events` | Reproducibility record for each next-card selection. |
| `grade_operations` | Idempotency and concurrency control for grade submission. |

#### 8.4.2 Card fields

| Group | Required fields |
|---|---|
| Identity | `id`, `user_id`, `deck_id`, `import_batch_id`, `source_row_number` |
| Content | `question_text`, `answer_text`, `normalized_question`, `normalized_answer`, `content_hash` |
| Lifecycle | `first_imported_at`, `created_at`, `updated_at`, `suspended_at`, `archived_at` |
| Cohort | `cohort_number`, `source_order`, `importance_weight` |
| Memory | `learning_state`, `difficulty`, `stability_days`, `last_review_at`, `next_due_at`, `last_rating`, `algorithm_version` |
| Aggregates | `review_count`, `correct_count`, `incorrect_count`, `lapse_count`, `last_correct_at`, `last_incorrect_at`, `successful_relearning_sessions` |

#### 8.4.3 Data requirements

| ID | Priority | Requirement |
|---|---|---|
| DAT-001 | Must | Every user-owned table shall contain a `user_id` linked to the authenticated owner. |
| DAT-002 | Must | Every entity identifier shall use a UUID generated by the database or an approved cryptographically random UUID implementation. |
| DAT-003 | Must | Database timestamps shall be stored as timezone-aware UTC values. |
| DAT-004 | Must | `cards.learning_state` shall be limited to `new`, `learning`, `review`, `relearning`, and `suspended`. |
| DAT-005 | Must | Correct, incorrect, review, and lapse counters shall be nonnegative integers. |
| DAT-006 | Must | The database shall enforce `correct_count + incorrect_count = review_count` for active valid grades. |
| DAT-007 | Must | `importance_weight` shall be greater than zero and shall default to 1.0. |
| DAT-008 | Must | A unique constraint shall prevent two active cards with the same `(user_id, deck_id, content_hash)`. |
| DAT-009 | Must | A review event shall store card, deck, user, session, operation, shown, revealed, rated, result, timing, pre-state, post-state, algorithm version, and invalidation fields. |
| DAT-010 | Must | Committed review events shall be append-only except for auditable invalidation fields used by undo. |
| DAT-011 | Must | The database shall prevent deletion of a card that would orphan a review event. |
| DAT-012 | Must | Percentage correct shall be derived as zero when `review_count` is zero and otherwise as `correct_count / review_count × 100`. |
| DAT-013 | Must | Percentage correct shall not be stored as an independently mutable card field. |
| DAT-014 | Must | Time-dependent retrievability, elapsed time, overdue ratio, predicted horizon recall, and priority score shall be calculated when needed rather than mass-updated after each grade. |
| DAT-015 | Must | Every schema, function, constraint, index, trigger, and row-security policy shall be reproducible from version-controlled migrations. |

### 8.5 CSV import

#### 8.5.1 Canonical normalization

For duplicate detection, both question and answer shall independently undergo this exact pipeline:

1. Decode as valid UTF-8 and reject invalid encoding.
2. Remove one leading Unicode byte-order mark from the first field when present.
3. Convert CRLF and CR line endings to LF.
4. Normalize Unicode to NFC.
5. Convert each run of spaces or tabs to one ASCII space while preserving LF characters.
6. Remove whitespace at the start and end of the complete field and on each side of each LF.
7. Preserve letter case and punctuation.

The content hash shall be SHA-256 over the UTF-8 bytes of `normalized_question`, one ASCII unit-separator byte, and `normalized_answer`. Case is intentionally preserved to avoid silently merging potentially distinct technical content.

| ID | Priority | Requirement |
|---|---|---|
| IMP-001 | Must | The import view shall accept a local `.csv` file encoded as UTF-8. |
| IMP-002 | Must | The importer shall accept the exact header names `question` and `answer` in either column order. |
| IMP-003 | Must | When exact headers are absent, the importer shall require the user to map exactly one source column to question and one different source column to answer. |
| IMP-004 | Must | The importer shall correctly parse quoted delimiters, escaped quotes, and embedded line breaks that comply with RFC 4180-style CSV syntax. |
| IMP-005 | Must | A row with a blank normalized question or blank normalized answer shall be rejected. |
| IMP-006 | Must | A structurally malformed row shall be rejected and reported with its source row number and reason. |
| IMP-007 | Must | Before commit, the application shall display a preview containing total, insert, duplicate, and rejected-row counts plus the first 20 parsed rows. |
| IMP-008 | Must | The preview and commit operations shall use the same normalization, validation, and duplicate rules. |
| IMP-009 | Must | The commit operation shall insert every valid unique pair not already present in the target deck. |
| IMP-010 | Must | The commit operation shall skip a pair whose content hash already exists in the target deck. |
| IMP-011 | Must | Skipping a duplicate shall not modify any field or review event belonging to the existing card. |
| IMP-012 | Must | Duplicate pairs within one uploaded file shall create one card and shall be counted as skipped duplicates thereafter. |
| IMP-013 | Must | One import shall commit atomically so that an unhandled failure commits neither cards nor a completed import summary. |
| IMP-014 | Must | Each newly inserted card shall receive the server-side import timestamp and the import batch identifier. |
| IMP-015 | Must | The import result shall report inserted, skipped-duplicate, and rejected counts and shall allow download of rejected rows with reasons. |
| IMP-016 | Must | Repeating an import commit with the same client operation ID shall not create additional cards or import batches. |
| IMP-017 | Must | The importer shall support custom delimiters (comma, semicolon, tab, pipe) and shall automatically detect semicolon-delimited CSV files generated in regional spreadsheet locales. |

### 8.6 Card management

| ID | Priority | Requirement |
|---|---|---|
| MGT-001 | Must | The user shall be able to search cards by question or answer text within a deck. |
| MGT-002 | Must | The card-management view shall display question, answer, state, first import date, review count, correct count, incorrect count, percent correct, and next due date. |
| MGT-003 | Must | The user shall be able to edit question and answer text. |
| MGT-004 | Must | Saving edited content shall rerun normalization and duplicate validation before commit. |
| MGT-005 | Must | An edit that would duplicate another active card in the deck shall be rejected without changing either card. |
| MGT-006 | Must | Editing content shall preserve the card's identifier, review history, counters, and memory state. |
| MGT-007 | Must | The user shall be able to suspend and restore a card. |
| MGT-008 | Must | A suspended card shall not be selected for study. |
| MGT-009 | Should | The user shall be able to export a deck's question and answer content as UTF-8 CSV. |

### 8.7 Study interface

The study interaction shall use one in-page card or modal state, not separate browser popup windows.

| ID | Priority | Requirement |
|---|---|---|
| UI-001 | Must | The study view shall initially display one question without displaying its answer. |
| UI-002 | Must | The question state shall provide a `Give me the answer` control. |
| UI-003 | Must | Activating the reveal control shall display the answer while retaining the question. |
| UI-004 | Must | The answer state shall provide exactly two primary grading controls labeled `I got it!` and `Dang, I missed it!`. |
| UI-005 | Must | `I got it!` shall mean the answer was substantially recalled before reveal. |
| UI-006 | Must | `Dang, I missed it!` shall mean the answer was absent, materially wrong, or recognized only after reveal. |
| UI-007 | Must | The answer state shall provide an `Undo last grade` control after a grade commits and before another grade commits. |
| UI-008 | Must | The interface shall disable grading controls while a grade request is pending. |
| UI-009 | Must | The interface shall display a recoverable error and retry option when a grade request fails without confirmation. |
| UI-010 | Must | Refreshing before grading shall not create a review event or modify counters. |
| UI-011 | Must | The complete study workflow shall be operable with keyboard controls documented in the interface. |
| UI-012 | Must | `Space` or `Enter` shall reveal the answer when keyboard focus is not on another actionable control. |
| UI-013 | Must | The `1` key shall submit `I got it!` and the `2` key shall submit `Dang, I missed it!` only while the answer state is active. |
| UI-014 | Must | The study view shall provide pause and resume controls. |
| UI-015 | Must | Paused time shall not count toward valid interaction time or session allocation. |
| UI-016 | Must | The study view shall display time remaining, completed reviews, new cards introduced, and due cards remaining. |

### 8.8 Sessions

| ID | Priority | Requirement |
|---|---|---|
| SES-001 | Must | Before study starts, the user shall select a positive session duration. |
| SES-002 | Must | The session-duration view shall offer 5, 10, 15, 20, and 30 minute presets plus a custom whole-minute value from 1 through 240. |
| SES-003 | Must | Starting a session shall create a `study_sessions` record containing its settings snapshot and start timestamp. |
| SES-004 | Must | The session shall stop offering new questions when its target time expires. |
| SES-005 | Must | At target-time expiration, the application shall allow the user to finish a currently displayed card. |
| SES-006 | Must | The user shall be able to end a session early. |
| SES-007 | Must | Ending a session shall preserve every committed grade and shall create no grade for an ungraded displayed card. |
| SES-008 | Must | The session summary shall display elapsed active time, cards reviewed, correct count, incorrect count, new cards introduced, and due cards completed. |
| SES-009 | Must | Valid review-duration estimates shall exclude paused intervals and events explicitly flagged as interrupted. |
| SES-010 | Must | The application shall maintain an exponentially weighted estimate of seconds per review using valid events. |

## 9. Learning and selection engine

### 9.1 Memory model

| ID | Priority | Requirement |
|---|---|---|
| SCH-001 | Must | The application shall use a maintained TypeScript FSRS implementation whose exact package version is pinned in the lockfile. |
| SCH-002 | Must | The repository shall record the FSRS package version, parameter-set version, and application scheduling-policy version. |
| SCH-003 | Must | `I got it!` shall map to FSRS `Good`. |
| SCH-004 | Must | `Dang, I missed it!` shall map to FSRS `Again`. |
| SCH-005 | Must | The engine shall use the deck's desired-retention setting when obtaining a subsequent interval from FSRS. |
| SCH-006 | Must | The engine shall use the published default parameter set until a supported parameter-fitting process has enough valid user history. |
| SCH-007 | Must | A fitted parameter set shall be versioned and shall not alter historical event records. |
| SCH-008 | Must | Current retrievability shall be calculated from stored card memory state and the selection timestamp. |
| SCH-009 | Must | The engine shall never treat lifetime percent correct as the sole or primary scheduling variable. |

### 9.2 New-card cohorts

| ID | Priority | Requirement |
|---|---|---|
| SCH-010 | Must | New cards shall be assigned deterministic cohort numbers according to `source_order` and the deck's cohort size. |
| SCH-011 | Must | Only one new-card cohort per deck shall be active at a time. |
| SCH-012 | Must | No more than the configured cohort size of unseen cards shall be eligible at once. |
| SCH-013 | Must | A newly displayed card shall enter `learning` state. |
| SCH-014 | Must | A learning card shall meet the current-session criterion after one valid successful retrieval in that session. |
| SCH-015 | Must | A learning card graded incorrect shall remain unresolved until it is subsequently graded correct in that session or the session ends. |
| SCH-016 | Must | A failed learning card shall not be immediately repeated when at least two other eligible cards exist. |
| SCH-017 | Must | A failed learning card shall become retry-eligible only after both the configured time delay and intervening-card count are met, except when fewer than two other cards are eligible. |
| SCH-018 | Must | A cohort shall meet its session criterion only when every cohort card has a valid success and no unresolved failure in that session. |
| SCH-019 | Must | A learning card that meets criterion shall enter `review` state with an FSRS-calculated due date and shall retain all review history. |
| SCH-020 | Must | The next cohort shall remain locked until the active cohort meets criterion and sufficient session time remains for one estimated first exposure per card. |
| SCH-021 | Must | The application shall increment `successful_relearning_sessions` no more than once per card per session in which the card meets criterion. |
| SCH-022 | Must | The interface may label a card `established` only after it has met criterion in at least three distinct sessions, but the label shall not remove it from spaced review. |

### 9.3 Session allocation

| ID | Priority | Requirement |
|---|---|---|
| SCH-023 | Must | A session with eligible unseen cards shall begin with an acquisition phase unless due and relearning workload is estimated to consume the remaining session time. |
| SCH-024 | Must | Cumulative valid interaction time on new and learning cards shall not exceed the deck's new-learning time fraction while an eligible review or relearning card exists. |
| SCH-025 | Must | When the acquisition-time ceiling is reached, the selector shall use the review and relearning pools for the rest of the session except for already-unresolved learning-card retries. |
| SCH-026 | Must | When no new card is eligible, acquisition-phase time shall be made available to review cards. |
| SCH-027 | Must | When due and relearning workload equals or exceeds the remaining estimated capacity, the selector shall introduce no unseen card. |
| SCH-028 | Must | The selector shall not unlock a cohort whose estimated first-exposure time exceeds remaining active session time. |

### 9.4 Candidate generation and utility

For an established candidate at selection time `t` and horizon `H`, the engine shall calculate:

- `R_now`: FSRS retrievability at `t`.
- `P0`: predicted retrievability at `H` with no review at `t`.
- `Pg`: predicted retrievability at `H` after simulating `Good` at `t`.
- `Pa`: predicted retrievability at `H` after simulating `Again` at `t` with corrective feedback.
- `expected_gain = R_now × Pg + (1 - R_now) × Pa - P0`.
- `base_utility = importance_weight × expected_gain / estimated_review_seconds`.

If no exam date exists, `H` shall be the later of the current time plus 365 days or the candidate's next due date. This is a transparent one-step utility approximation, not a claim of globally optimal control; formal work supports adapting review timing to modeled recall and review cost.[cite:72][cite:85][cite:147]

| ID | Priority | Requirement |
|---|---|---|
| SCH-029 | Must | Before each question, the engine shall generate candidates from eligible relearning, mandatory-overdue, due-review, active-cohort, and beneficial early-review pools. |
| SCH-030 | Must | A suspended card shall be excluded from every candidate pool. |
| SCH-031 | Must | The immediately preceding card shall be excluded when at least two other eligible cards exist. |
| SCH-032 | Must | An eligible unresolved relearning card shall take precedence after its anti-echo conditions are met. |
| SCH-033 | Must | A card overdue by more than the greater of seven days or one scheduled interval shall enter the mandatory-overdue pool. |
| SCH-034 | Must | Mandatory-overdue cards shall take precedence over unseen cards. |
| SCH-035 | Must | Candidates within the same non-new queue shall be ordered by descending base utility. |
| SCH-036 | Must | Equal utility values within the configured numeric tolerance shall be resolved using a seeded random tie-breaker. |
| SCH-037 | Must | Identical card state, settings, timestamp, algorithm versions, and random seed shall produce the same selection result. |
| SCH-038 | Must | The selector shall return a machine-readable reason code identifying the queue and rule that selected the card. |
| SCH-039 | Must | Each selection shall append a selection event containing the policy version, timestamp, seed or tie-break value, selected queue, candidate IDs, utility values, and selected card ID. |
| SCH-040 | Must | Candidate selection shall not modify untouched card rows. |

## 10. Review processing

| ID | Priority | Requirement |
|---|---|---|
| REV-001 | Must | Revealing an answer shall record the reveal timestamp without incrementing performance counters. |
| REV-002 | Must | Each displayed review opportunity shall have a client-generated UUID operation ID. |
| REV-003 | Must | A grade operation shall append one review event and update the current card state in one database transaction. |
| REV-004 | Must | Repeating a committed operation ID shall return the previously committed result without applying another grade. |
| REV-005 | Must | A successful grade shall increment `correct_count` and `review_count` by one without changing `incorrect_count`. |
| REV-006 | Must | An incorrect grade shall increment `incorrect_count` and `review_count` by one without changing `correct_count`. |
| REV-007 | Must | An incorrect grade on a card previously in `review` shall increment `lapse_count` and place the card in `relearning`. |
| REV-008 | Must | A grade shall update FSRS difficulty, stability, last review time, last rating, next due time, and algorithm version for the graded card. |
| REV-009 | Must | A grade shall update no other card's stored memory state. |
| REV-010 | Must | Concurrent grade submissions for one review opportunity shall result in exactly one accepted grade. |
| REV-011 | Must | Undo shall atomically restore the card and active aggregates to their pre-grade values. |
| REV-012 | Must | Undo shall retain the original review event with invalidation timestamp, reason, and superseding operation identifier. |
| REV-013 | Must | Undo shall be rejected after another grade has committed in the same session. |
| REV-014 | Must | Response latency shall be recorded for capacity estimation but shall not override the explicit binary grade in version 1. |

## 11. Security and privacy

| ID | Priority | Requirement |
|---|---|---|
| SEC-001 | Must | Row-Level Security shall be enabled on every table exposed through the Supabase data API. |
| SEC-002 | Must | An authenticated user shall be unable to read or mutate another user's data through the public interface. |
| SEC-003 | Must | An unauthenticated client shall be unable to read or mutate private application data. |
| SEC-004 | Must | The service-role key, database password, and other privileged secrets shall not be included in browser code or production static assets. |
| SEC-005 | Must | Database RPC execution grants shall be limited to the minimum roles required by each function. |
| SEC-006 | Must | Security-definer functions shall set a safe explicit `search_path` and shall validate ownership of referenced records. |
| SEC-007 | Must | Production and test environments shall use different project identifiers and credentials. |
| SEC-008 | Must | Destructive automated tests shall refuse to run when configured with the production project identifier. |
| SEC-009 | Must | Diagnostic and verification artifacts shall exclude authentication tokens, email addresses, questions, answers, and review-history content unless explicitly generated as non-personal fixtures. |

RLS provides database-enforced row authorization, but it must be combined with appropriate grants and secured functions.[cite:7][cite:12][cite:13]

## 12. Accessibility and compatibility

| ID | Priority | Requirement |
|---|---|---|
| ACC-001 | Must | The supported browser matrix shall include the CI-pinned current versions of Chromium, Firefox, and WebKit. |
| ACC-002 | Must | Login, import, deck management, session start, question, answer, summary, and diagnostics shall be operable without a pointing device. |
| ACC-003 | Must | Every actionable element shall have an accessible name and visible keyboard focus. |
| ACC-004 | Must | The interface shall contain no keyboard trap. |
| ACC-005 | Must | Status changes and validation errors shall be exposed through appropriate live-region or focus-management behavior. |
| ACC-006 | Must | Named primary views shall contain no automatically detectable axe-core violations tagged WCAG 2 Level A or AA. |
| ACC-007 | Must | Text and controls shall remain usable at 200% browser zoom at a 1280-by-720 CSS-pixel viewport without loss of required functionality. |
| ACC-008 | Must | The interface shall be responsive and fully functional on mobile phone browsers (minimum viewport width 360 CSS-pixels) and tablet browsers (minimum viewport width 768 CSS-pixels), with touch targets meeting minimum dimensions of 44 by 44 CSS-pixels for primary controls. |

Automated accessibility scanning detects only some classes of defects, so release verification includes manual keyboard and screen-reader activities.[cite:167][cite:170]

## 13. Performance and reliability

The reference performance environment shall be documented in the verification report and shall include client hardware or CI runner class, browser, network conditions, Supabase environment, dataset, and test revision.

| ID | Priority | Requirement |
|---|---|---|
| PRF-001 | Must | Next-card selection shall complete within 500 ms at the 95th percentile over at least 1,000 measured selections after warm-up for a user with 10,000 cards and 100,000 review events in the reference environment. |
| PRF-002 | Must | Preview and commit of a valid 10,000-row CSV shall each complete within 30 seconds in the reference environment. |
| PRF-003 | Must | The question view shall become interactive within 3 seconds at the 95th percentile under the documented reference network after authentication and warm cache. |
| REL-001 | Must | Retrying a timed-out import or grade with the same operation ID shall not duplicate logical operations. |
| REL-002 | Must | A browser refresh before grade commit shall create no review event. |
| REL-003 | Must | A browser refresh after confirmed grade commit shall display state consistent with that committed grade. |
| REL-004 | Must | Database transaction failure shall expose a recoverable error without presenting an uncommitted state as successful. |
| REL-005 | Must | The user shall be able to export all owned decks, cards, imports, sessions, review events, and algorithm versions in documented JSON. |
| REL-006 | Should | A documented administrative restore harness shall recreate an equivalent user dataset from the exported JSON in a non-production environment. |

## 14. Diagnostics and observability

| ID | Priority | Requirement |
|---|---|---|
| DIA-001 | Must | The settings view shall provide a `Run diagnostics` action. |
| DIA-002 | Must | Runtime diagnostics shall test client version, authentication status, API reachability, database reachability, migration compatibility, and scheduler sanity without modifying learning data. |
| DIA-003 | Must | Scheduler diagnostics shall execute a fixed in-memory conformance vector and compare it with a version-controlled expected result. |
| DIA-004 | Must | Diagnostic results shall show an individual pass or fail state and timestamp for each check. |
| DIA-005 | Must | The user shall be able to copy or download a sanitized diagnostic report containing app version, browser family, component states, timestamps, scheduler version, migration version, and correlation ID. |
| DIA-006 | Must | Server-side errors shall include a correlation ID that can be matched to sanitized client error information. |

## 15. Self-test and development requirements

| ID | Priority | Requirement |
|---|---|---|
| TST-001 | Must | The repository shall provide `npm run test:setup` to create a disposable local test environment from migrations and version-controlled seed data. |
| TST-002 | Must | The repository shall provide `npm run verify` to run all release-blocking static, unit, property, database, integration, build, accessibility, and end-to-end checks without interactive input. |
| TST-003 | Must | `npm run verify` shall exit zero only when every release-blocking check passes. |
| TST-004 | Must | Tests shall not require production credentials, production data, live email delivery, or another uncontrolled external service. |
| TST-005 | Must | Each automated test shall establish its own controlled state and shall not depend on test execution order. |
| TST-006 | Must | Scheduler tests shall use a fixed injectable clock. |
| TST-007 | Must | Selection tests shall use a seeded injectable random source. |
| TST-008 | Must | The repository shall include typed factories for every scheduler state and primary database entity. |
| TST-009 | Must | The repository shall include canonical fixtures for valid, invalid, duplicate, Unicode, quoted, multiline, and 10,000-row CSV inputs. |
| TST-010 | Must | Property-based scheduling tests shall execute at least 10,000 generated valid histories per release verification run. |
| TST-011 | Must | Property tests shall verify nonnegative counters, aggregate equality, chronological event order, probability bounds, and exclusion of suspended cards. |
| TST-012 | Must | Scheduling, normalization, duplicate, and review-transaction modules shall each maintain at least 95% statement and 90% branch coverage. |
| TST-013 | Must | First-party production code shall maintain at least 85% statement and 80% branch coverage overall. |
| TST-014 | Must | Coverage below a required threshold shall fail `npm run verify`. |
| TST-015 | Must | The repository shall contain versioned golden scenarios for new learning, success, lapse, relearning, overdue review, exam-imminent prioritization, and due-backlog suppression. |
| TST-016 | Must | The repository shall contain a machine-readable bidirectional requirements traceability matrix. |
| TST-017 | Must | The traceability checker shall fail when a Must requirement has no verification method, acceptance criterion, linked test, or evidence location. |
| TST-018 | Must | The traceability checker shall fail on duplicate requirement IDs, duplicate test IDs, and tests referencing nonexistent requirement IDs. |

Supabase supports local development and version-controlled database migrations, while Playwright supports isolated cross-browser execution and CI artifacts.[cite:152][cite:155][cite:169][cite:175] Coverage thresholds provide evidence of exercised code but do not replace behavioral acceptance tests.[cite:177]

## 16. Continuous integration and release

| ID | Priority | Requirement |
|---|---|---|
| CIC-001 | Must | CI shall install dependencies from the committed lockfile without updating dependency versions. |
| CIC-002 | Must | CI shall execute `npm run verify` for every pull request targeting the protected main branch. |
| CIC-003 | Must | CI verification jobs shall have explicit failure timeouts. |
| CIC-004 | Must | Failed browser tests shall retain Playwright traces and relevant screenshots. |
| CIC-005 | Must | Every verification run shall retain machine-readable unit, database, browser, accessibility, coverage, and traceability results. |
| CIC-006 | Must | Production deployment shall use only the exact commit SHA that passed the required verification workflow. |
| CIC-007 | Must | A failed or incomplete required verification workflow shall prevent production deployment. |
| CIC-008 | Must | Each release shall generate the verification report defined in the companion document. |

## 17. Required deliverables

| ID | Priority | Requirement |
|---|---|---|
| DEL-001 | Must | Antigravity shall deliver all source code and tests in a Git repository. |
| DEL-002 | Must | Antigravity shall deliver a README containing prerequisites, local setup, test setup, verification, build, deployment, and recovery instructions. |
| DEL-003 | Must | Antigravity shall deliver version-controlled Supabase migrations and seed data. |
| DEL-004 | Must | Antigravity shall deliver a data dictionary and entity-relationship diagram consistent with the migrations. |
| DEL-005 | Must | Antigravity shall deliver the machine-readable requirements traceability matrix. |
| DEL-006 | Must | Antigravity shall deliver test fixtures without personal data. |
| DEL-007 | Must | Antigravity shall deliver the CI workflow and environment-variable template containing placeholders but no secrets. |
| DEL-008 | Must | Antigravity shall deliver a completed release verification report for the proposed production release. |
| DEL-009 | Must | Antigravity shall list known limitations, approved waivers, residual risks, and deferred Should requirements. |

## 18. Implementation sequence

Antigravity shall use the following implementation sequence unless an approved change is recorded:

1. Create repository, strict TypeScript/Vite/React shell, linting, tests, and CI skeleton.
2. Create local Supabase workflow, migrations, RLS, database tests, and seed factories.
3. Implement authentication and deck settings.
4. Implement CSV parsing, canonical normalization, preview, atomic import, and duplicate protection.
5. Integrate and pin FSRS; pass its conformance and golden-vector tests.
6. Implement card state machine, cohorts, session allocation, utility calculation, and deterministic selection.
7. Implement atomic grade, idempotency, concurrency protection, undo, and event audit.
8. Implement study, management, summary, export, and diagnostic interfaces.
9. Complete cross-browser, accessibility, performance, security, and recovery tests.
10. Run the full verification plan and produce the release verification report.

## 19. Definition of done

A requirement is complete only when its implementation is committed, every linked verification activity passes, required evidence exists, and the traceability checker reports it verified. The product is release-ready only when:

- `npm run verify` passes from a clean checkout and disposable local environment.
- 100% of Must requirements have passing evidence.
- No open severity-1 or severity-2 anomaly remains.
- Any waiver identifies its requirement, rationale, risk, approver, expiration, and corrective milestone.
- The exact release commit and migrations have a completed verification report.

An Antigravity completion statement, code coverage result, successful build, or demonstration by itself shall not constitute acceptance.

## 20. Confidence and limitations

**Overall confidence: High** that the architecture and core learning mechanisms are suitable for a text-only, cloud-synchronized personal flashcard application. **Confidence: High** for the value of retrieval practice, feedback, and spacing; **Medium** for FSRS as the selected implementation and for the utility-ranking policy; **Medium** for the initial performance and coverage thresholds. **Uncertain** is any claim that cohort size 10, a 30% acquisition ceiling, or a 90% retention target is optimal for every learner and exam; all are controlled, versioned defaults that the user can configure and the product can evaluate.
