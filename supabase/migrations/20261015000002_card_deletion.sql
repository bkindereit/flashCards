-- Migration: 20261015000002_card_deletion.sql
-- MGT-011: Enable deleting a card from a deck, cleanly removing associated review events and session states

CREATE OR REPLACE FUNCTION public.rpc_delete_card(p_card_id UUID)
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
    IF NOT EXISTS (SELECT 1 FROM public.cards WHERE id = p_card_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Card not found or access denied';
    END IF;

    -- Delete review events for this card explicitly first to satisfy foreign key ON DELETE RESTRICT
    DELETE FROM public.review_events WHERE card_id = p_card_id AND user_id = v_user_id;

    -- Delete the card (cascades to session_card_state, selection_events, grade_operations)
    DELETE FROM public.cards WHERE id = p_card_id AND user_id = v_user_id;

    RETURN TRUE;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT EXECUTE ON FUNCTION public.rpc_delete_card(UUID) TO authenticated;
    END IF;
END $$;
