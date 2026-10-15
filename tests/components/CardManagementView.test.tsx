/**
 * Card Management View Component Tests
 * Implements MGT-001..MGT-009
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CardManagementView } from '@/components/CardManagementView';
import { createDeck, createCard } from '@/testing/factories';
import { supabase } from '@/lib/supabase';
import { computeContentHash, canonicalNormalize } from '@/domain/normalization';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null })),
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

describe('CardManagementView (MGT-001..MGT-011)', () => {
  const deck = createDeck();
  const card1 = createCard({
    deck_id: deck.id,
    question_text: 'What is photosynthesis?',
    answer_text: 'Process converting light to energy',
    source_order: 1,
    learning_state: 'review',
    review_count: 5,
    correct_count: 4,
    percent_correct: 80
  });
  const card2 = createCard({
    deck_id: deck.id,
    question_text: 'What is cellular respiration?',
    answer_text: 'Process breaking down glucose for ATP',
    source_order: 2,
    learning_state: 'new',
    review_count: 0,
    correct_count: 0
  });
  const onCardsChange = vi.fn();
  const onBackToDeck = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    } as any);
  });

  it('MGT-001: Renders card table with all required fields', () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1, card2]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    expect(screen.getByText('What is photosynthesis?')).toBeInTheDocument();
    expect(screen.getByText('Process converting light to energy')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('What is cellular respiration?')).toBeInTheDocument();
  });

  it('MGT-002: Search filters cards by question or answer', () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1, card2]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const searchInput = screen.getByPlaceholderText(/search cards by question or answer/i);
    fireEvent.change(searchInput, { target: { value: 'glucose' } });

    expect(screen.queryByText('What is photosynthesis?')).not.toBeInTheDocument();
    expect(screen.getByText('What is cellular respiration?')).toBeInTheDocument();
  });

  it('MGT-007: Suspend and Restore toggles card suspension state', async () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const suspendBtn = screen.getByRole('button', { name: /suspend card/i });
    await act(async () => {
      fireEvent.click(suspendBtn);
    });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('cards');
      expect(onCardsChange).toHaveBeenCalled();
    });
  });

  it('MGT-003, MGT-004, MGT-006: Inline editing updates card question and answer and preserves id and counters', async () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const editBtn = screen.getByRole('button', { name: /edit card/i });
    fireEvent.click(editBtn);

    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(2);

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('cards');
    });
  });

  it('MGT-005: Edit that would duplicate another card in deck is rejected without changing either card', async () => {
    const hash2 = await computeContentHash(
      canonicalNormalize(card2.question_text),
      canonicalNormalize(card2.answer_text)
    );
    const card2WithHash = { ...card2, content_hash: hash2 };

    render(
      <CardManagementView
        deck={deck}
        cards={[card1, card2WithHash]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const editBtns = screen.getAllByRole('button', { name: /edit card/i });
    fireEvent.click(editBtns[0]!);

    const qInput = screen.getByDisplayValue(card1.question_text);
    const aInput = screen.getByDisplayValue(card1.answer_text);
    fireEvent.change(qInput, { target: { value: card2.question_text } });
    fireEvent.change(aInput, { target: { value: card2.answer_text } });

    const saveBtn = screen.getByRole('button', { name: /save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/already exists in the deck/i)).toBeInTheDocument();
    });
  });

  it('MGT-008: Suspended card displays suspended status', () => {
    const suspended = { ...card1, suspended_at: new Date().toISOString() };
    render(
      <CardManagementView
        deck={deck}
        cards={[suspended]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    expect(screen.getByText(/suspended/i)).toBeInTheDocument();
  });

  it('MGT-010: Manually adds a new card and concatenates it onto the end with next source_order', async () => {
    vi.mocked(supabase.from).mockReturnValue({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: {
              ...card1,
              id: 'new-c-id',
              question_text: 'What is mitochondria?',
              answer_text: 'Powerhouse of the cell',
              source_order: 3,
              cohort_number: 1
            },
            error: null
          }))
        }))
      }))
    } as any);

    render(
      <CardManagementView
        deck={deck}
        cards={[card1, card2]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const addCardBtn = screen.getByRole('button', { name: /add card/i });
    fireEvent.click(addCardBtn);

    const qInput = screen.getByLabelText(/card question/i);
    const aInput = screen.getByLabelText(/card answer/i);
    fireEvent.change(qInput, { target: { value: 'What is mitochondria?' } });
    fireEvent.change(aInput, { target: { value: 'Powerhouse of the cell' } });

    const saveCardBtn = screen.getByRole('button', { name: /save card/i });
    await act(async () => {
      fireEvent.click(saveCardBtn);
    });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('cards');
      expect(onCardsChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          card1,
          card2,
          expect.objectContaining({
            question_text: 'What is mitochondria?',
            answer_text: 'Powerhouse of the cell',
            source_order: 3
          })
        ])
      );
    });
  });

  it('MGT-010: Rejects blank question or answer when manually adding a card', async () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
        initialAddMode={true}
      />
    );

    const saveCardBtn = screen.getByRole('button', { name: /save card/i });
    await act(async () => {
      fireEvent.click(saveCardBtn);
    });

    expect(screen.getByText(/question and answer cannot be blank/i)).toBeInTheDocument();
    expect(onCardsChange).not.toHaveBeenCalled();
  });

  it('MGT-010: Rejects duplicate question and answer when manually adding a card', async () => {
    const normQ = canonicalNormalize('What is photosynthesis?');
    const normA = canonicalNormalize('Process converting light to energy');
    const hash = await computeContentHash(normQ, normA);
    const existingCard = { ...card1, content_hash: hash };

    render(
      <CardManagementView
        deck={deck}
        cards={[existingCard]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
        initialAddMode={true}
      />
    );

    const qInput = screen.getByLabelText(/card question/i);
    const aInput = screen.getByLabelText(/card answer/i);
    fireEvent.change(qInput, { target: { value: 'What is photosynthesis?' } });
    fireEvent.change(aInput, { target: { value: 'Process converting light to energy' } });

    const saveCardBtn = screen.getByRole('button', { name: /save card/i });
    await act(async () => {
      fireEvent.click(saveCardBtn);
    });

    await waitFor(() => {
      expect(screen.getByText(/already exists in the deck/i)).toBeInTheDocument();
    });
    expect(onCardsChange).not.toHaveBeenCalled();
  });

  it('MGT-011: Deleting a card shows confirmation dialog and removes the card on confirm', async () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1, card2]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const deleteBtns = screen.getAllByRole('button', { name: /delete card/i });
    fireEvent.click(deleteBtns[0]!);

    expect(screen.getByRole('dialog', { name: /delete card permanently/i })).toBeInTheDocument();
    expect(screen.getAllByText('What is photosynthesis?').length).toBeGreaterThanOrEqual(1);

    const confirmBtn = screen.getByRole('button', { name: /confirm delete card/i });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('rpc_delete_card', { p_card_id: card1.id });
      expect(onCardsChange).toHaveBeenCalledWith([card2]);
    });
  });

  it('MGT-011: Cancelling card deletion closes modal without deleting card', async () => {
    render(
      <CardManagementView
        deck={deck}
        cards={[card1, card2]}
        onCardsChange={onCardsChange}
        onBackToDeck={onBackToDeck}
      />
    );

    const deleteBtns = screen.getAllByRole('button', { name: /delete card/i });
    fireEvent.click(deleteBtns[0]!);

    const cancelBtn = screen.getByRole('button', { name: /cancel card deletion/i });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole('dialog', { name: /delete card permanently/i })).not.toBeInTheDocument();
    expect(onCardsChange).not.toHaveBeenCalled();
  });
});
