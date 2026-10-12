/**
 * Additional coverage tests for normalization, fsrsService, and scheduler
 * Targeting uncovered branches to meet TST-012 thresholds
 */

import { describe, it, expect } from 'vitest';
import { canonicalNormalize } from '@/domain/normalization';
import { FsrsService } from '@/domain/fsrsService';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import { FixedClock, SeededRandom } from '@/domain/clock';
import { createCard, createDeck, createStudySession, createSessionCardState } from '@/testing/factories';

// ── Normalization edge cases (lines 17-18: null/undefined guard) ────────────

describe('canonicalNormalize edge cases', () => {
  it('handles null input via the null-check guard', () => {
    // TypeScript guard: cast to any to exercise null/undefined branch at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(canonicalNormalize(null as any)).toBe('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(canonicalNormalize(undefined as any)).toBe('');
  });

  it('handles empty string', () => {
    expect(canonicalNormalize('')).toBe('');
  });

  it('normalizes CR-only line endings', () => {
    expect(canonicalNormalize('A\rB')).toBe('A\nB');
  });

  it('preserves internal multiline content with trailing newlines stripped', () => {
    expect(canonicalNormalize('Line A\n\nLine B\n')).toBe('Line A\n\nLine B');
  });

  it('BOM not removed from non-first field position', () => {
    const bom = '\uFEFFtext';
    expect(canonicalNormalize(bom, false)).toBe('\uFEFFtext');
  });

  it('BOM removed when isFirstField=true', () => {
    const bom = '\uFEFFtext';
    expect(canonicalNormalize(bom, true)).toBe('text');
  });
});

// ── FsrsService branch coverage (lines 91-92, 101-103, 158-159) ────────────

describe('FsrsService edge cases', () => {
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('getRetrievability: returns 1.0 for new card', () => {
    const svc = new FsrsService(0.90);
    const card = createCard({ learning_state: 'new' });
    expect(svc.getRetrievability(card, baseTime)).toBe(1.0);
  });

  it('getRetrievability: returns 1.0 for card with stability_days <= 0', () => {
    const svc = new FsrsService(0.90);
    const card = createCard({ learning_state: 'review', stability_days: 0, last_review_at: null });
    expect(svc.getRetrievability(card, baseTime)).toBe(1.0);
  });

  it('getRetrievability: returns 1.0 for card with no last_review_at', () => {
    const svc = new FsrsService(0.90);
    const card = createCard({ learning_state: 'review', stability_days: 5.0, last_review_at: undefined });
    expect(svc.getRetrievability(card, baseTime)).toBe(1.0);
  });

  it('getDesiredRetention returns configured value', () => {
    const svc = new FsrsService(0.85);
    expect(svc.getDesiredRetention()).toBe(0.85);
  });

  it('calculateUtility: uses exam date as horizon when exam is in future', () => {
    const svc = new FsrsService(0.90);
    const examDate = new Date('2026-12-01T00:00:00Z');
    const card = createCard({
      learning_state: 'review',
      stability_days: 10.0,
      last_review_at: new Date('2026-05-25T12:00:00Z').toISOString(),
      next_due_at: baseTime.toISOString()
    });
    const result = svc.calculateUtility(card, baseTime, examDate, 15.0);
    expect(result.horizon.getTime()).toBe(examDate.getTime());
  });

  it('calculateUtility: uses 1-year horizon when no exam date', () => {
    const svc = new FsrsService(0.90);
    const card = createCard({
      learning_state: 'review',
      stability_days: 10.0,
      last_review_at: new Date('2026-05-25T12:00:00Z').toISOString(),
      next_due_at: baseTime.toISOString()
    });
    const result = svc.calculateUtility(card, baseTime, null, 15.0);
    const expectedHorizon = new Date(baseTime.getTime() + 365 * 86400000);
    expect(result.horizon.getTime()).toBeCloseTo(expectedHorizon.getTime(), -4);
  });

  it('calculateUtility: clamps estimated_review_seconds to at least 1', () => {
    const svc = new FsrsService(0.90);
    const card = createCard({
      learning_state: 'review',
      stability_days: 10.0,
      last_review_at: new Date('2026-05-25T12:00:00Z').toISOString(),
      next_due_at: baseTime.toISOString()
    });
    // Should not throw or return NaN even with 0 seconds
    const result = svc.calculateUtility(card, baseTime, null, 0);
    expect(isNaN(result.base_utility)).toBe(false);
    expect(isFinite(result.base_utility)).toBe(true);
  });
});

