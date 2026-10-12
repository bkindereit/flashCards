-- initial_schema.test.sql
-- pgTAP tests for database schema, constraints, RLS, and functions

BEGIN;
SELECT plan(14);

-- 2. Check tables exist
SELECT has_table('profiles', 'Table profiles exists');
SELECT has_table('decks', 'Table decks exists');
SELECT has_table('import_batches', 'Table import_batches exists');
SELECT has_table('cards', 'Table cards exists');
SELECT has_table('study_sessions', 'Table study_sessions exists');
SELECT has_table('session_card_state', 'Table session_card_state exists');
SELECT has_table('review_events', 'Table review_events exists');
SELECT has_table('selection_events', 'Table selection_events exists');
SELECT has_table('grade_operations', 'Table grade_operations exists');

-- 3. Check functions exist
SELECT has_function('rpc_submit_grade', ARRAY['uuid', 'uuid', 'uuid', 'integer', 'text', 'timestamptz', 'timestamptz', 'timestamptz', 'double precision', 'boolean', 'jsonb', 'text'], 'Function rpc_submit_grade exists');
SELECT has_function('rpc_undo_grade', ARRAY['uuid', 'uuid', 'uuid', 'text'], 'Function rpc_undo_grade exists');
SELECT has_function('rpc_commit_import', ARRAY['uuid', 'uuid', 'text', 'integer', 'jsonb'], 'Function rpc_commit_import exists');

-- 4. Check trigger exists
SELECT has_trigger('review_events', 'trg_review_events_append_only', 'Trigger trg_review_events_append_only exists on review_events');

-- 5. Check constraints
SELECT col_has_check('cards', 'review_count', 'Cards has check constraint on counters');

SELECT * FROM finish();
ROLLBACK;
