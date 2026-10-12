-- 20261010000000_initial_schema.sql
-- Baseline schema for Adaptive Flashcard Application (FCA-SRS-001)

-- Native gen_random_uuid() is built-in in PostgreSQL 13+

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    default_desired_retention DOUBLE PRECISION NOT NULL DEFAULT 0.90 CHECK (default_desired_retention >= 0.70 AND default_desired_retention <= 0.97),
    default_cohort_size INTEGER NOT NULL DEFAULT 10 CHECK (default_cohort_size >= 5 AND default_cohort_size <= 20),
    default_new_learning_fraction DOUBLE PRECISION NOT NULL DEFAULT 0.30 CHECK (default_new_learning_fraction >= 0.00 AND default_new_learning_fraction <= 0.50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Decks Table
CREATE TABLE IF NOT EXISTS public.decks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    exam_date TIMESTAMPTZ,
    desired_retention DOUBLE PRECISION NOT NULL DEFAULT 0.90 CHECK (desired_retention >= 0.70 AND desired_retention <= 0.97),
    cohort_size INTEGER NOT NULL DEFAULT 10 CHECK (cohort_size >= 5 AND cohort_size <= 20),
    new_learning_fraction DOUBLE PRECISION NOT NULL DEFAULT 0.30 CHECK (new_learning_fraction >= 0.00 AND new_learning_fraction <= 0.50),
    min_failed_retry_delay_seconds INTEGER NOT NULL DEFAULT 60 CHECK (min_failed_retry_delay_seconds >= 0),
    min_intervening_cards INTEGER NOT NULL DEFAULT 3 CHECK (min_intervening_cards >= 0),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Import Batches Table
CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    operation_id UUID NOT NULL,
    file_name TEXT,
    total_rows INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    skipped_duplicate_count INTEGER NOT NULL DEFAULT 0,
    rejected_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_batch_user_op UNIQUE (user_id, operation_id)
);

-- 4. Cards Table
CREATE TABLE IF NOT EXISTS public.cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
    source_row_number INTEGER,
    question_text TEXT NOT NULL,
    answer_text TEXT NOT NULL,
    normalized_question TEXT NOT NULL,
    normalized_answer TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    first_imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    suspended_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    cohort_number INTEGER NOT NULL DEFAULT 1,
    source_order INTEGER NOT NULL DEFAULT 1,
    importance_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0 CHECK (importance_weight > 0),
    learning_state TEXT NOT NULL DEFAULT 'new' CHECK (learning_state IN ('new', 'learning', 'review', 'relearning', 'suspended')),
    difficulty DOUBLE PRECISION NOT NULL DEFAULT 0,
    stability_days DOUBLE PRECISION NOT NULL DEFAULT 0,
    last_review_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    last_rating INTEGER,
    algorithm_version TEXT NOT NULL DEFAULT 'fsrs-v4',
    review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    incorrect_count INTEGER NOT NULL DEFAULT 0 CHECK (incorrect_count >= 0),
    lapse_count INTEGER NOT NULL DEFAULT 0 CHECK (lapse_count >= 0),
    last_correct_at TIMESTAMPTZ,
    last_incorrect_at TIMESTAMPTZ,
    successful_relearning_sessions INTEGER NOT NULL DEFAULT 0 CHECK (successful_relearning_sessions >= 0),
    percent_correct DOUBLE PRECISION GENERATED ALWAYS AS (
        CASE WHEN review_count = 0 THEN 0.0 ELSE (correct_count::DOUBLE PRECISION / review_count::DOUBLE PRECISION * 100.0) END
    ) STORED,
    CONSTRAINT chk_card_counter_equality CHECK (correct_count + incorrect_count = review_count),
    CONSTRAINT uq_active_card_hash UNIQUE (user_id, deck_id, content_hash)
);

-- 5. Study Sessions Table
CREATE TABLE IF NOT EXISTS public.study_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL CHECK (duration_seconds >= 60 AND duration_seconds <= 14400),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'ended_early')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    active_duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    settings_snapshot JSONB NOT NULL,
    cards_reviewed INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    new_cards_introduced INTEGER NOT NULL DEFAULT 0,
    due_cards_completed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Session Card State Table
