/**
 * Deck Modals Component Tests
 * Implements DEK-001..DEK-009
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DeckModal } from '@/components/DeckModal';
import { DeleteDeckConfirmationModal } from '@/components/DeleteDeckConfirmationModal';
import { createDeck } from '@/testing/factories';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null }))
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: 'd1', name: 'New Deck' }, error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'd1', name: 'Updated Deck' }, error: null }))
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

describe('DeckModal & DeleteDeckConfirmationModal (DEK-001..DEK-009)', () => {
  const onSaved = vi.fn();
  const onClose = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DEK-001: Renders Create Deck form with required fields and defaults', () => {
    render(
      <DeckModal
        isOpen={true}
        deckToEdit={null}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    expect(screen.getByRole('heading', { name: /create new deck/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/deck name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/desired retention/i)).toHaveValue('0.9');
    expect(screen.getByLabelText(/cohort size/i)).toHaveValue(10);
  });

  it('DEK-001: Validates required deck name', async () => {
    render(
      <DeckModal
        isOpen={true}
        deckToEdit={null}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    const form = screen.getByRole('button', { name: /save deck/i }).closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });

    expect(screen.getByText(/deck name is required/i)).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('DEK-001: Submits new deck to supabase and calls onSaved', async () => {
    render(
      <DeckModal
        isOpen={true}
        deckToEdit={null}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    const nameInput = screen.getByLabelText(/deck name/i);
    fireEvent.change(nameInput, { target: { value: 'Biology 101' } });

    const submitBtn = screen.getByRole('button', { name: /save deck/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(supabase.from).toHaveBeenCalledWith('decks');
    expect(onSaved).toHaveBeenCalled();
  });

  it('DEK-002: DeleteDeckConfirmationModal enforces typing exact deck name to enable delete', async () => {
    const deck = createDeck({ name: 'Spanish Vocab' });

    render(
      <DeleteDeckConfirmationModal
        isOpen={true}
        deckName={deck.name}
        onClose={onClose}
        onConfirmDelete={onDelete}
      />
    );

    const deleteBtn = screen.getByRole('button', { name: /delete deck/i });
    // Initially disabled
    expect(deleteBtn).toBeDisabled();

    const input = screen.getByLabelText(/confirm deck name for permanent deletion/i);
    // Wrong name
    fireEvent.change(input, { target: { value: 'Wrong Name' } });
    expect(deleteBtn).toBeDisabled();

    // Exact name
    fireEvent.change(input, { target: { value: 'Spanish Vocab' } });
    expect(deleteBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(onDelete).toHaveBeenCalled();
  });

  it('DEK-002: DeleteDeckConfirmationModal renders error banner and displays loading state during deletion', () => {
    const { rerender } = render(
      <DeleteDeckConfirmationModal
        isOpen={true}
        deckName="Spanish Vocab"
        error="Cannot delete deck with active foreign key references"
        isDeleting={false}
        onClose={onClose}
        onConfirmDelete={onDelete}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/cannot delete deck/i);

    rerender(
      <DeleteDeckConfirmationModal
        isOpen={true}
        deckName="Spanish Vocab"
        error={null}
        isDeleting={true}
        onClose={onClose}
        onConfirmDelete={onDelete}
      />
    );

    expect(screen.getByRole('button', { name: /deleting\.\.\./i })).toBeDisabled();
    expect(screen.getByLabelText(/cancel deletion/i)).toBeDisabled();
  });

  it('DEK-009: Edit existing deck updates fields and submits via update RPC', async () => {
    const existingDeck = createDeck({
      id: 'deck-edit-1',
      name: 'Existing Bio',
      description: 'Old Description',
      exam_date: '2026-12-01T00:00:00Z',
      desired_retention: 0.85,
      cohort_size: 15
    });

    render(
      <DeckModal
        isOpen={true}
        deckToEdit={existingDeck}
        onClose={onClose}
        onSaved={onSaved}
      />
    );

    expect(screen.getByRole('heading', { name: /deck settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/deck name/i)).toHaveValue('Existing Bio');
    expect(screen.getByLabelText(/description/i)).toHaveValue('Old Description');

    const nameInput = screen.getByLabelText(/deck name/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Bio Deck' } });

    const submitBtn = screen.getByRole('button', { name: /save deck/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(supabase.from).toHaveBeenCalledWith('decks');
    expect(onSaved).toHaveBeenCalled();
  });

  it('Renders null when isOpen is false', () => {
    const { container: c1 } = render(
      <DeckModal isOpen={false} deckToEdit={null} onClose={onClose} onSaved={onSaved} />
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <DeleteDeckConfirmationModal isOpen={false} deckName="Test" onClose={onClose} onConfirmDelete={onDelete} />
    );
    expect(c2.firstChild).toBeNull();
  });
});
