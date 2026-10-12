import { describe, it, expect } from 'vitest';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import { FsrsService } from '@/domain/fsrsService';
import { FixedClock } from '@/domain/clock';
import { createCard, createDeck, createStudySession, createSessionCardState } from '@/testing/factories';

describe('Versioned Golden Scenarios (TST-015 & VA-SCH-006)', () => {
  const t0 = new Date('2026-06-01T10:00:00Z');

  it('Golden 1 - New Learning: selects from cohort 1 in source order', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(t0);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const cards = [
      createCard({ id: 'c1', source_order: 1, cohort_number: 1, learning_state: 'new' }),
      createCard({ id: 'c2', source_order: 2, cohort_number: 1, learning_state: 'new' })
    ];

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: cards,
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('c1');
    expect(sel?.queue).toBe('active_cohort');
  });

  it('Golden 2 - Success: rating Good updates state and stability', () => {
    const fsrs = new FsrsService(0.90);
    const card = createCard({ learning_state: 'new' });

    const review = fsrs.repeat(card, 3, t0); // Good
    expect(review.card.stability).toBeGreaterThan(0.5);
    expect(review.card.difficulty).toBeGreaterThan(1.0);
    expect(new Date(review.card.due).getTime()).toBeGreaterThan(t0.getTime());
  });

  it('Golden 3 - Lapse: rating Again on review card causes lapse', () => {
    const fsrs = new FsrsService(0.90);
    const card = createCard({
      learning_state: 'review',
      difficulty: 4.5,
      stability_days: 10.0,
      last_review_at: new Date(t0.getTime() - 10 * 86400000).toISOString()
    });

    const review = fsrs.repeat(card, 1, t0); // Again
    expect(review.card.stability).toBeLessThan(10.0);
    expect(review.card.lapses).toBe(1);
  });

  it('Golden 4 - Relearning: failed card regains priority after anti-echo delay and intervening count', () => {
    const deck = createDeck({ min_failed_retry_delay_seconds: 60, min_intervening_cards: 3 });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(t0);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const relCard = createCard({ id: 'rel-1', learning_state: 'relearning' });
    const rev1 = createCard({ id: 'rev-1', learning_state: 'review', next_due_at: t0.toISOString() });
    const rev2 = createCard({ id: 'rev-2', learning_state: 'review', next_due_at: t0.toISOString() });
    const rev3 = createCard({ id: 'rev-3', learning_state: 'review', next_due_at: t0.toISOString() });

    const sState = createSessionCardState(session.id, relCard.id, {
      has_unresolved_failure: true,
      last_failure_at: t0.toISOString(),
      intervening_cards_since_failure: 0
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [relCard, rev1, rev2, rev3],
      sessionStates: new Map([[relCard.id, sState]]),
      lastCardId: 'rev-1',
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    // Before delay/intervening: not ready
    let sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).not.toBe('rel-1');

    // Satisfy delay and intervening count
    clock.advance(65000); // 65 seconds
    sState.intervening_cards_since_failure = 3;

    sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('rel-1');
    expect(sel?.queue).toBe('relearning');
  });

  it('Golden 5 - Overdue Review: cards overdue by > max(7 days, scheduled_interval) become mandatory', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(t0);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Due 10 days ago with stability 5 days -> overdue by 10 days > max(7, 5) -> Mandatory Overdue
    const overdueCard = createCard({
      id: 'overdue-1',
      learning_state: 'review',
      stability_days: 5,
      next_due_at: new Date(t0.getTime() - 10 * 86400000).toISOString()
    });

    // Due 2 days ago -> Ordinary due review
    const dueCard = createCard({
      id: 'due-1',
      learning_state: 'review',
      stability_days: 5,
      next_due_at: new Date(t0.getTime() - 2 * 86400000).toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [overdueCard, dueCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('overdue-1');
    expect(sel?.queue).toBe('mandatory_overdue');
  });

  it('Golden 6 - Exam Imminent Prioritization: prioritizes candidates before exam horizon', () => {
    const examDate = new Date(t0.getTime() + 7 * 86400000); // Exam in 7 days
    const deck = createDeck({ exam_date: examDate.toISOString() });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(t0);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Card with higher decay/urgency has higher expected utility gain
    const weakCard = createCard({
      id: 'weak-card',
      learning_state: 'review',
      difficulty: 8.0,
      stability_days: 2.0,
      next_due_at: t0.toISOString()
    });
    const strongCard = createCard({
      id: 'strong-card',
      learning_state: 'review',
      difficulty: 2.0,
      stability_days: 50.0,
      next_due_at: t0.toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [weakCard, strongCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('weak-card');
  });

  it('Golden 7 - Due Backlog Suppression: completely suppresses new cards when due workload >= capacity', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id, { duration_seconds: 300, active_duration_seconds: 200 }); // 100s remaining
    const clock = new FixedClock(t0);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // 10 due cards @ 15s each = 150s workload > 100s remaining
    const dueCards = Array.from({ length: 10 }, (_, i) =>
      createCard({ id: `due-${i}`, learning_state: 'review', next_due_at: t0.toISOString() })
    );
    const newCard = createCard({ id: 'new-suppressed', learning_state: 'new' });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [...dueCards, newCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.queue).toBe('due_review');
    expect(sel?.selectedCard.id).not.toBe('new-suppressed');
  });

  it('VA-SCH-006: Utility formula conformance against independent calculation', () => {
    const fsrs = new FsrsService(0.90);
    const card = createCard({
      learning_state: 'review',
      difficulty: 5.0,
      stability_days: 10.0,
      importance_weight: 1.5,
      last_review_at: new Date(t0.getTime() - 5 * 86400000).toISOString(),
      next_due_at: new Date(t0.getTime() + 5 * 86400000).toISOString()
    });

    const estimatedReviewSeconds = 12.0;
    const examDate = new Date(t0.getTime() + 30 * 86400000);

    const utilityResult = fsrs.calculateUtility(card, t0, examDate, estimatedReviewSeconds);

    // Independent calculation:
    // expected_gain = r_now * pg + (1 - r_now) * pa - p0
    // base_utility = importance_weight * expected_gain / estimatedReviewSeconds
    const independentExpectedGain = utilityResult.r_now * utilityResult.pg + (1.0 - utilityResult.r_now) * utilityResult.pa - utilityResult.p0;
    const independentUtility = (card.importance_weight * independentExpectedGain) / estimatedReviewSeconds;

    expect(Math.abs(utilityResult.expected_gain - independentExpectedGain)).toBeLessThan(1e-9);
    expect(Math.abs(utilityResult.base_utility - independentUtility)).toBeLessThan(1e-9);
  });
});