CREATE TABLE IF NOT EXISTS public.session_card_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    has_met_criterion BOOLEAN NOT NULL DEFAULT FALSE,
    has_unresolved_failure BOOLEAN NOT NULL DEFAULT FALSE,
    last_failure_at TIMESTAMPTZ,
    intervening_cards_since_failure INTEGER NOT NULL DEFAULT 0,
    introduced_in_session BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_card UNIQUE (session_id, card_id)
);

-- 7. Review Events Table
CREATE TABLE IF NOT EXISTS public.review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE RESTRICT,
    deck_id UUID NOT NULL REFERENCES public.decks(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.study_sessions(id) ON DELETE SET NULL,
    operation_id UUID NOT NULL,
    shown_at TIMESTAMPTZ NOT NULL,
    revealed_at TIMESTAMPTZ NOT NULL,
    rated_at TIMESTAMPTZ NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('correct', 'incorrect')),
    rating INTEGER NOT NULL,
    valid_duration_seconds DOUBLE PRECISION NOT NULL DEFAULT 0,
    is_interrupted BOOLEAN NOT NULL DEFAULT FALSE,
    pre_learning_state TEXT NOT NULL,
    pre_difficulty DOUBLE PRECISION NOT NULL,
    pre_stability_days DOUBLE PRECISION NOT NULL,
    pre_due_at TIMESTAMPTZ,
    post_learning_state TEXT NOT NULL,
    post_difficulty DOUBLE PRECISION NOT NULL,
    post_stability_days DOUBLE PRECISION NOT NULL,
    post_due_at TIMESTAMPTZ,
    algorithm_version TEXT NOT NULL,
    invalidated_at TIMESTAMPTZ,
    invalidation_reason TEXT,
    superseding_operation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DAT-010 Append-only trigger for review_events
CREATE OR REPLACE FUNCTION public.trg_check_review_event_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.id <> NEW.id OR
        OLD.card_id <> NEW.card_id OR
        OLD.deck_id <> NEW.deck_id OR
        OLD.user_id <> NEW.user_id OR
        OLD.session_id IS DISTINCT FROM NEW.session_id OR
        OLD.operation_id <> NEW.operation_id OR
        OLD.shown_at <> NEW.shown_at OR
        OLD.revealed_at <> NEW.revealed_at OR
        OLD.rated_at <> NEW.rated_at OR
        OLD.result <> NEW.result OR
        OLD.rating <> NEW.rating OR
        OLD.valid_duration_seconds <> NEW.valid_duration_seconds OR
        OLD.is_interrupted <> NEW.is_interrupted OR
        OLD.pre_learning_state <> NEW.pre_learning_state OR
        OLD.pre_difficulty <> NEW.pre_difficulty OR
        OLD.pre_stability_days <> NEW.pre_stability_days OR
        OLD.pre_due_at IS DISTINCT FROM NEW.pre_due_at OR
        OLD.post_learning_state <> NEW.post_learning_state OR
        OLD.post_difficulty <> NEW.post_difficulty OR
        OLD.post_stability_days <> NEW.post_stability_days OR
        OLD.post_due_at IS DISTINCT FROM NEW.post_due_at OR
        OLD.algorithm_version <> NEW.algorithm_version OR
        OLD.created_at <> NEW.created_at) THEN
        RAISE EXCEPTION 'review_events fields are append-only except invalidation metadata';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_review_events_append_only ON public.review_events;
CREATE TRIGGER trg_review_events_append_only
BEFORE UPDATE ON public.review_events
FOR EACH ROW EXECUTE FUNCTION public.trg_check_review_event_append_only();

-- 8. Selection Events Table
CREATE TABLE IF NOT EXISTS public.selection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
    selected_card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    policy_version TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seed TEXT NOT NULL,
    selected_queue TEXT NOT NULL,
    candidate_ids JSONB NOT NULL,
    utility_values JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Grade Operations Table
