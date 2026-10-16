import { describe, it, expect } from 'vitest';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import {
  FsrsService,
  FSRS_PACKAGE_VERSION,
  FSRS_PARAMETER_SET_VERSION,
  SCHEDULING_POLICY_VERSION,
  DEFAULT_ADAPTIVE_WEIGHTS,
  deriveStreakCount,
  updateStreakCount,
  deriveRecentAccuracy,
  updateRecentAccuracy,
  computeLeechScore,
  computeStalenessScore,
  computeComplexityIndex,
  computeClusterId,
  calibrateAdaptiveWeights
} from '@/domain/fsrsService';
import { FixedClock, SeededRandom } from '@/domain/clock';
import { createCard, createDeck, createStudySession, createSessionCardState } from '@/testing/factories';
import { Card, SessionCardState, LearningState } from '@/domain/types';

describe('Scheduler Engine & FSRS Integration (SCH-001..SCH-046)', () => {
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('SCH-001, SCH-002: Records pinned versions', () => {
    expect(FSRS_PACKAGE_VERSION).toBe('4.4.1');
    expect(FSRS_PARAMETER_SET_VERSION).toBe('default-v4');
    expect(SCHEDULING_POLICY_VERSION).toBe('fca-v1.0');
  });

  it('SCH-003, SCH-004: Maps binary grades to FSRS Good and Again', () => {
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

  it('SCH-010, SCH-011, SCH-012: Deterministic cohort numbers and 1 active cohort at a time', () => {
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

  it('SCH-016, SCH-017: Failed card is not repeated until delay & intervening count met', () => {
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

  it('SCH-036, SCH-037: Deterministic selection with seeded random tie-breaker', () => {
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

  it('SES-004, SES-006: Session continues delivering cards until target duration expires even when all cohort cards have met criterion', () => {
    const deck = createDeck({ cohort_size: 5, new_learning_fraction: 0.30 });
    const session = createStudySession(deck.id, { duration_seconds: 300, active_duration_seconds: 0 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);
    const fsrs = new FsrsService(deck.desired_retention);

    let cards: Card[] = Array.from({ length: 5 }, (_, i) =>
      createCard({
        id: `card-${i + 1}`,
        deck_id: deck.id,
        source_order: i + 1,
        cohort_number: 1,
        learning_state: 'new'
      })
    );
    const states = new Map<string, SessionCardState>();
    let cumulativeNew = 0;
    let lastId: string | undefined = undefined;

    // Simulate 20 questions across 300 seconds (15s per question)
    let totalQuestions = 0;
    for (let step = 0; step < 20; step++) {
      const ctx: SchedulerContext = {
        deck,
        session,
        allCards: cards,
        sessionStates: states,
        lastCardId: lastId,
        cumulativeNewLearningSeconds: cumulativeNew,
        estimatedReviewSeconds: 15.0,
        clock
      };

      const sel = engine.selectNextCard(ctx);
      expect(sel).not.toBeNull();
      totalQuestions++;

      const card = sel!.selectedCard;
      lastId = card.id;

      clock.advance(15000);
      session.active_duration_seconds += 15;
      if (card.learning_state === 'new' || card.learning_state === 'learning') {
        cumulativeNew += 15;
      }

      const repeatRes = fsrs.repeat(card, 3, clock.now());
      const postState = {
        learning_state: 'review' as const,
        difficulty: repeatRes.card.difficulty,
        stability_days: repeatRes.card.stability,
        next_due_at: repeatRes.card.due.toISOString()
      };

      cards = cards.map(c =>
        c.id === card.id
          ? { ...c, ...postState, last_review_at: clock.now().toISOString(), review_count: c.review_count + 1 }
          : c
      );
      const st = states.get(card.id) || createSessionCardState(session.id, card.id, { introduced_in_session: true });
      st.has_met_criterion = true;
      states.set(card.id, st);
    }

    expect(totalQuestions).toBe(20);
    expect(session.active_duration_seconds).toBe(300);
  });

  it('SCH-010, SCH-013, SCH-015, SCH-016, SCH-017, SCH-020: 65-card deck progresses through active cohort cards without getting trapped in a 2-card loop when cards fail', () => {
    const deck = createDeck({ cohort_size: 10, min_failed_retry_delay_seconds: 60, min_intervening_cards: 3 });
    const session = createStudySession(deck.id, { duration_seconds: 900 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);
    const fsrs = new FsrsService(deck.desired_retention);

    let cards = Array.from({ length: 65 }, (_, i) =>
      createCard({
        id: `card-${i + 1}`,
        deck_id: deck.id,
        learning_state: 'new',
        source_order: i + 1,
        cohort_number: Math.floor(i / 10) + 1
      })
    );

    const states = new Map<string, SessionCardState>();
    let lastId: string | undefined;
    let cumulativeNew = 0;

    const step = (rating: 1 | 3) => {
      const ctx: SchedulerContext = {
        deck,
        session,
        allCards: cards,
        sessionStates: states,
        lastCardId: lastId,
        cumulativeNewLearningSeconds: cumulativeNew,
        estimatedReviewSeconds: 15.0,
        clock
      };
      const sel = engine.selectNextCard(ctx);
      expect(sel).not.toBeNull();
      const card = sel!.selectedCard;
      lastId = card.id;

      clock.advance(15000);
      session.active_duration_seconds += 15;
      if (card.learning_state === 'new' || card.learning_state === 'learning') {
        cumulativeNew += 15;
      }

      const repeatRes = fsrs.repeat(card, rating, clock.now());
      const isCorrect = rating === 3;
      const postLearningState: LearningState = isCorrect
        ? (card.learning_state === 'new' || card.learning_state === 'learning' || card.learning_state === 'relearning' ? 'review' : card.learning_state)
        : (card.learning_state === 'review' ? 'relearning' : (card.learning_state === 'new' ? 'learning' : card.learning_state));

      cards = cards.map(c =>
        c.id === card.id
          ? {
              ...c,
              learning_state: postLearningState,
              difficulty: repeatRes.card.difficulty,
              stability_days: repeatRes.card.stability,
              next_due_at: repeatRes.card.due.toISOString(),
              last_review_at: clock.now().toISOString(),
              review_count: c.review_count + 1
            }
          : c
      );

      const st = states.get(card.id) || createSessionCardState(session.id, card.id, { introduced_in_session: true });
      if (isCorrect) {
        st.has_met_criterion = true;
        st.has_unresolved_failure = false;
      } else {
        st.has_unresolved_failure = true;
        st.last_failure_at = clock.now().toISOString();
        st.intervening_cards_since_failure = 0;
      }

      for (const [sId, otherSt] of states.entries()) {
        if (sId !== card.id && otherSt.has_unresolved_failure) {
          otherSt.intervening_cards_since_failure += 1;
        }
      }
      states.set(card.id, st);
      return card;
    };

    // 1. Card 1 presented and answered correct
    const c1 = step(3);
    expect(c1.id).toBe('card-1');

    // 2. Card 2 presented and answered incorrect
    const c2 = step(1);
    expect(c2.id).toBe('card-2');

    // 3. Card 3 presented and answered incorrect
    const c3 = step(1);
    expect(c3.id).toBe('card-3');

    // 4. Must NOT loop back to card-2 or card-3! Next must be card-4!
    const c4 = step(3);
    expect(c4.id).toBe('card-4');

    // 5. Next must be card-5
    const c5 = step(3);
    expect(c5.id).toBe('card-5');

    // 6. Next must be card-6
    const c6 = step(3);
    expect(c6.id).toBe('card-6');

    // 7. Card 2 has met delay (4 * 15s = 60s) and intervening count (c4, c5, c6 = 3) -> retried!
    const c7 = step(3);
    expect(c7.id).toBe('card-2');

    // 8. Card 3 now has 4 intervening cards (c4, c5, c6, c2) and >60s -> retried!
    const c8 = step(3);
    expect(c8.id).toBe('card-3');

    // 9. Both card-2 and card-3 resolved! Next unseen cohort cards continue
    const c9 = step(3);
    expect(c9.id).toBe('card-7');

    const c10 = step(3);
    expect(c10.id).toBe('card-8');

    const c11 = step(3);
    expect(c11.id).toBe('card-9');

    const c12 = step(3);
    expect(c12.id).toBe('card-10');

    // 10. Cohort 1 complete! Cohort 2 unlocks! Next must be card-11!
    const c13 = step(3);
    expect(c13.id).toBe('card-11');
    expect(c13.cohort_number).toBe(2);
  });

  it('SCH-041: Tracks consecutive correct streak and discounts urgency for high-streak cards', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Verify streak helper behavior
    expect(updateStreakCount(0, 'correct')).toBe(1);
    expect(updateStreakCount(4, 'correct')).toBe(5);
    expect(updateStreakCount(5, 'incorrect')).toBe(0);

    const lapsedCard = createCard({ learning_state: 'relearning', correct_count: 5, incorrect_count: 1, last_rating: 1 });
    expect(deriveStreakCount(lapsedCard)).toBe(0);

    const mixedCard = createCard({ learning_state: 'review', correct_count: 5, incorrect_count: 2, last_rating: 3 });
    expect(deriveStreakCount(mixedCard)).toBe(3);

    // Two otherwise equal due review cards, except cardHighStreak has a 7-streak and cardLowStreak has a 1-streak
    const cardHighStreak = createCard({
      id: 'card-high-streak',
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      difficulty: 5.0,
      correct_count: 7,
      incorrect_count: 0,
      review_count: 7,
      streak_count: 7,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    const cardLowStreak = createCard({
      id: 'card-low-streak',
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      difficulty: 5.0,
      correct_count: 1,
      incorrect_count: 0,
      review_count: 1,
      streak_count: 1,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [cardHighStreak, cardLowStreak],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('card-low-streak');
    expect(sel!.utilityValues['card-low-streak']!).toBeGreaterThan(sel!.utilityValues['card-high-streak']!);
  });

  it('SCH-042: Recency-weighted accuracy (EWMA) weights recent outcomes higher than older history and boosts priority on recent drop', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // EWMA updates: start at 1.0, miss -> 0.75, miss -> 0.5625
    const r0 = updateRecentAccuracy(undefined, 0, 'correct');
    expect(r0).toBe(1.0);
    const r1 = updateRecentAccuracy(r0, 1, 'incorrect', 0.25);
    expect(r1).toBeCloseTo(0.75, 5);
    const r2 = updateRecentAccuracy(r1, 2, 'incorrect', 0.25);
    expect(r2).toBeCloseTo(0.5625, 5);

    // Derived fallback when recent_accuracy is not explicitly set
    expect(deriveRecentAccuracy(createCard({ review_count: 0 }))).toBe(1.0);
    expect(deriveRecentAccuracy(createCard({ review_count: 4, correct_count: 2, incorrect_count: 2, last_rating: 1 }))).toBeCloseTo(0.375, 5);
    expect(deriveRecentAccuracy(createCard({ review_count: 4, correct_count: 3, incorrect_count: 1, last_rating: 3 }))).toBeCloseTo(0.75, 5);

    // Two cards with identical FSRS stability/difficulty and streak=1, but one has low recent_accuracy (0.35) vs high (0.95)
    const cardRecentSlump = createCard({
      id: 'card-recent-slump',
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      difficulty: 5.0,
      review_count: 10,
      correct_count: 8,
      incorrect_count: 2,
      streak_count: 1,
      recent_accuracy: 0.35,
      leech_score: 0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    const cardRecentStrong = createCard({
      id: 'card-recent-strong',
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      difficulty: 5.0,
      review_count: 10,
      correct_count: 8,
      incorrect_count: 2,
      streak_count: 1,
      recent_accuracy: 0.95,
      leech_score: 0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    const sel = engine.selectNextCard({
      deck,
      session,
      allCards: [cardRecentStrong, cardRecentSlump],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    });

    expect(sel?.selectedCard.id).toBe('card-recent-slump');
  });

  it('SCH-043: Calculates leech severity and elapsed staleness factor to boost chronic obstacle and long-unasked cards', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const leechCard = createCard({
      id: 'card-leech',
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      difficulty: 5.0,
      review_count: 8,
      correct_count: 4,
      incorrect_count: 4,
      lapse_count: 3,
      streak_count: 1,
      recent_accuracy: 0.90,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    const normalCard = createCard({
      id: 'card-normal',
      deck_id: deck.id,
      learning_state: 'review',
      stability_days: 5.0,
      difficulty: 5.0,
      review_count: 2,
      correct_count: 2,
      incorrect_count: 0,
      lapse_count: 0,
      streak_count: 1,
      recent_accuracy: 0.90,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    expect(computeLeechScore(leechCard)).toBeCloseTo(0.90, 5);
    expect(computeLeechScore(normalCard)).toBe(0.0);
    expect(computeStalenessScore(createCard({ last_review_at: null }), baseTime)).toBe(0.0);
    expect(
      computeStalenessScore(
        createCard({
          stability_days: 5.0,
          last_review_at: new Date(baseTime.getTime() - 22 * 86400000).toISOString()
        }),
        baseTime
      )
    ).toBeCloseTo(0.50, 5);

    const sel = engine.selectNextCard({
      deck,
      session,
      allCards: [normalCard, leechCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    });

    expect(sel?.selectedCard.id).toBe('card-leech');
  });

  it('SCH-044: Derives structural complexity index from text and symbolic structure without penalizing response latency', () => {
    const simpleIdx = computeComplexityIndex('Capital of France?', 'Paris');
    expect(simpleIdx).toBe(0.0);

    const mathIdx = computeComplexityIndex(
      'Calculate NPV = -C_0 + sum_{t=1}^T (CF_t / (1 + r)^t) when C_0 = $1000, CF_1 = $600, CF_2 = $600, r = 10%',
      'Step 1: PV_1 = 600 / 1.10 = 545.45\nStep 2: PV_2 = 600 / 1.21 = 495.87\nStep 3: NPV = 545.45 + 495.87 - 1000 = +$41.32'
    );
    expect(mathIdx).toBeGreaterThan(0.50);
    expect(mathIdx).toBeLessThanOrEqual(1.0);

    // Verify complexity boosts reinforcement priority while response latency is not an input or penalty
    const fsrs = new FsrsService(0.90);
    const simpleCard = createCard({
      id: 'simple-card',
      learning_state: 'review',
      question_text: 'Capital of France?',
      answer_text: 'Paris',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });
    const complexMathCard = createCard({
      id: 'math-card',
      learning_state: 'review',
      question_text: 'Calculate NPV = -C_0 + sum(CF_t / (1 + r)^t) for multi-period cash flows',
      answer_text: 'NPV = -1000 + 600/1.1 + 600/1.21 = +41.32',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    const uSimple = fsrs.calculateMultiFactorUtility(simpleCard, baseTime);
    const uComplex = fsrs.calculateMultiFactorUtility(complexMathCard, baseTime);
    expect(uComplex.complexity_factor).toBeGreaterThan(uSimple.complexity_factor);
    expect(uComplex.composite_utility).toBeGreaterThan(uSimple.composite_utility);
  });

  it('SCH-045: Identifies semantic confusion clusters and applies interference spacing penalty when preceding card shares cluster', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const rfmCard1 = createCard({
      id: 'rfm-1',
      deck_id: deck.id,
      question_text: 'Scoring RFM: What does Recency measure?',
      answer_text: 'Time since last purchase',
      normalized_question: 'Scoring RFM: What does Recency measure?',
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });
    const rfmCard2 = createCard({
      id: 'rfm-2',
      deck_id: deck.id,
      question_text: 'Scoring RFM: What does Frequency measure?',
      answer_text: 'Number of purchases in period',
      normalized_question: 'Scoring RFM: What does Frequency measure?',
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });
    const churnCard = createCard({
      id: 'churn-1',
      deck_id: deck.id,
      question_text: 'Attrition rate: How is customer churn calculated?',
      answer_text: 'Lost customers divided by starting customers',
      normalized_question: 'Attrition rate: How is customer churn calculated?',
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    expect(computeClusterId(rfmCard1)).toBe('scoring');
    expect(computeClusterId(rfmCard2)).toBe('scoring');
    expect(computeClusterId(churnCard)).toBe('attrition');

    // When rfm-1 was just shown (lastCardId = 'rfm-1'), rfm-2 shares cluster 'scoring' and gets an interference spacing penalty, so churn-1 is selected next!
    const sel = engine.selectNextCard({
      deck,
      session,
      allCards: [rfmCard1, rfmCard2, churnCard],
      sessionStates: new Map(),
      lastCardId: 'rfm-1',
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    });

    expect(sel?.selectedCard.id).toBe('churn-1');
  });

  it('SCH-046: Combines FSRS utility with multi-factor signals via adaptive weights and dynamically calibrates weights from empirical prediction outcomes', () => {
    const initialWeights = { ...DEFAULT_ADAPTIVE_WEIGHTS };

    // Case 1: High-urgency card (low recent accuracy, high leech score, high complexity) is missed (result = 'incorrect') when FSRS predicted rNow = 0.90
    const vulnerableCard = createCard({
      learning_state: 'review',
      review_count: 8,
      correct_count: 4,
      incorrect_count: 4,
      lapse_count: 3,
      streak_count: 0,
      recent_accuracy: 0.35,
      complexity_index: 0.80
    });

    const calibratedAfterMiss = calibrateAdaptiveWeights(initialWeights, vulnerableCard, 0.90, 'incorrect');
    // Urgency predictors accurately warned of failure -> weights increase!
    expect(calibratedAfterMiss.w_recent).toBeGreaterThan(initialWeights.w_recent);
    expect(calibratedAfterMiss.w_leech).toBeGreaterThan(initialWeights.w_leech);
    expect(calibratedAfterMiss.w_complexity).toBeGreaterThan(initialWeights.w_complexity);

    // Case 2: High-streak complex card is answered correctly (result = 'correct')
    const masteredComplexCard = createCard({
      learning_state: 'review',
      review_count: 10,
      correct_count: 10,
      incorrect_count: 0,
      lapse_count: 0,
      streak_count: 8,
      recent_accuracy: 0.98,
      complexity_index: 0.90
    });

    const calibratedAfterHit = calibrateAdaptiveWeights(initialWeights, masteredComplexCard, 0.85, 'correct');
    // Streak discount validated -> w_streak increases; complexity warning was unnecessary -> w_complexity decays!
    expect(calibratedAfterHit.w_streak).toBeGreaterThan(initialWeights.w_streak);
    expect(calibratedAfterHit.w_complexity).toBeLessThan(initialWeights.w_complexity);

    // Case 3: High-streak card unexpectedly missed -> w_streak decreases
    const calibratedStreakLapse = calibrateAdaptiveWeights(initialWeights, masteredComplexCard, 0.90, 'incorrect');
    expect(calibratedStreakLapse.w_streak).toBeLessThan(initialWeights.w_streak);
  });
});

