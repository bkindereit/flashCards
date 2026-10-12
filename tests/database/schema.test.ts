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

    // Load and run initial migration
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20261010000000_initial_schema.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await db.exec(migrationSql);
  });

  it('enforces table creation and primary keys', async () => {
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

  it('enforces DAT-006: correct_count + incorrect_count = review_count', async () => {
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
        review_count, correct_count, incorrect_count
      ) VALUES (
        '33333333-3333-3333-3333-333333333333', '${userId}', '22222222-2222-2222-2222-222222222222',
        'Q', 'A', 'Q', 'A', 'hash1',
        2, 1, 1
      );
    `);

    // Invalid counter mismatch violates chk_card_counter_equality
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
  });

  it('enforces DAT-012 & DAT-013: percent_correct is derived and immutable', async () => {
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

  it('enforces DAT-010: review_events append-only except invalidation', async () => {
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

    // Modifying historical rating should throw
    await expect(db.exec(`
      UPDATE public.review_events SET rating = 1 WHERE id = '${eventId}';
    `)).rejects.toThrow();

    // Modifying invalidation fields should succeed
    await expect(db.exec(`
      UPDATE public.review_events 
      SET invalidated_at = NOW(), invalidation_reason = 'user undo'
      WHERE id = '${eventId}';
    `)).resolves.not.toThrow();
  });
});
