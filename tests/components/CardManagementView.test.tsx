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
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
      }))
    }))
  }
}));

describe('CardManagementView (MGT-001..MGT-010)', () => {
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
    vi.mocked(supabase.from).mockReturnValue({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: null, error: null }))
        }))
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

  it('MGT-004: Inline editing updates card question and answer', async () => {
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
});
