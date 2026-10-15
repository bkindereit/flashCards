-- Migration: 20261015000001_deck_cascade_deletion.sql
-- Fix DEK-001/DEK-002: Ensure deck deletion cascades to review_events while keeping card_id ON DELETE RESTRICT (DAT-011)

ALTER TABLE public.review_events
    DROP CONSTRAINT IF EXISTS review_events_deck_id_fkey;

ALTER TABLE public.review_events
    ADD CONSTRAINT review_events_deck_id_fkey
    FOREIGN KEY (deck_id) REFERENCES public.decks(id)
    ON DELETE CASCADE;

-- Dedicated RPC for atomic deck and review event deletion
CREATE OR REPLACE FUNCTION public.rpc_delete_deck(p_deck_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.decks WHERE id = p_deck_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Deck not found or access denied';
    END IF;

    -- Delete review events for this deck explicitly first
    DELETE FROM public.review_events WHERE deck_id = p_deck_id AND user_id = v_user_id;

    -- Delete deck (which cascades to cards, study_sessions, import_batches)
    DELETE FROM public.decks WHERE id = p_deck_id AND user_id = v_user_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_delete_deck(UUID) TO authenticated;