// ── Scheduler branch coverage (lines 127, 151-154, 270) ─────────────────────

describe('Scheduler edge cases', () => {
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('returns null when all cards are suspended', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const allCards = [
      createCard({ deck_id: deck.id, suspended_at: baseTime.toISOString(), learning_state: 'new' }),
      createCard({ deck_id: deck.id, suspended_at: baseTime.toISOString(), learning_state: 'review' })
    ];

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards,
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const result = engine.selectNextCard(ctx);
    expect(result).toBeNull();
  });

  it('returns null when no cards in any queue', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const engine = new SchedulerEngine(deck.desired_retention, new FixedClock(baseTime));

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0
    };

    expect(engine.selectNextCard(ctx)).toBeNull();
  });

  it('selects relearning card above all others (priority 1)', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const relearningCard = createCard({
      deck_id: deck.id,
      learning_state: 'relearning',
      stability_days: 3.0,
      last_review_at: new Date(baseTime.getTime() - 2 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() - 86400000).toISOString()
    });

    const dueCard = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() - 86400000).toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [dueCard, relearningCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const result = engine.selectNextCard(ctx);
    expect(result).not.toBeNull();
    expect(result?.queue).toBe('relearning');
    expect(result?.selectedCard.id).toBe(relearningCard.id);
  });

  it('respects anti-echo rule: does not repeat last card immediately (SCH-031)', () => {
    const deck = createDeck({ cohort_size: 5 });
    const session = createStudySession(deck.id, { duration_seconds: 3600 });
    const clock = new FixedClock(baseTime);
    const rng = new SeededRandom('test-anti-echo');
    const engine = new SchedulerEngine(deck.desired_retention, clock, rng);

    // cardA was last selected — all three are due review
    const cardA = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() - 86400000).toISOString(),
      source_order: 1
    });

    const cardB = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() - 86400000).toISOString(),
      source_order: 2
    });

    // A third card so activeCards.length >= 3 activates anti-echo (SCH-031)
    const cardC = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() - 86400000).toISOString(),
      source_order: 3
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [cardA, cardB, cardC],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      lastCardId: cardA.id,
      clock
    };

    const result = engine.selectNextCard(ctx);
    expect(result).not.toBeNull();
    // Should not immediately re-select cardA since it was the last card (anti-echo with 3 active cards)
    expect(result?.selectedCard.id).not.toBe(cardA.id);
  });

  it('selects mandatory overdue card (priority 2)', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id, { duration_seconds: 3600 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Overdue by 10 days (threshold = max(7, stability))
    const overdueCard = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 15 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() - 10 * 86400000).toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [overdueCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const result = engine.selectNextCard(ctx);
    expect(result).not.toBeNull();
    expect(result?.queue).toBe('mandatory_overdue');
  });

  it('failed learning card with insufficient intervening count is excluded', () => {
    const deck = createDeck({ min_intervening_cards: 3, min_failed_retry_delay_seconds: 60 });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const failedCard = createCard({
      deck_id: deck.id,
      learning_state: 'learning',
      source_order: 1
    });

    const otherCard = createCard({
      deck_id: deck.id,
      learning_state: 'new',
      source_order: 2
    });

    const extraCard1 = createCard({ deck_id: deck.id, learning_state: 'new', source_order: 3 });
    const extraCard2 = createCard({ deck_id: deck.id, learning_state: 'new', source_order: 4 });
    const extraCard3 = createCard({ deck_id: deck.id, learning_state: 'new', source_order: 5 });

    const failedState = createSessionCardState(session.id, failedCard.id, {
      has_met_criterion: false,
      has_unresolved_failure: true,
      last_failure_at: new Date(baseTime.getTime() - 30000).toISOString(), // 30s ago (< 60s threshold)
      intervening_cards_since_failure: 1 // insufficient (< 3)
    });

    const sessionStates = new Map([
      [failedCard.id, failedState]
    ]);

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [failedCard, otherCard, extraCard1, extraCard2, extraCard3],
      sessionStates,
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const result = engine.selectNextCard(ctx);
    // Failed card should not be selected since delay and intervening not met
    expect(result?.selectedCard.id).not.toBe(failedCard.id);
  });
});
