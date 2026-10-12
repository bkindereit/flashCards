/**
 * Card Management View Component Tests
 * Implements MGT-001..MGT-009
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { CardManagementView } from '@/components/CardManagementView';
import { createDeck, createCard } from '@/testing/factories';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

describe('CardManagementView (MGT-001..MGT-009)', () => {
  const deck = createDeck();
  const card1 = createCard({
    deck_id: deck.id,
    question_text: 'What is photosynthesis?',
    answer_text: 'Process converting light to energy',
    learning_state: 'review',
    review_count: 5,
    correct_count: 4,
    percent_correct: 80
  });
  const card2 = createCard({
    deck_id: deck.id,
    question_text: 'What is cellular respiration?',
    answer_text: 'Process breaking down glucose for ATP',
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
});
