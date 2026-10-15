# Test Naming and Requirement Citation Conventions

To ensure complete, verifiable bidirectional requirements traceability (FCA-SRS-001 and FCA-VVP-001 / TST-016..018), every automated test across unit, component, database, inspection, and E2E suites MUST adhere to this naming convention:

## 1. Title Format
Every test title (`it()`, `test()`, or pgTAP assertion description) must begin with one or more explicit requirement IDs separated by commas, followed by a colon and a space, and then the test description.

```text
<REQ-ID>(, <REQ-ID>)*: <Descriptive statement of behavior>
```

### Examples of Valid Test Titles:
- `UI-005: Reveal button reveals answer text without losing question`
- `UI-011, UI-012: Space bar reveals answer when focus is not on another control`
- `SCH-014: Learning card enters review state upon successful retrieval`
- `SEC-002: User B cannot read or mutate User A deck records`
- `PRG-001: Renders segmented mastery bar with exact stage counts`

### Invalid Formats (Rejected by Traceability Checker):
- Blanket range citations: `UI-001..UI-016: Study view handles interactions` (Does NOT prove individual requirement verification)
- Citations without colon: `UI-005 Reveal answer`
- Implicit or omitted requirement IDs: `Should correctly calculate next interval`

## 2. Test Discovery Scope
1. **Vitest Unit & Component Tests:** `tests/**/*.{ts,tsx}`
2. **Database pgTAP Tests:** `supabase/tests/database/*.sql` (Assertion descriptions)
3. **Database PGlite Tests:** `tests/database/*.test.ts`
4. **Playwright E2E Tests:** `tests/e2e/*.spec.ts`
5. **Inspection Tests:** `tests/unit/inspection/*.test.ts`
