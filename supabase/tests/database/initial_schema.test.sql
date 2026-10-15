-- initial_schema.test.sql
-- pgTAP tests for database schema, constraints, RLS, and functions

BEGIN;
SELECT plan(15);

-- 2. Check tables exist
SELECT has_table('profiles', 'DAT-001: Table profiles exists');
SELECT has_table('decks', 'DAT-001: Table decks exists');
SELECT has_table('import_batches', 'DAT-001: Table import_batches exists');
SELECT has_table('cards', 'DAT-001: Table cards exists');
SELECT has_table('study_sessions', 'DAT-001: Table study_sessions exists');
SELECT has_table('session_card_state', 'DAT-001: Table session_card_state exists');
SELECT has_table('review_events', 'DAT-001: Table review_events exists');
SELECT has_table('selection_events', 'DAT-001: Table selection_events exists');
SELECT has_table('grade_operations', 'DAT-001: Table grade_operations exists');

-- 3. Check functions exist
SELECT has_function('rpc_submit_grade', ARRAY['uuid', 'uuid', 'uuid', 'integer', 'text', 'timestamptz', 'timestamptz', 'timestamptz', 'double precision', 'boolean', 'jsonb', 'text'], 'REV-003, REV-005: Function rpc_submit_grade exists');
SELECT has_function('rpc_undo_grade', ARRAY['uuid', 'uuid', 'uuid', 'text'], 'REV-012, REV-013: Function rpc_undo_grade exists');
SELECT has_function('rpc_commit_import', ARRAY['uuid', 'uuid', 'text', 'integer', 'jsonb'], 'IMP-009, IMP-010: Function rpc_commit_import exists');
SELECT has_function('rpc_delete_card', ARRAY['uuid'], 'MGT-011: Function rpc_delete_card exists');

-- 4. Check trigger exists
SELECT has_trigger('review_events', 'trg_review_events_append_only', 'DAT-010: Trigger trg_review_events_append_only exists on review_events');

-- 5. Check constraints
SELECT col_has_check('cards', 'review_count', 'DAT-005, DAT-006: Cards has check constraint on counters');

SELECT * FROM finish();
ROLLBACK;
