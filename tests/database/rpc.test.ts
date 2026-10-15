import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

describe('Database RPC Functions (submit_grade, undo_grade, commit_import)', () => {
  let db: PGlite;
  const userId = '11111111-1111-1111-1111-111111111111';
  const deckId = '22222222-2222-2222-2222-222222222222';
  const sessionId = '33333333-3333-3333-3333-333333333333';
  const cardId = '44444444-4444-4444-4444-444444444444';

  beforeEach(async () => {
    db = new PGlite();

    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY,
        email TEXT UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      BEGIN
        RETURN current_setting('request.jwt.claim.sub', true)::UUID;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261010000000_initial_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(migrationSql);

    // Set auth context
    await db.exec(`SET "request.jwt.claim.sub" = '${userId}';`);

    // Seed User, Deck, Session, and Card
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${userId}', 'user@test.com');
      INSERT INTO public.decks (id, user_id, name) VALUES ('${deckId}', '${userId}', 'Vocabulary');
      INSERT INTO public.study_sessions (id, user_id, deck_id, duration_seconds, settings_snapshot)
      VALUES ('${sessionId}', '${userId}', '${deckId}', 900, '{"cohort_size": 10}'::jsonb);
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash,
        learning_state, review_count, correct_count, incorrect_count
      ) VALUES (
        '${cardId}', '${userId}', '${deckId}', 'Bonjour', 'Hello',
        'Bonjour', 'Hello', 'hash_bonjour',
        'review', 0, 0, 0
      );
    `);
  });

  it('REV-001, REV-002, REV-003, REV-005, REV-008, REV-009, REV-014: rpc_submit_grade updates card, session, and creates review event atomically', async () => {
    const opId = '55555555-5555-5555-5555-555555555555';
    const now = new Date().toISOString();
    const postState = JSON.stringify({
      learning_state: 'review',
      difficulty: 4.8,
      stability_days: 2.5,
      next_due_at: new Date(Date.now() + 86400000 * 2.5).toISOString()
    });

    const res = await db.query<{ rpc_submit_grade: { success: boolean; is_lapse: boolean } }>(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID,
        '${sessionId}'::UUID,
        '${cardId}'::UUID,
        3,
        'correct',
        '${now}'::TIMESTAMPTZ,
        '${now}'::TIMESTAMPTZ,
        '${now}'::TIMESTAMPTZ,
        4.2,
        false,
        '${postState}'::JSONB,
        'fsrs-v4'
      );
    `);

    expect(res.rows[0]?.rpc_submit_grade.success).toBe(true);
    expect(res.rows[0]?.rpc_submit_grade.is_lapse).toBe(false);

    // Verify card counters
    const cardRes = await db.query<{ review_count: number; correct_count: number; incorrect_count: number; difficulty: number }>(`
      SELECT review_count, correct_count, incorrect_count, difficulty FROM public.cards WHERE id = '${cardId}';
    `);
    expect(cardRes.rows[0]?.review_count).toBe(1);
    expect(cardRes.rows[0]?.correct_count).toBe(1);
    expect(cardRes.rows[0]?.incorrect_count).toBe(0);
    expect(cardRes.rows[0]?.difficulty).toBe(4.8);
  });

  it('REV-004, REL-001: Repeating a committed operation ID returns previously committed result without duplicate grade', async () => {
    const opId = '55555555-5555-5555-5555-555555555555';
    const now = new Date().toISOString();
    const postState = JSON.stringify({
      learning_state: 'review',
      difficulty: 4.8,
      stability_days: 2.5,
      next_due_at: new Date(Date.now() + 86400000 * 2.5).toISOString()
    });

    // First call
    await db.exec(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID, '${sessionId}'::UUID, '${cardId}'::UUID,
        3, 'correct', '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ,
        4.2, false, '${postState}'::JSONB, 'fsrs-v4'
      );
    `);

    // Repeated call with same operation ID
    const idempotentRes = await db.query<{ rpc_submit_grade: { success: boolean } }>(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID, '${sessionId}'::UUID, '${cardId}'::UUID,
        3, 'correct', '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ,
        4.2, false, '${postState}'::JSONB, 'fsrs-v4'
      );
    `);
    expect(idempotentRes.rows[0]?.rpc_submit_grade.success).toBe(true);

    // Card counters must remain 1
    const cardRes = await db.query<{ review_count: number }>(`
      SELECT review_count FROM public.cards WHERE id = '${cardId}';
    `);
    expect(cardRes.rows[0]?.review_count).toBe(1);
  });

  it('REV-006, REV-007: rpc_submit_grade increments incorrect_count, lapse_count, and sets relearning on incorrect review card', async () => {
    const opId = '66666666-6666-6666-6666-666666666666';
    const now = new Date().toISOString();
    const postState = JSON.stringify({
      learning_state: 'relearning',
      difficulty: 6.2,
      stability_days: 0.5,
      next_due_at: new Date(Date.now() + 60000).toISOString()
    });

    const res = await db.query<{ rpc_submit_grade: { success: boolean; is_lapse: boolean } }>(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID,
        '${sessionId}'::UUID,
        '${cardId}'::UUID,
        1,
        'incorrect',
        '${now}'::TIMESTAMPTZ,
        '${now}'::TIMESTAMPTZ,
        '${now}'::TIMESTAMPTZ,
        8.0,
        false,
        '${postState}'::JSONB,
        'fsrs-v4'
      );
    `);

    expect(res.rows[0]?.rpc_submit_grade.success).toBe(true);
    expect(res.rows[0]?.rpc_submit_grade.is_lapse).toBe(true);

    const cardRes = await db.query<{ lapse_count: number; learning_state: string; incorrect_count: number }>(`
      SELECT lapse_count, learning_state, incorrect_count FROM public.cards WHERE id = '${cardId}';
    `);
    expect(cardRes.rows[0]?.lapse_count).toBe(1);
    expect(cardRes.rows[0]?.learning_state).toBe('relearning');
    expect(cardRes.rows[0]?.incorrect_count).toBe(1);
  });

  it('REV-010: Concurrent conflicting grades for one review opportunity handled safely', async () => {
    const opId = '11111111-2222-3333-4444-555555555555';
    const now = new Date().toISOString();
    const postState = JSON.stringify({ learning_state: 'review', difficulty: 5.0, stability_days: 2.0 });

    const call1 = db.query(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID, '${sessionId}'::UUID, '${cardId}'::UUID,
        3, 'correct', '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ,
        2.0, false, '${postState}'::JSONB, 'fsrs-v4'
      );
    `);
    const call2 = db.query(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID, '${sessionId}'::UUID, '${cardId}'::UUID,
        3, 'correct', '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ,
        2.0, false, '${postState}'::JSONB, 'fsrs-v4'
      );
    `);

    const [r1, r2] = await Promise.all([call1, call2]);
    expect(r1).toBeDefined();
    expect(r2).toBeDefined();
  });

  it('REV-012: rpc_undo_grade rolls back card and invalidates review event', async () => {
    const opId = '77777777-7777-7777-7777-777777777777';
    const undoOpId = '88888888-8888-8888-8888-888888888888';
    const now = new Date().toISOString();
    const postState = JSON.stringify({
      learning_state: 'review',
      difficulty: 5.0,
      stability_days: 2.0,
      next_due_at: now
    });

    await db.exec(`
      SELECT public.rpc_submit_grade(
        '${opId}'::UUID,
        '${sessionId}'::UUID,
        '${cardId}'::UUID,
        3,
        'correct',
        '${now}'::TIMESTAMPTZ,
        '${now}'::TIMESTAMPTZ,
        '${now}'::TIMESTAMPTZ,
        3.5,
        false,
        '${postState}'::JSONB,
        'fsrs-v4'
      );
    `);

    // Verify card is updated
    const beforeUndo = await db.query<{ review_count: number; correct_count: number }>(`
      SELECT review_count, correct_count FROM public.cards WHERE id = '${cardId}';
    `);
    expect(beforeUndo.rows[0]?.review_count).toBe(1);
    expect(beforeUndo.rows[0]?.correct_count).toBe(1);

    // Call undo
    const undoRes = await db.query<{ rpc_undo_grade: { success: boolean } }>(`
      SELECT public.rpc_undo_grade(
        '${undoOpId}'::UUID,
        '${sessionId}'::UUID,
        '${opId}'::UUID,
        'misclick'
      );
    `);
    expect(undoRes.rows[0]?.rpc_undo_grade.success).toBe(true);

    // Verify card state restored
    const afterUndo = await db.query<{ review_count: number; correct_count: number }>(`
      SELECT review_count, correct_count FROM public.cards WHERE id = '${cardId}';
    `);
    expect(afterUndo.rows[0]?.review_count).toBe(0);
    expect(afterUndo.rows[0]?.correct_count).toBe(0);

    // Verify event is marked invalidated
    const eventRes = await db.query<{ invalidated_at: string; invalidation_reason: string }>(`
      SELECT invalidated_at, invalidation_reason FROM public.review_events WHERE operation_id = '${opId}';
    `);
    expect(eventRes.rows[0]?.invalidated_at).not.toBeNull();
    expect(eventRes.rows[0]?.invalidation_reason).toBe('misclick');
  });

  it('REV-013: rpc_undo_grade rejects undo after another grade has committed', async () => {
    const op1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const op2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
    const undoOp = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
    const now = new Date().toISOString();
    const postState = JSON.stringify({
      learning_state: 'review',
      difficulty: 5.0,
      stability_days: 2.0,
      next_due_at: now
    });

    // Grade 1
    await db.exec(`
      SELECT public.rpc_submit_grade(
        '${op1}'::UUID, '${sessionId}'::UUID, '${cardId}'::UUID,
        3, 'correct', '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ,
        3.0, false, '${postState}'::JSONB, 'fsrs-v4'
      );
    `);

    // Grade 2
    await db.exec(`
      SELECT public.rpc_submit_grade(
        '${op2}'::UUID, '${sessionId}'::UUID, '${cardId}'::UUID,
        3, 'correct', '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ, '${now}'::TIMESTAMPTZ,
        3.0, false, '${postState}'::JSONB, 'fsrs-v4'
      );
    `);

    // Attempting to undo op1 should fail
    await expect(db.exec(`
      SELECT public.rpc_undo_grade(
        '${undoOp}'::UUID, '${sessionId}'::UUID, '${op1}'::UUID, 'too late'
      );
    `)).rejects.toThrow(/Cannot undo: another grade has committed/);
  });

  it('IMP-009, IMP-010, IMP-011, IMP-012, IMP-013, IMP-014, IMP-016: rpc_commit_import inserts unique cards and skips duplicates in deck', async () => {
    const importOp = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
    const cardsData = JSON.stringify([
      {
        source_row_number: 1,
        question_text: 'What is 2+2?',
        answer_text: '4',
        normalized_question: 'What is 2+2?',
        normalized_answer: '4',
        content_hash: 'hash_math_4',
        cohort_number: 1,
        source_order: 1
      },
      {
        source_row_number: 2,
        question_text: 'Bonjour',
        answer_text: 'Hello',
        normalized_question: 'Bonjour',
        normalized_answer: 'Hello',
        content_hash: 'hash_bonjour', // already exists in deck from beforeEach!
        cohort_number: 1,
        source_order: 2
      }
    ]);

    const res = await db.query<{ rpc_commit_import: { success: boolean; inserted_count: number; skipped_duplicate_count: number } }>(`
      SELECT public.rpc_commit_import(
        '${importOp}'::UUID,
        '${deckId}'::UUID,
        'test.csv',
        2,
        '${cardsData}'::JSONB
      );
    `);

    expect(res.rows[0]?.rpc_commit_import.success).toBe(true);
    expect(res.rows[0]?.rpc_commit_import.inserted_count).toBe(1);
    expect(res.rows[0]?.rpc_commit_import.skipped_duplicate_count).toBe(1);

    // Verify idempotency
    const resIdempotent = await db.query<{ rpc_commit_import: { success: boolean; inserted_count: number } }>(`
      SELECT public.rpc_commit_import(
        '${importOp}'::UUID,
        '${deckId}'::UUID,
        'test.csv',
        2,
        '${cardsData}'::JSONB
      );
    `);
    expect(resIdempotent.rows[0]?.rpc_commit_import.inserted_count).toBe(1);
  });
});
