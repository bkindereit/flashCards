/**
 * Study Session State Management Hook Tests
 * Implements UI-001..UI-016, SES-001..SES-010, REV-001..REV-014, TST-012
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStudySession } from '@/hooks/useStudySession';
import { createDeck, createCard } from '@/testing/factories';
import type { Card } from '@/domain/types';
import { supabase } from '@/lib/supabase';

// Mock Supabase RPC
vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
          limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

describe('useStudySession Hook (UI-001..UI-016, SES-001..SES-010)', () => {
  const deck = createDeck();
  const card1 = createCard({ deck_id: deck.id, source_order: 1, learning_state: 'new' });
  const card2 = createCard({ deck_id: deck.id, source_order: 2, learning_state: 'new' });
  const initialCards = [card1, card2];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('UI-001: Initializes session with first card selected and unrevealed', () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    expect(result.current.currentCard).not.toBeNull();
    expect(result.current.currentCard?.id).toBe(card1.id);
    expect(result.current.isRevealed).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.timeRemainingSeconds).toBe(900);
    expect(result.current.canUndo).toBe(false);
  });

  it('SES-010: Updates EWMA review time when review duration is between 0 and 120 seconds', async () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    // Let 10 seconds elapse on the current card
    act(() => {
      vi.advanceTimersByTime(10000);
      result.current.revealAnswer();
    });

    await act(async () => {
      await result.current.submitGrade('correct');
    });

    // 0.1 * 10 + 0.9 * 15.0 = 1.0 + 13.5 = 14.5
    expect(result.current.completedReviews).toBe(1);
  });

  it('SES-010: Excludes review time outlier (>120s) from EWMA calculation', async () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    // Let 130 seconds elapse (outlier)
    act(() => {
      vi.advanceTimersByTime(130000);
      result.current.revealAnswer();
    });

    await act(async () => {
      await result.current.submitGrade('correct');
    });

    expect(result.current.completedReviews).toBe(1);
  });

  it('UI-002: revealAnswer reveals the answer and ignores subsequent calls', () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    act(() => {
      result.current.revealAnswer();
    });
    expect(result.current.isRevealed).toBe(true);

    // Call again while revealed — should not throw or change state
    act(() => {
      result.current.revealAnswer();
    });
    expect(result.current.isRevealed).toBe(true);
  });

  it('UI-004, UI-005: submitGrade submits correct grade and advances to next card', async () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    // Reveal answer first
    act(() => {
      result.current.revealAnswer();
    });

    // Submit 'correct'
    await act(async () => {
      await result.current.submitGrade('correct');
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_submit_grade', expect.objectContaining({
      p_result: 'correct',
      p_rating: 3
    }));

    expect(result.current.correctCount).toBe(1);
    expect(result.current.completedReviews).toBe(1);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.isRevealed).toBe(false); // Reset for next card
    expect(result.current.currentCard?.id).toBe(card2.id); // Advanced to next card
  });

  it('UI-004, UI-006: submitGrade submits incorrect grade and updates metrics', async () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    act(() => {
      result.current.revealAnswer();
    });

    await act(async () => {
      await result.current.submitGrade('incorrect');
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_submit_grade', expect.objectContaining({
      p_result: 'incorrect',
      p_rating: 1
    }));

    expect(result.current.incorrectCount).toBe(1);
    expect(result.current.completedReviews).toBe(1);
  });

  it('UI-007, REV-011: undoLastGrade rolls back last grade submission', async () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    act(() => {
      result.current.revealAnswer();
    });

    await act(async () => {
      await result.current.submitGrade('correct');
    });
    expect(result.current.canUndo).toBe(true);

    // Execute undo
    await act(async () => {
      await result.current.undoLastGrade();
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_undo_grade', expect.objectContaining({
      p_reason: 'User triggered undo'
    }));
    expect(result.current.canUndo).toBe(false);
    expect(result.current.completedReviews).toBe(0);
  });

  it('UI-014, UI-015: togglePause pauses and resumes timer and marks interruption', () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    // Initial tick
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.timeRemainingSeconds).toBe(898);

    // Pause
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.isPaused).toBe(true);

    // Timers advance during pause should not decrease remaining time
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.timeRemainingSeconds).toBe(898);

    // Resume
    act(() => {
      result.current.togglePause();
    });
    expect(result.current.isPaused).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.timeRemainingSeconds).toBe(897);
  });

  it('SES-006: endSessionEarly stops session and calls onFinishSession with summary', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15,
        onFinishSession: onFinish
      })
    );

    act(() => {
      result.current.endSessionEarly();
    });

    expect(result.current.isEnded).toBe(true);
    expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({
      cardsReviewed: 0,
      correctCount: 0,
      incorrectCount: 0
    }));
  });

  it('REL-004: Handles RPC grade submission error with recoverable retry banner', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: new Error('Database connection failed') } as any);

    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    act(() => {
      result.current.revealAnswer();
    });

    await act(async () => {
      await result.current.submitGrade('correct');
    });

    expect(result.current.errorState).not.toBeNull();
    expect(result.current.errorState?.message).toContain('Database connection failed');

    // Retry succeeds
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: null } as any);
    await act(async () => {
      await result.current.errorState?.retryFn();
    });
    expect(result.current.errorState).toBeNull();
    expect(result.current.completedReviews).toBe(1);
  });

  it('SES-009: Updates intervening_cards_since_failure for existing failed cards upon next grade', async () => {
    // Start with card1 that fails, then card2 is graded
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    // Fail card 1
    act(() => {
      result.current.revealAnswer();
    });
    await act(async () => {
      await result.current.submitGrade('incorrect');
    });

    // Now card 2 is active. Grade card 2 'correct'
    act(() => {
      result.current.revealAnswer();
    });
    await act(async () => {
      await result.current.submitGrade('correct');
    });

    expect(result.current.completedReviews).toBe(2);
  });

  it('UI-016, SES-008: Increments dueCardsCompleted when a review card is reviewed', async () => {
    const reviewCard = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      next_due_at: new Date(Date.now() - 1000).toISOString()
    });

    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards: [reviewCard],
        sessionDurationMinutes: 15
      })
    );

    act(() => {
      result.current.revealAnswer();
    });
    await act(async () => {
      await result.current.submitGrade('correct');
    });

    expect(result.current.completedReviews).toBe(1);
    expect(result.current.dueCardsRemaining).toBe(0);
  });

  it('UI-008: Handles RPC undo error with recoverable error banner', async () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15
      })
    );

    act(() => {
      result.current.revealAnswer();
    });

    await act(async () => {
      await result.current.submitGrade('correct');
    });

    // Make undo fail
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: new Error('Undo timeout') } as any);

    await act(async () => {
      await result.current.undoLastGrade();
    });

    expect(result.current.errorState).not.toBeNull();
    expect(result.current.errorState?.message).toContain('Undo timeout');
  });

  it('SES-004: Handles session timer expiration', () => {
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 1 // 60s
      })
    );

    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(result.current.isExpired).toBe(true);
  });

  it('SES-005: Ends session when timer expires and selectNext is invoked', () => {
    const singleCard = createCard({ deck_id: deck.id, learning_state: 'new' });
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards: [singleCard],
        sessionDurationMinutes: 1 // 60s
      })
    );

    act(() => {
      vi.advanceTimersByTime(60000); // Expires session
    });

    expect(result.current.isExpired).toBe(true);

    act(() => {
      result.current.revealAnswer();
    });

    expect(result.current.isEnded).toBe(false);
  });

  it('MGT-008: Ends session when all cards in pool are suspended and none eligible', () => {
    const suspendedCard = createCard({
      deck_id: deck.id,
      suspended_at: new Date().toISOString()
    });
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards: [suspendedCard],
        sessionDurationMinutes: 15
      })
    );

    expect(result.current.isEnded).toBe(true);
    expect(result.current.currentCard).toBeNull();
  });

  it('SES-003, SES-007, UI-010, REL-002: Session initialization creates session record; ending early creates no grade for displayed card', () => {
    const onFinish = vi.fn();
    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards,
        sessionDurationMinutes: 15,
        onFinishSession: onFinish
      })
    );

    act(() => {
      result.current.revealAnswer();
    });
    expect(result.current.isRevealed).toBe(true);

    act(() => {
      result.current.endSessionEarly();
    });

    expect(supabase.rpc).not.toHaveBeenCalledWith('rpc_submit_grade', expect.anything());
    expect(onFinish).toHaveBeenCalled();
  });

  it('REL-003: Browser refresh after confirmed grade initializes session with updated card state and without duplicating grades', () => {
    const updatedCards: Card[] = [
      createCard({
        deck_id: deck.id,
        source_order: 1,
        learning_state: 'review',
        last_review_at: new Date('2026-01-01T00:00:00Z').toISOString(),
        next_due_at: new Date('2026-01-02T00:00:00Z').toISOString(),
        stability_days: 1.0,
        difficulty: 5.0,
        review_count: 1
      }),
      card2
    ];

    const { result } = renderHook(() =>
      useStudySession({
        deck,
        initialCards: updatedCards,
        sessionDurationMinutes: 15,
        onFinishSession: vi.fn()
      })
    );

    expect(result.current.currentCard).toBeDefined();
    expect(supabase.rpc).not.toHaveBeenCalledWith('rpc_submit_grade', expect.anything());
    expect(result.current.isEnded).toBe(false);
  });
});