CREATE TABLE IF NOT EXISTS public.grade_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.study_sessions(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
    review_event_id UUID REFERENCES public.review_events(id) ON DELETE SET NULL,
    result_json JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'undone')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_grade_op UNIQUE (user_id, operation_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cards_deck_user ON public.cards (deck_id, user_id);
CREATE INDEX IF NOT EXISTS idx_cards_due ON public.cards (deck_id, learning_state, next_due_at);
CREATE INDEX IF NOT EXISTS idx_review_events_card ON public.review_events (card_id, rated_at);
CREATE INDEX IF NOT EXISTS idx_review_events_session ON public.review_events (session_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_deck ON public.study_sessions (deck_id, started_at);

-- ROW LEVEL SECURITY (SEC-001, SEC-002, SEC-003)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.session_card_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_card_state FORCE ROW LEVEL SECURITY;
ALTER TABLE public.review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.selection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selection_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.grade_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_operations FORCE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Decks RLS
CREATE POLICY "Users can manage own decks" ON public.decks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Import Batches RLS
CREATE POLICY "Users can manage own import batches" ON public.import_batches
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Cards RLS
CREATE POLICY "Users can manage own cards" ON public.cards
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Study Sessions RLS
CREATE POLICY "Users can manage own sessions" ON public.study_sessions
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Session Card State RLS
CREATE POLICY "Users can manage own session card state" ON public.session_card_state
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Review Events RLS
CREATE POLICY "Users can view own review events" ON public.review_events
    FOR SELECT USING (auth.uid() = user_id);

-- Selection Events RLS
CREATE POLICY "Users can manage own selection events" ON public.selection_events
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Grade Operations RLS
CREATE POLICY "Users can view own grade operations" ON public.grade_operations
    FOR SELECT USING (auth.uid() = user_id);

-- RPC FUNCTIONS (ARC-008, SEC-005, SEC-006, REV-001..REV-013)

-- 1. submit_grade RPC
CREATE OR REPLACE FUNCTION public.rpc_submit_grade(
    p_operation_id UUID,
    p_session_id UUID,
    p_card_id UUID,
    p_rating INTEGER,
    p_result TEXT,
    p_shown_at TIMESTAMPTZ,
    p_revealed_at TIMESTAMPTZ,
    p_rated_at TIMESTAMPTZ,
    p_valid_duration DOUBLE PRECISION,
    p_is_interrupted BOOLEAN,
    p_post_state JSONB,
    p_algorithm_version TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_card RECORD;
    v_existing_op RECORD;
    v_review_event_id UUID;
    v_result_json JSONB;
    v_new_lapse_count INTEGER;
    v_is_lapse BOOLEAN := FALSE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- Check idempotency (REV-004, REL-001)
    SELECT * INTO v_existing_op FROM public.grade_operations
    WHERE user_id = v_user_id AND operation_id = p_operation_id;

    IF FOUND THEN
        RETURN v_existing_op.result_json;
    END IF;

    -- Fetch and lock card row
    SELECT * INTO v_card FROM public.cards
    WHERE id = p_card_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Card not found or access denied';
    END IF;

    -- Determine lapse (REV-007)
    IF v_card.learning_state = 'review' AND p_result = 'incorrect' THEN
        v_is_lapse := TRUE;
        v_new_lapse_count := v_card.lapse_count + 1;
    ELSE
        v_new_lapse_count := v_card.lapse_count;
    END IF;

    -- Insert Review Event (REV-003, DAT-009, DAT-010)
    INSERT INTO public.review_events (
        card_id, deck_id, user_id, session_id, operation_id,
        shown_at, revealed_at, rated_at, result, rating,
        valid_duration_seconds, is_interrupted,
        pre_learning_state, pre_difficulty, pre_stability_days, pre_due_at,
        post_learning_state, post_difficulty, post_stability_days, post_due_at,
        algorithm_version
    ) VALUES (
        v_card.id, v_card.deck_id, v_user_id, p_session_id, p_operation_id,
        p_shown_at, p_revealed_at, p_rated_at, p_result, p_rating,
        p_valid_duration, p_is_interrupted,
        v_card.learning_state, v_card.difficulty, v_card.stability_days, v_card.next_due_at,
        (p_post_state->>'learning_state'), (p_post_state->>'difficulty')::DOUBLE PRECISION,
        (p_post_state->>'stability_days')::DOUBLE PRECISION, (p_post_state->>'next_due_at')::TIMESTAMPTZ,
        p_algorithm_version
    ) RETURNING id INTO v_review_event_id;

    -- Update Card State (REV-005, REV-006, REV-007, REV-008)
    UPDATE public.cards SET
        learning_state = (p_post_state->>'learning_state'),
        difficulty = (p_post_state->>'difficulty')::DOUBLE PRECISION,
        stability_days = (p_post_state->>'stability_days')::DOUBLE PRECISION,
        next_due_at = (p_post_state->>'next_due_at')::TIMESTAMPTZ,
        last_review_at = p_rated_at,
        last_rating = p_rating,
        algorithm_version = p_algorithm_version,
        review_count = v_card.review_count + 1,
        correct_count = CASE WHEN p_result = 'correct' THEN v_card.correct_count + 1 ELSE v_card.correct_count END,
        incorrect_count = CASE WHEN p_result = 'incorrect' THEN v_card.incorrect_count + 1 ELSE v_card.incorrect_count END,
        lapse_count = v_new_lapse_count,
        last_correct_at = CASE WHEN p_result = 'correct' THEN p_rated_at ELSE v_card.last_correct_at END,
        last_incorrect_at = CASE WHEN p_result = 'incorrect' THEN p_rated_at ELSE v_card.last_incorrect_at END,
        updated_at = NOW()
    WHERE id = v_card.id;

    -- Update session metrics
    UPDATE public.study_sessions SET
        cards_reviewed = cards_reviewed + 1,
        correct_count = CASE WHEN p_result = 'correct' THEN correct_count + 1 ELSE correct_count END,
        incorrect_count = CASE WHEN p_result = 'incorrect' THEN incorrect_count + 1 ELSE incorrect_count END,
        active_duration_seconds = active_duration_seconds + p_valid_duration
    WHERE id = p_session_id AND user_id = v_user_id;

    v_result_json := jsonb_build_object(
        'success', true,
        'review_event_id', v_review_event_id,
        'operation_id', p_operation_id,
        'card_id', p_card_id,
        'rated_at', p_rated_at,
        'is_lapse', v_is_lapse
    );

    -- Record in grade operations
    INSERT INTO public.grade_operations (
        operation_id, user_id, session_id, card_id, review_event_id, result_json
    ) VALUES (
        p_operation_id, v_user_id, p_session_id, p_card_id, v_review_event_id, v_result_json
    );

    RETURN v_result_json;
END;
$$;

-- 2. undo_grade RPC (REV-011, REV-012, REV-013)
CREATE OR REPLACE FUNCTION public.rpc_undo_grade(
    p_undo_operation_id UUID,
    p_session_id UUID,
    p_target_operation_id UUID,
    p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_target_op RECORD;
    v_event RECORD;
    v_later_op_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- Fetch target operation
    SELECT * INTO v_target_op FROM public.grade_operations
    WHERE user_id = v_user_id AND session_id = p_session_id AND operation_id = p_target_operation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target operation not found';
    END IF;

    IF v_target_op.status = 'undone' THEN
        RETURN jsonb_build_object('success', true, 'already_undone', true);
    END IF;

    -- REV-013: Undo shall be rejected after another grade has committed in the same session
    SELECT COUNT(*) INTO v_later_op_count FROM public.grade_operations
    WHERE user_id = v_user_id AND session_id = p_session_id AND created_at > v_target_op.created_at AND status = 'committed';

    IF v_later_op_count > 0 THEN
        RAISE EXCEPTION 'Cannot undo: another grade has committed since target operation';
    END IF;

    -- Fetch review event
    SELECT * INTO v_event FROM public.review_events
    WHERE id = v_target_op.review_event_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Review event not found';
    END IF;

    -- Restore Card (REV-011)
    UPDATE public.cards SET
        learning_state = v_event.pre_learning_state,
        difficulty = v_event.pre_difficulty,
        stability_days = v_event.pre_stability_days,
        next_due_at = v_event.pre_due_at,
        review_count = review_count - 1,
        correct_count = CASE WHEN v_event.result = 'correct' THEN correct_count - 1 ELSE correct_count END,
        incorrect_count = CASE WHEN v_event.result = 'incorrect' THEN incorrect_count - 1 ELSE incorrect_count END,
        lapse_count = CASE WHEN v_event.pre_learning_state = 'review' AND v_event.result = 'incorrect' THEN lapse_count - 1 ELSE lapse_count END,
        updated_at = NOW()
    WHERE id = v_event.card_id;

    -- Update review event invalidation metadata (REV-012, DAT-010)
    UPDATE public.review_events SET
        invalidated_at = NOW(),
        invalidation_reason = p_reason,
        superseding_operation_id = p_undo_operation_id
    WHERE id = v_event.id;

    -- Mark grade operation undone
    UPDATE public.grade_operations SET status = 'undone'
    WHERE id = v_target_op.id;

    -- Update session metrics
    UPDATE public.study_sessions SET
        cards_reviewed = cards_reviewed - 1,
        correct_count = CASE WHEN v_event.result = 'correct' THEN correct_count - 1 ELSE correct_count END,
        incorrect_count = CASE WHEN v_event.result = 'incorrect' THEN incorrect_count - 1 ELSE incorrect_count END,
        active_duration_seconds = active_duration_seconds - v_event.valid_duration_seconds
    WHERE id = p_session_id AND user_id = v_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'undone_operation_id', p_target_operation_id,
        'card_id', v_event.card_id
    );
END;
$$;

-- 3. commit_import RPC (IMP-009..IMP-016)
CREATE OR REPLACE FUNCTION public.rpc_commit_import(
    p_operation_id UUID,
    p_deck_id UUID,
    p_file_name TEXT,
    p_total_rows INTEGER,
    p_cards JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_deck RECORD;
    v_existing_batch RECORD;
    v_batch_id UUID;
    v_item JSONB;
    v_inserted INTEGER := 0;
    v_skipped INTEGER := 0;
    v_rejected INTEGER := 0;
    v_now TIMESTAMPTZ := NOW();
    v_hash TEXT;
    v_exists BOOLEAN;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthenticated';
    END IF;

    -- Idempotency check (IMP-016)
    SELECT * INTO v_existing_batch FROM public.import_batches
    WHERE user_id = v_user_id AND operation_id = p_operation_id;

    IF FOUND THEN
        RETURN jsonb_build_object(
            'success', true,
            'import_batch_id', v_existing_batch.id,
            'inserted_count', v_existing_batch.inserted_count,
            'skipped_duplicate_count', v_existing_batch.skipped_duplicate_count,
            'rejected_count', v_existing_batch.rejected_count
        );
    END IF;

    SELECT * INTO v_deck FROM public.decks
    WHERE id = p_deck_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Deck not found or access denied';
    END IF;

    INSERT INTO public.import_batches (
        user_id, deck_id, operation_id, file_name, total_rows
    ) VALUES (
        v_user_id, p_deck_id, p_operation_id, p_file_name, p_total_rows
    ) RETURNING id INTO v_batch_id;

    -- Process cards
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_cards)
    LOOP
        v_hash := v_item->>'content_hash';

        -- Check duplicate in deck (IMP-010, IMP-011, IMP-012)
        SELECT EXISTS (
            SELECT 1 FROM public.cards
            WHERE user_id = v_user_id AND deck_id = p_deck_id AND content_hash = v_hash
        ) INTO v_exists;

        IF v_exists THEN
            v_skipped := v_skipped + 1;
        ELSE
            INSERT INTO public.cards (
                user_id, deck_id, import_batch_id, source_row_number,
                question_text, answer_text, normalized_question, normalized_answer,
                content_hash, first_imported_at, cohort_number, source_order,
                learning_state
            ) VALUES (
                v_user_id, p_deck_id, v_batch_id, (v_item->>'source_row_number')::INTEGER,
                (v_item->>'question_text'), (v_item->>'answer_text'),
                (v_item->>'normalized_question'), (v_item->>'normalized_answer'),
                v_hash, v_now, (v_item->>'cohort_number')::INTEGER,
                (v_item->>'source_order')::INTEGER, 'new'
            );
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;

    -- Update counts in batch record
    UPDATE public.import_batches SET
        inserted_count = v_inserted,
        skipped_duplicate_count = v_skipped,
        rejected_count = v_rejected
    WHERE id = v_batch_id;

    RETURN jsonb_build_object(
        'success', true,
        'import_batch_id', v_batch_id,
        'inserted_count', v_inserted,
        'skipped_duplicate_count', v_skipped,
        'rejected_count', v_rejected
    );
END;
$$;
