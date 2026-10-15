import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
import path from 'path';

describe('Row-Level Security (RLS) Isolation (SEC-001, SEC-002, SEC-003)', () => {
  let db: PGlite;
  const userA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const deckA = '11111111-1111-1111-1111-111111111111';

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
        RETURN NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
      await db.exec(sql);
    }

    // Create user accounts
    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${userA}', 'userA@example.com');
      INSERT INTO auth.users (id, email) VALUES ('${userB}', 'userB@example.com');
    `);

    // Create authenticated role as in Supabase PostgREST
    await db.exec(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
      END
      $$;
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
      SET ROLE authenticated;
    `);

    // Insert data as User A
    await db.exec(`SET "request.jwt.claim.sub" = '${userA}';`);
    await db.exec(`
      INSERT INTO public.decks (id, user_id, name) VALUES ('${deckA}', '${userA}', 'User A Private Deck');
      INSERT INTO public.cards (
        user_id, deck_id, question_text, answer_text,
        normalized_question, normalized_answer, content_hash
      ) VALUES (
        '${userA}', '${deckA}', 'Secret Question', 'Secret Answer',
        'Secret Question', 'Secret Answer', 'hash_secret'
      );
    `);
  });

  it('SEC-001, SEC-002: RLS enabled and User B cannot select or modify User A records', async () => {
    // Switch to User B
    await db.exec(`SET "request.jwt.claim.sub" = '${userB}';`);

    const deckRes = await db.query<{ id: string; name: string }>(`
      SELECT id, name FROM public.decks;
    `);
    expect(deckRes.rows).toHaveLength(0);

    const cardRes = await db.query<{ id: string; question_text: string }>(`
      SELECT id, question_text FROM public.cards;
    `);
    expect(cardRes.rows).toHaveLength(0);

    // Attempt to update User A deck
    const updateRes = await db.query(`
      UPDATE public.decks SET name = 'Hacked' WHERE id = '${deckA}';
    `);
    expect(updateRes.affectedRows).toBe(0);

    // Verify as User A that deck remains unchanged
    await db.exec(`SET "request.jwt.claim.sub" = '${userA}';`);
    const checkRes = await db.query<{ name: string }>(`
      SELECT name FROM public.decks WHERE id = '${deckA}';
    `);
    expect(checkRes.rows[0]?.name).toBe('User A Private Deck');
  });

  it('SEC-003: Unauthenticated user cannot read private tables', async () => {
    // Clear auth context
    await db.exec(`SET "request.jwt.claim.sub" = '';`);

    const deckRes = await db.query(`SELECT * FROM public.decks;`);
    expect(deckRes.rows).toHaveLength(0);

    const cardRes = await db.query(`SELECT * FROM public.cards;`);
    expect(cardRes.rows).toHaveLength(0);
  });
});
