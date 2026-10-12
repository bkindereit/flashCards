-- Supabase Seed Data (DEL-003, DEL-006)
-- Seed fixtures using non-personal, synthetic academic learning cards.

DO $$
DECLARE
  v_user_id uuid := '00000000-0000-0000-0000-000000000001';
  v_deck_id uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- 0. Insert local seed user in auth.users and public.profiles
  INSERT INTO auth.users (
    id, email, raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at
  ) VALUES (
    v_user_id,
    'seed-learner@example.local',
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (
    id, user_id, default_desired_retention, default_cohort_size, default_new_learning_fraction, created_at, updated_at
  ) VALUES (
    v_user_id,
    v_user_id,
    0.90,
    10,
    0.30,
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  ) ON CONFLICT (id) DO NOTHING;

  -- 1. Insert demo deck
  INSERT INTO public.decks (
    id, user_id, name, description, desired_retention, cohort_size, new_learning_fraction,
    min_failed_retry_delay_seconds, min_intervening_cards, is_archived, created_at, updated_at
  ) VALUES (
    v_deck_id,
    v_user_id,
    'General Science & Computing',
    'Canonical non-personal seed deck covering computing concepts and foundational science.',
    0.90,
    10,
    0.30,
    60,
    3,
    false,
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  ) ON CONFLICT (id) DO NOTHING;

  -- 2. Insert sample cards
  INSERT INTO public.cards (
    id, user_id, deck_id, source_row_number, question_text, answer_text,
    normalized_question, normalized_answer, content_hash, cohort_number, source_order,
    importance_weight, learning_state, difficulty, stability_days, algorithm_version,
    review_count, correct_count, incorrect_count, lapse_count, successful_relearning_sessions,
    created_at, updated_at
  ) VALUES
  (
    '22222222-2222-2222-2222-000000000001',
    v_user_id,
    v_deck_id,
    1,
    'What is RFC 4180?',
    'The Common Format and MIME Type for Comma-Separated Values (CSV) Files specification.',
    'What is RFC 4180?',
    'The Common Format and MIME Type for Comma-Separated Values (CSV) Files specification.',
    'hash-rfc4180-demo',
    1,
    1,
    1.0,
    'new',
    0,
    0,
    'fsrs-v4',
    0, 0, 0, 0, 0,
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  ),
  (
    '22222222-2222-2222-2222-000000000002',
    v_user_id,
    v_deck_id,
    2,
    'What is FSRS?',
    'Free Spaced Repetition Scheduler, a modern spaced repetition algorithm based on DSR model.',
    'What is FSRS?',
    'Free Spaced Repetition Scheduler, a modern spaced repetition algorithm based on DSR model.',
    'hash-fsrs-demo',
    1,
    2,
    1.0,
    'new',
    0,
    0,
    'fsrs-v4',
    0, 0, 0, 0, 0,
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  ),
  (
    '22222222-2222-2222-2222-000000000003',
    v_user_id,
    v_deck_id,
    3,
    'What is Unicode NFC normalization?',
    'Normalization Form C: Canonical Decomposition, followed by Canonical Composition.',
    'What is Unicode NFC normalization?',
    'Normalization Form C: Canonical Decomposition, followed by Canonical Composition.',
    'hash-nfc-demo',
    1,
    3,
    1.0,
    'new',
    0,
    0,
    'fsrs-v4',
    0, 0, 0, 0, 0,
    '2026-01-01 00:00:00+00',
    '2026-01-01 00:00:00+00'
  )
  ON CONFLICT (id) DO NOTHING;
END $$;
