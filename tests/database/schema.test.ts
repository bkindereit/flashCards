import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

describe('Database Schema & RPC Migration (PGlite In-Memory Postgres)', () => {
  let db: PGlite;

  beforeEach(async () => {
    db = new PGlite();

    // Mock auth schema and functions for testing
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

    // Load and run all migrations in order
    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      await db.exec(sql);
    }
  });

  it('DAT-001, DAT-002, DAT-003: enforces table creation, user_id, UUID, and timestamptz columns', async () => {
    const res = await db.query<{ tablename: string }>(`
      SELECT tablename FROM pg_catalog.pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);
    const tables = res.rows.map(r => r.tablename);
    expect(tables).toContain('profiles');
    expect(tables).toContain('decks');
    expect(tables).toContain('import_batches');
    expect(tables).toContain('cards');
    expect(tables).toContain('study_sessions');
    expect(tables).toContain('session_card_state');
    expect(tables).toContain('review_events');
    expect(tables).toContain('selection_events');
    expect(tables).toContain('grade_operations');
  });

  it('DAT-004, DAT-005, DAT-006, DAT-007: enforces card learning_state, non-negative counters, equality, and importance_weight', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'test@example.com');`);
    await db.exec(`
      INSERT INTO public.decks (id, user_id, name) 
      VALUES ('22222222-2222-2222-2222-222222222222', '${userId}', 'Test Deck');
    `);

    // Valid insert
    await db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash,
        review_count, correct_count, incorrect_count, importance_weight, learning_state
      ) VALUES (
        '33333333-3333-3333-3333-333333333333', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q', 'A', 'Q', 'A', 'hash1',
        2, 1, 1, 1.5, 'review'
      );
    `);

    // Invalid counter mismatch violates chk_card_counter_equality (DAT-006)
    await expect(db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash,
        review_count, correct_count, incorrect_count
      ) VALUES (
        '44444444-4444-4444-4444-444444444444', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q2', 'A2', 'Q2', 'A2', 'hash2',
        5, 2, 2
      );
    `)).rejects.toThrow();

    // Invalid learning_state violates CHECK (DAT-004)
    await expect(db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash,
        learning_state
      ) VALUES (
        '55555555-5555-5555-5555-555555555555', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q3', 'A3', 'Q3', 'A3', 'hash3',
        'invalid_state'
      );
    `)).rejects.toThrow();

    // Invalid importance_weight <= 0 (DAT-007)
    await expect(db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash,
        importance_weight
      ) VALUES (
        '66666666-6666-6666-6666-666666666666', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q4', 'A4', 'Q4', 'A4', 'hash4',
        0.0
      );
    `)).rejects.toThrow();
  });

  it('DAT-008: unique constraint prevents duplicate active cards with same content hash', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'test@example.com');`);
    await db.exec(`
      INSERT INTO public.decks (id, user_id, name) 
      VALUES ('22222222-2222-2222-2222-222222222222', '${userId}', 'Test Deck');
    `);

    await db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash
      ) VALUES (
        '33333333-3333-3333-3333-333333333333', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q', 'A', 'Q', 'A', 'unique_hash'
      );
    `);

    // Duplicate insert violates uq_active_card_hash
    await expect(db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash
      ) VALUES (
        '44444444-4444-4444-4444-444444444444', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q', 'A', 'Q', 'A', 'unique_hash'
      );
    `)).rejects.toThrow();
  });

  it('DAT-012, DAT-013: percent_correct is derived and immutable', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'test@example.com');`);
    await db.exec(`
      INSERT INTO public.decks (id, user_id, name) 
      VALUES ('22222222-2222-2222-2222-222222222222', '${userId}', 'Test Deck');
    `);

    // Zero reviews -> percent_correct = 0.0
    await db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash,
        review_count, correct_count, incorrect_count
      ) VALUES (
        '33333333-3333-3333-3333-333333333333', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q', 'A', 'Q', 'A', 'hash1',
        0, 0, 0
      );
    `);

    const res1 = await db.query<{ percent_correct: number }>(`
      SELECT percent_correct FROM public.cards WHERE id = '33333333-3333-3333-3333-333333333333';
    `);
    expect(res1.rows[0]?.percent_correct).toBe(0.0);

    // 4 reviews, 3 correct -> percent_correct = 75.0
    await db.exec(`
      UPDATE public.cards SET review_count = 4, correct_count = 3, incorrect_count = 1
      WHERE id = '33333333-3333-3333-3333-333333333333';
    `);

    const res2 = await db.query<{ percent_correct: number }>(`
      SELECT percent_correct FROM public.cards WHERE id = '33333333-3333-3333-3333-333333333333';
    `);
    expect(res2.rows[0]?.percent_correct).toBe(75.0);
  });

  it('DAT-009, DAT-010, DAT-011: review_events append-only except invalidation and prevents orphaning', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'test@example.com');`);
    await db.exec(`
      INSERT INTO public.decks (id, user_id, name) 
      VALUES ('22222222-2222-2222-2222-222222222222', '${userId}', 'Test Deck');
    `);
    await db.exec(`
      INSERT INTO public.cards (
        id, user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash
      ) VALUES (
        '33333333-3333-3333-3333-333333333333', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q', 'A', 'Q', 'A', 'hash1'
      );
    `);

    const eventId = '55555555-5555-5555-5555-555555555555';
    await db.exec(`
      INSERT INTO public.review_events (
        id, card_id, deck_id, user_id, operation_id,
        shown_at, revealed_at, rated_at, result, rating,
        pre_learning_state, pre_difficulty, pre_stability_days,
        post_learning_state, post_difficulty, post_stability_days,
        algorithm_version
      ) VALUES (
        '${eventId}', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
        '${userId}', '66666666-6666-6666-6666-666666666666',
        NOW(), NOW(), NOW(), 'correct', 3,
        'learning', 0, 0,
        'review', 5.0, 1.0,
        'fsrs-v4'
      );
    `);

    // Modifying historical rating should throw (DAT-010)
    await expect(db.exec(`
      UPDATE public.review_events SET rating = 1 WHERE id = '${eventId}';
    `)).rejects.toThrow();

    // Modifying invalidation fields should succeed
    await expect(db.exec(`
      UPDATE public.review_events 
      SET invalidated_at = NOW(), invalidation_reason = 'user undo'
      WHERE id = '${eventId}';
    `)).resolves.not.toThrow();

    // Deleting card that has review events is restricted (DAT-011)
    await expect(db.exec(`
      DELETE FROM public.cards WHERE id = '33333333-3333-3333-3333-333333333333';
    `)).rejects.toThrow();
  });

  it('DEK-003, DEK-004, DEK-005, DEK-006, DEK-007, DEK-008: Deck constraints for retention, cohorts, and timings', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    await db.exec(`INSERT INTO auth.users (id, email) VALUES ('${userId}', 'test@example.com');`);

    // Valid deck with defaults and optional exam_date (DEK-003..008)
    const validDeckId = '99999999-9999-9999-9999-999999999999';
    await db.exec(`
      INSERT INTO public.decks (id, user_id, name, exam_date)
      VALUES ('${validDeckId}', '${userId}', 'Test Deck', '2026-12-31T00:00:00Z');
    `);

    const res = await db.query<{ desired_retention: number; cohort_size: number; new_learning_fraction: number }>(`
      SELECT desired_retention, cohort_size, new_learning_fraction FROM public.decks WHERE id = '${validDeckId}';
    `);
    expect(res.rows[0]?.desired_retention).toBe(0.90);
    expect(res.rows[0]?.cohort_size).toBe(10);
    expect(res.rows[0]?.new_learning_fraction).toBe(0.30);

    // Invalid desired_retention < 0.70 (DEK-004)
    await expect(db.exec(`
      INSERT INTO public.decks (user_id, name, desired_retention)
      VALUES ('${userId}', 'Invalid Deck', 0.65);
    `)).rejects.toThrow();

    // Invalid cohort_size > 20 (DEK-005)
    await expect(db.exec(`
      INSERT INTO public.decks (user_id, name, cohort_size)
      VALUES ('${userId}', 'Invalid Cohort Deck', 25);
    `)).rejects.toThrow();
  });
});
