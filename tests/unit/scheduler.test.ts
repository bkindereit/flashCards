import { describe, it, expect } from 'vitest';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import { FsrsService, FSRS_PACKAGE_VERSION, FSRS_PARAMETER_SET_VERSION, SCHEDULING_POLICY_VERSION } from '@/domain/fsrsService';
import { FixedClock, SeededRandom } from '@/domain/clock';
import { createCard, createDeck, createStudySession, createSessionCardState } from '@/testing/factories';

describe('Scheduler Engine & FSRS Integration (SCH-001..SCH-040)', () => {
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('SCH-001 & SCH-002: Records pinned versions', () => {
    expect(FSRS_PACKAGE_VERSION).toBe('4.4.1');
    expect(FSRS_PARAMETER_SET_VERSION).toBe('default-v4');
    expect(SCHEDULING_POLICY_VERSION).toBe('fca-v1.0');
  });

  it('SCH-003 & SCH-004: Maps binary grades to FSRS Good and Again', () => {
    const fsrsService = new FsrsService(0.90);
    const card = createCard({ learning_state: 'new' });

    // Again
    const againResult = fsrsService.repeat(card, 1, baseTime);
    expect(againResult.card.state).toBe(1); // Learning
    expect(againResult.card.difficulty).toBeGreaterThan(0);

    // Good
    const goodResult = fsrsService.repeat(card, 3, baseTime);
    expect(goodResult.card.state).toBe(1); // Learning
    expect(goodResult.card.stability).toBeGreaterThan(againResult.card.stability);
  });

  it('SCH-010..SCH-012: Deterministic cohort numbers and 1 active cohort at a time', () => {
    const deck = createDeck({ cohort_size: 10 });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Create 25 unseen cards with source_order 1..25
    const allCards = Array.from({ length: 25 }, (_, i) =>
      createCard({
        deck_id: deck.id,
        source_order: i + 1,
        cohort_number: Math.floor(i / 10) + 1,
        learning_state: 'new'
      })
    );

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards,
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    // Must select from cohort 1 first
    expect(sel?.selectedCard.cohort_number).toBe(1);
    expect(sel?.queue).toBe('active_cohort');
  });

  it('SCH-016 & SCH-017: Failed card is not repeated until delay & intervening count met', () => {
    const deck = createDeck({ min_failed_retry_delay_seconds: 60, min_intervening_cards: 3 });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const failedCard = createCard({
      id: 'failed-card',
      deck_id: deck.id,
      learning_state: 'relearning'
    });
    const card2 = createCard({ id: 'card-2', deck_id: deck.id, learning_state: 'review', next_due_at: baseTime.toISOString() });
    const card3 = createCard({ id: 'card-3', deck_id: deck.id, learning_state: 'review', next_due_at: baseTime.toISOString() });

    // Session state: failed 20 seconds ago, 1 intervening card
    const sState = createSessionCardState(session.id, failedCard.id, {
      has_unresolved_failure: true,
      last_failure_at: new Date(baseTime.getTime() - 20000).toISOString(),
      intervening_cards_since_failure: 1
    });

    const sessionStates = new Map([[failedCard.id, sState]]);
    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [failedCard, card2, card3],
      sessionStates,
      lastCardId: 'card-2',
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    // Failed card is NOT eligible because delay (20s < 60s) and intervening (1 < 3)
    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('card-3');

    // Advance clock by 50 seconds (total 70s > 60s) and increment intervening to 3
    clock.advance(50000);
    sState.intervening_cards_since_failure = 3;

    // Now failed card becomes eligible and takes priority as relearning card (SCH-032)
    const sel2 = engine.selectNextCard(ctx);
    expect(sel2?.selectedCard.id).toBe('failed-card');
    expect(sel2?.queue).toBe('relearning');
  });

  it('SCH-024: Enforces new-learning time fraction ceiling', () => {
    const deck = createDeck({ new_learning_fraction: 0.30 }); // 30% of 900s = 270s
    const session = createStudySession(deck.id, { duration_seconds: 900 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const newCard = createCard({ id: 'new-1', learning_state: 'new' });
    const reviewCard = createCard({
      id: 'rev-1',
      learning_state: 'review',
      next_due_at: new Date(baseTime.getTime() + 86400000).toISOString()
    });

    // Case 1: cumulative new learning = 200s (< 270s ceiling) -> new card eligible
    const ctx1: SchedulerContext = {
      deck,
      session,
      allCards: [newCard, reviewCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 200,
      estimatedReviewSeconds: 15.0,
      clock
    };
    const sel1 = engine.selectNextCard(ctx1);
    expect(sel1?.selectedCard.id).toBe('new-1');

    // Case 2: cumulative new learning = 280s (> 270s ceiling) -> new card suppressed
    const ctx2: SchedulerContext = {
      ...ctx1,
      cumulativeNewLearningSeconds: 280
    };
    const sel2 = engine.selectNextCard(ctx2);
    expect(sel2?.selectedCard.id).toBe('rev-1');
  });

  it('SCH-027: Due workload backlog suppresses introduction of unseen cards', () => {
    const deck = createDeck();
    // Remaining time: 60s (900 duration - 840 active)
    const session = createStudySession(deck.id, { duration_seconds: 900, active_duration_seconds: 840 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // 5 due review cards @ 15s each = 75s workload > 60s remaining
    const dueCards = Array.from({ length: 5 }, (_, i) =>
      createCard({
        id: `due-${i}`,
        learning_state: 'review',
        next_due_at: baseTime.toISOString()
      })
    );
    const unseenCard = createCard({ id: 'unseen-1', learning_state: 'new' });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [...dueCards, unseenCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.queue).toBe('due_review');
    expect(sel?.selectedCard.id).not.toBe('unseen-1');
  });

  it('SCH-030: Suspended cards are excluded from all pools', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const suspendedCard = createCard({
      id: 'suspended-1',
      suspended_at: baseTime.toISOString(),
      learning_state: 'review',
      next_due_at: baseTime.toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [suspendedCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel).toBeNull();
  });

  it('SCH-031: Anti-echo excludes immediately preceding card when >= 2 other cards exist', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const cardA = createCard({ id: 'card-a', learning_state: 'review', next_due_at: baseTime.toISOString(), importance_weight: 10.0 });
    const cardB = createCard({ id: 'card-b', learning_state: 'review', next_due_at: baseTime.toISOString(), importance_weight: 1.0 });
    const cardC = createCard({ id: 'card-c', learning_state: 'review', next_due_at: baseTime.toISOString(), importance_weight: 1.0 });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [cardA, cardB, cardC],
      sessionStates: new Map(),
      lastCardId: 'card-a', // Immediately preceding card was A!
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    // Even though cardA has highest utility (importance 10.0), it must be excluded by anti-echo
    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).not.toBe('card-a');
    expect(['card-b', 'card-c']).toContain(sel?.selectedCard.id);
  });

  it('SCH-036 & SCH-037: Deterministic selection with seeded random tie-breaker', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);

    // Two cards with identical properties and due dates
    const card1 = createCard({ id: 'card-tie-1', learning_state: 'review', next_due_at: baseTime.toISOString() });
    const card2 = createCard({ id: 'card-tie-2', learning_state: 'review', next_due_at: baseTime.toISOString() });

    const seed = 'deterministic-test-seed-123';
    const engine1 = new SchedulerEngine(deck.desired_retention, clock, new SeededRandom(seed));
    const engine2 = new SchedulerEngine(deck.desired_retention, clock, new SeededRandom(seed));

    const ctx1: SchedulerContext = {
      deck,
      session,
      allCards: [card1, card2],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock,
      random: new SeededRandom(seed)
    };

    const ctx2: SchedulerContext = {
      deck,
      session,
      allCards: [card1, card2],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock,
      random: new SeededRandom(seed)
    };

    const sel1 = engine1.selectNextCard(ctx1);
    const sel2 = engine2.selectNextCard(ctx2);

    expect(sel1).not.toBeNull();
    expect(sel2).not.toBeNull();
    expect(sel1?.selectedCard.id).toBe(sel2?.selectedCard.id);
    expect(sel1?.reasonCode).toBe(sel2?.reasonCode);
  });

  it('Puts review card without next_due_at into due_review queue', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const cardNoDue = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      next_due_at: undefined,
      stability_days: 3.0,
      last_review_at: new Date(baseTime.getTime() - 86400000).toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [cardNoDue],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('due_review');
    expect(sel?.selectedCard.id).toBe(cardNoDue.id);
  });

  it('Suppresses new cohort introduction when remaining session time cannot fit one exposure per card (SCH-020)', () => {
    const deck = createDeck({ cohort_size: 10 });
    // 60 seconds remaining, 10 cards * 15s = 150s needed > 60s
    const session = createStudySession(deck.id, { duration_seconds: 900, active_duration_seconds: 840 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const newCards = Array.from({ length: 10 }, (_, i) =>
      createCard({
        deck_id: deck.id,
        learning_state: 'new',
        source_order: i + 1,
        cohort_number: 1
      })
    );

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: newCards,
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel).toBeNull();
  });

  it('Allows retry of failed card when total other eligible cards is less than 2 (SCH-017)', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const failedCard = createCard({
      deck_id: deck.id,
      learning_state: 'learning',
      source_order: 1
    });

    const sState = createSessionCardState(session.id, failedCard.id, {
      has_met_criterion: false,
      has_unresolved_failure: true,
      last_failure_at: new Date(baseTime.getTime() - 5000).toISOString(), // 5s ago (< 60s delay)
      intervening_cards_since_failure: 0 // < 3 intervening
    });

    // Only 1 other card in the deck (totalOtherEligible = 1 < 2)
    const otherCard = createCard({ deck_id: deck.id, learning_state: 'new', source_order: 2 });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [failedCard, otherCard],
      sessionStates: new Map([[failedCard.id, sState]]),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    // Failed card was eligible under exception SCH-017
    expect(sel?.selectedCard.id).toBe(failedCard.id);
  });

  it('Anti-echo does not filter lastCardId when activeCards.length is less than 3 (SCH-031)', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Only 2 cards total, both due review
    const cardA = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      importance_weight: 10.0, // Higher utility
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString(),
      source_order: 1
    });

    const cardB = createCard({
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      importance_weight: 1.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString(),
      source_order: 2
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [cardA, cardB],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      lastCardId: cardA.id, // was last card, but activeCards.length = 2 < 3
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    // cardA has much higher utility, and anti-echo did not engage because only 2 active cards
    expect(sel?.selectedCard.id).toBe(cardA.id);
  });
});
