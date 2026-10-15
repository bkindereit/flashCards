/**
 * ProgressDashboardView Component Tests
 * Implements PRG-001..PRG-006, VA-PRG-001, VA-PRG-002, ACC-008
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProgressDashboardView } from '@/components/ProgressDashboardView';
import { createDeck, createCard } from '@/testing/factories';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn()
  }
}));

describe('ProgressDashboardView (PRG-001..PRG-006, VA-PRG-001..002)', () => {
  const deckA = createDeck({
    id: 'deck-a',
    name: 'Biochemistry 101',
    exam_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 10 days in future
  });

  const deckB = createDeck({
    id: 'deck-b',
    name: 'Neuroscience',
    exam_date: null
  });

  const now = new Date();
  const todayStr = now.toISOString();
  const yesterdayStr = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgoStr = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const tomorrowStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

  const card1 = createCard({
    id: 'c1',
    deck_id: 'deck-a',
    question_text: 'What is ATP synthase?',
    answer_text: 'Enzyme catalyzing ATP synthesis from ADP and Pi',
    learning_state: 'review',
    review_count: 8,
    correct_count: 7,
    incorrect_count: 1,
    lapse_count: 1,
    next_due_at: todayStr
  });

  const card2 = createCard({
    id: 'c2',
    deck_id: 'deck-a',
    question_text: 'What is the rate-limiting enzyme in glycolysis?',
    answer_text: 'Phosphofructokinase-1 (PFK-1)',
    learning_state: 'learning',
    review_count: 4,
    correct_count: 2,
    incorrect_count: 2,
    lapse_count: 2,
    next_due_at: tomorrowStr
  });

  const card3 = createCard({
    id: 'c3',
    deck_id: 'deck-a',
    question_text: 'What is pyruvate dehydrogenase?',
    answer_text: 'Enzyme converting pyruvate to acetyl-CoA',
    learning_state: 'new',
    review_count: 0,
    correct_count: 0,
    incorrect_count: 0,
    lapse_count: 0,
    next_due_at: null
  });

  const card4 = createCard({
    id: 'c4',
    deck_id: 'deck-b',
    question_text: 'What is the resting membrane potential of a neuron?',
    answer_text: 'Approximately -70 mV',
    learning_state: 'relearning',
    review_count: 6,
    correct_count: 3,
    incorrect_count: 3,
    lapse_count: 3,
    next_due_at: todayStr
  });

  const card5 = createCard({
    id: 'c5',
    deck_id: 'deck-b',
    question_text: 'What is the function of astrocytes?',
    answer_text: 'Support blood-brain barrier and synaptic homeostasis',
    learning_state: 'suspended',
    suspended_at: todayStr,
    review_count: 2,
    correct_count: 1,
    incorrect_count: 1,
    lapse_count: 1,
    next_due_at: null
  });

  const mockSessions = [
    {
      id: 's1',
      deck_id: 'deck-a',
      started_at: todayStr,
      active_duration_seconds: 600, // 10 minutes
      cards_reviewed: 10,
      correct_count: 8,
      incorrect_count: 2
    },
    {
      id: 's2',
      deck_id: 'deck-b',
      started_at: yesterdayStr,
      active_duration_seconds: 900, // 15 minutes
      cards_reviewed: 12,
      correct_count: 9,
      incorrect_count: 3
    },
    {
      id: 's3',
      deck_id: 'deck-a',
      started_at: twoDaysAgoStr,
      active_duration_seconds: 300, // 5 minutes
      cards_reviewed: 5,
      correct_count: 4,
      incorrect_count: 1
    }
  ];

  const mockReviewEvents = [
    { card_id: 'c1', deck_id: 'deck-a', result: 'correct' as const, rated_at: todayStr },
    { card_id: 'c2', deck_id: 'deck-a', result: 'incorrect' as const, rated_at: todayStr },
    { card_id: 'c4', deck_id: 'deck-b', result: 'correct' as const, rated_at: yesterdayStr },
    { card_id: 'c4', deck_id: 'deck-b', result: 'correct' as const, rated_at: twoDaysAgoStr }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'cards') {
        return {
          select: vi.fn(() => Promise.resolve({ data: [card1, card2, card3, card4, card5], error: null }))
        } as any;
      }
      if (table === 'study_sessions') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockSessions, error: null }))
          }))
        } as any;
      }
      if (table === 'review_events') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({ data: mockReviewEvents, error: null }))
          }))
        } as any;
      }
      return {
        select: vi.fn(() => Promise.resolve({ data: [], error: null }))
      } as any;
    });
  });

  it('PRG-001: Renders deck mastery breakdown segmented by new, learning, review, and suspended states', async () => {
    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA, deckB]} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Deck Mastery Breakdown')).toBeInTheDocument();
    });

    // 5 total cards: 1 review (mature), 1 learning, 1 relearning (lapsed), 1 new, 1 suspended
    expect(screen.getByText('5 total cards')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: /deck mastery progress/i })).toBeInTheDocument();
    expect(screen.getByText('Mature:')).toBeInTheDocument();
    expect(screen.getByText('Learning:')).toBeInTheDocument();
    expect(screen.getByText('Lapsed:')).toBeInTheDocument();
    expect(screen.getByText('New:')).toBeInTheDocument();
    expect(screen.getByText('Suspended:')).toBeInTheDocument();
  });

  it('PRG-002: Displays true recall accuracy percentage, total cards reviewed, and total active study minutes', async () => {
    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA, deckB]} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('True Accuracy')).toBeInTheDocument();
    });

    // mockReviewEvents has 4 events: 3 correct, 1 incorrect => 75% accuracy
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('3 of 4 correct')).toBeInTheDocument();

    // Total active duration: 600 + 900 + 300 = 1800s => 30 minutes
    expect(screen.getByText('Time Spent')).toBeInTheDocument();
    expect(screen.getByText('3 total sessions')).toBeInTheDocument();
  });

  it('PRG-003: Computes and renders daily study streak and 28-day daily activity history visualizer', async () => {
    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA, deckB]} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Daily Streak')).toBeInTheDocument();
    });

    // Today, yesterday, two days ago all have activity => streak is at least 3
    expect(screen.getByText('Study Activity (Last 4 Weeks)')).toBeInTheDocument();
    expect(screen.getByText(/3 Day Streak/)).toBeInTheDocument();
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('PRG-004: Displays upcoming 7-day due forecast with daily counts and bar chart', async () => {
    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA, deckB]} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('Upcoming 7-Day Due Forecast')).toBeInTheDocument();
    });

    // card1 and card4 due today => at least 2 due today
    expect(screen.getByText(/Due Today/i)).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Tmrw')).toBeInTheDocument();
  });

  it('PRG-005: Displays exam target countdown, required daily pace, and curriculum progress for deck with exam date', async () => {
    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA, deckB]} initialDeckId="deck-a" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/Target Exam Date:/i)).toBeInTheDocument();
    });

    expect(screen.getByText('Exam Target')).toBeInTheDocument();
    expect(screen.getByText('Time remaining')).toBeInTheDocument();
    expect(screen.getByText('Required Daily Pace')).toBeInTheDocument();
    expect(screen.getByText('Curriculum Introduction Progress')).toBeInTheDocument();
    expect(screen.getByText(/of deck started/i)).toBeInTheDocument();
  });

  it('PRG-006: Displays trouble spots / difficult cards with collapsible answer and practice trigger', async () => {
    const onBack = vi.fn();
    const onStudyDeck = vi.fn();

    render(
      <ProgressDashboardView
        decks={[deckA, deckB]}
        initialDeckId="deck-a"
        onBack={onBack}
        onStudyDeck={onStudyDeck}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Trouble Spots — Difficult Cards')).toBeInTheDocument();
    });

    // card2 has 2 lapses in deck-a
    expect(screen.getByText('What is the rate-limiting enzyme in glycolysis?')).toBeInTheDocument();
    expect(screen.getByText(/2 Lapses/i)).toBeInTheDocument();

    // Answer should initially be collapsed
    expect(screen.queryByText(/Phosphofructokinase-1/)).not.toBeInTheDocument();

    // Click "Show answer" on first matching card
    const showAnswerBtns = screen.getAllByRole('button', { name: /show answer/i });
    fireEvent.click(showAnswerBtns[0]!);

    expect(screen.getByText(/Phosphofructokinase-1/)).toBeInTheDocument();

    // Click Practice button
    const practiceBtns = screen.getAllByRole('button', { name: /practice deck biochemistry 101/i });
    fireEvent.click(practiceBtns[0]!);
    expect(onStudyDeck).toHaveBeenCalledWith(deckA);
  });

  it('PRG-001..PRG-006: Filter by deck updates dashboard metrics to selected deck', async () => {
    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA, deckB]} onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText('5 total cards')).toBeInTheDocument();
    });

    const deckSelect = screen.getByRole('combobox', { name: /filter learning progress by deck/i });
    fireEvent.change(deckSelect, { target: { value: 'deck-a' } });

    // deck-a has 3 cards (card1, card2, card3)
    await waitFor(() => {
      expect(screen.getByText('3 total cards')).toBeInTheDocument();
    });
  });

  it('PRG-006: Shows empty state when no difficult cards exist', async () => {
    // Return cards with 0 lapses and 0 incorrect
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === 'cards') {
        const cleanCard = createCard({
          deck_id: 'deck-a',
          lapse_count: 0,
          incorrect_count: 0
        });
        return {
          select: vi.fn(() => Promise.resolve({ data: [cleanCard], error: null }))
        } as any;
      }
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      } as any;
    });

    const onBack = vi.fn();
    render(<ProgressDashboardView decks={[deckA]} initialDeckId="deck-a" onBack={onBack} />);

    await waitFor(() => {
      expect(screen.getByText(/no frequently lapsed or trouble cards found/i)).toBeInTheDocument();
    });
  });
});
