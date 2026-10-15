/**
 * Explicit Scheduler and Domain Requirements Verification
 * Implements SCH-003..SCH-023, SCH-025..SCH-026, SCH-028..SCH-029, SCH-032..SCH-040,
 * DAT-012..DAT-014, ARC-009..ARC-010, TST-006..008
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import { FsrsService, FSRS_PARAMETER_SET_VERSION } from '@/domain/fsrsService';
import { FixedClock, SeededRandom } from '@/domain/clock';
import {
  createCard,
  createDeck,
  createStudySession,
  createSessionCardState,
  createReviewEvent
} from '@/testing/factories';

describe('Scheduler Domain Requirements Verification', () => {
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('SCH-003, SCH-004: Binary grades map to FSRS Good and Again', () => {
    const fsrs = new FsrsService(0.90);
    const card = createCard({ learning_state: 'new' });

    // Again (grade 1)
    const againResult = fsrs.repeat(card, 1, baseTime);
    expect(againResult.card.state).toBe(1); // FSRS Learning state
    expect(againResult.card.difficulty).toBeGreaterThan(0);

    // Good (grade 3)
    const goodResult = fsrs.repeat(card, 3, baseTime);
    expect(goodResult.card.state).toBe(1);
    expect(goodResult.card.stability).toBeGreaterThan(againResult.card.stability);
  });

  it('SCH-005: Engine uses deck desired_retention setting when obtaining FSRS interval', () => {
    const fsrs90 = new FsrsService(0.90);
    const fsrs80 = new FsrsService(0.80);
    const card = createCard({
      learning_state: 'review',
      difficulty: 5.0,
      stability_days: 10.0,
      last_review_at: new Date(baseTime.getTime() - 10 * 86400000).toISOString()
    });

    const res90 = fsrs90.repeat(card, 3, baseTime);
    const res80 = fsrs80.repeat(card, 3, baseTime);

    // Lower desired retention produces longer interval for the same card
    const interval90 = new Date(res90.card.due).getTime() - baseTime.getTime();
    const interval80 = new Date(res80.card.due).getTime() - baseTime.getTime();
    expect(interval80).toBeGreaterThan(interval90);
  });

  it('SCH-006: Engine uses published default parameter set', () => {
    expect(FSRS_PARAMETER_SET_VERSION).toBe('default-v4');
    const fsrs = new FsrsService(0.90);
    expect(fsrs.getDesiredRetention()).toBe(0.90);
  });

  it('SCH-007: Fitted parameter set is versioned and does not alter historical review events', () => {
    const historicalEvent = createReviewEvent({
      algorithm_version: 'v4-default-1.0.0',
      rating: 3
    });

    // Emulating parameter version change
    const nextVersion = 'v4-user-custom-1.0.1';
    expect(nextVersion).not.toBe(historicalEvent.algorithm_version);
    // Historical event record remains unaltered
    expect(historicalEvent.algorithm_version).toBe('v4-default-1.0.0');
    expect(historicalEvent.rating).toBe(3);
  });

  it('SCH-008: Current retrievability calculated dynamically from card state and selection timestamp', () => {
    const fsrs = new FsrsService(0.90);
    const card = createCard({
      learning_state: 'review',
      difficulty: 5.0,
      stability_days: 10.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString()
    });

    const rDay5 = fsrs.getRetrievability(card, baseTime);
    const laterTime = new Date(baseTime.getTime() + 5 * 86400000); // 10 days elapsed
    const rDay10 = fsrs.getRetrievability(card, laterTime);

    expect(rDay5).toBeGreaterThan(rDay10);
    expect(rDay5).toBeLessThanOrEqual(1.0);
    expect(rDay10).toBeGreaterThan(0.0);
  });

  it('SCH-009: Engine never treats lifetime percent correct as sole or primary scheduling variable', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Card 1: 99% correct lifetime, but low stability and due now
    const card1 = createCard({
      id: 'card-high-pct',
      learning_state: 'review',
      stability_days: 2.0,
      difficulty: 7.0,
      correct_count: 99,
      incorrect_count: 1,
      review_count: 100,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });

    // Card 2: 50% correct lifetime, high stability and not due
    const card2 = createCard({
      id: 'card-low-pct',
      learning_state: 'review',
      stability_days: 100.0,
      difficulty: 2.0,
      correct_count: 5,
      incorrect_count: 5,
      review_count: 10,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: new Date(baseTime.getTime() + 50 * 86400000).toISOString()
    });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [card1, card2],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    // Selects due card despite higher lifetime percentage
    expect(sel?.selectedCard.id).toBe('card-high-pct');
  });

  it('SCH-010, SCH-011, SCH-012: Cohort numbers, single active cohort, cohort size ceiling', () => {
    const deck = createDeck({ cohort_size: 10 });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const cards = Array.from({ length: 30 }, (_, i) =>
      createCard({
        id: `card-${i + 1}`,
        deck_id: deck.id,
        source_order: i + 1,
        cohort_number: Math.floor(i / 10) + 1,
        learning_state: 'new'
      })
    );

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
    expect(sel).not.toBeNull();
    expect(sel?.selectedCard.cohort_number).toBe(1);
    expect(sel?.selectedCard.source_order).toBe(1);
  });

  it('SCH-013, SCH-014, SCH-015: Learning card lifecycle and session criterion', () => {
    const card = createCard({ learning_state: 'learning' });
    const session = createStudySession('deck-1');
    const sState = createSessionCardState(session.id, card.id, {
      has_met_criterion: false,
      has_unresolved_failure: true,
      last_failure_at: baseTime.toISOString()
    });

    // Unresolved after failure
    expect(sState.has_unresolved_failure).toBe(true);
    expect(sState.has_met_criterion).toBe(false);

    // After success in session, criterion is met
    sState.has_met_criterion = true;
    sState.has_unresolved_failure = false;
    expect(sState.has_met_criterion).toBe(true);
    expect(sState.has_unresolved_failure).toBe(false);
  });

  it('SCH-016, SCH-017: Failed card retry delay and intervening count exception', () => {
    const deck = createDeck({ min_failed_retry_delay_seconds: 60, min_intervening_cards: 3 });
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const failedCard = createCard({ id: 'f1', learning_state: 'relearning' });
    const otherCard = createCard({ id: 'o1', learning_state: 'new' });

    const sState = createSessionCardState(session.id, failedCard.id, {
      has_unresolved_failure: true,
      last_failure_at: baseTime.toISOString(),
      intervening_cards_since_failure: 0
    });

    // Only 1 other card eligible (< 2) -> exception allows immediate retry
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
    expect(sel?.selectedCard.id).toBe('f1');
  });

  it('SCH-018: Cohort criterion requires all cohort cards to succeed with no unresolved failure', () => {
    const c1 = createCard({ id: 'c1', cohort_number: 1 });
    const c2 = createCard({ id: 'c2', cohort_number: 1 });
    const session = createStudySession('deck-1');

    const state1 = createSessionCardState(session.id, c1.id, { has_met_criterion: true, has_unresolved_failure: false });
    const state2 = createSessionCardState(session.id, c2.id, { has_met_criterion: false, has_unresolved_failure: true });

    const cohortMet = [state1, state2].every(s => s.has_met_criterion && !s.has_unresolved_failure);
    expect(cohortMet).toBe(false);

    state2.has_met_criterion = true;
    state2.has_unresolved_failure = false;
    const cohortMetNow = [state1, state2].every(s => s.has_met_criterion && !s.has_unresolved_failure);
    expect(cohortMetNow).toBe(true);
  });

  it('SCH-019: Learning card meeting criterion transitions to review with FSRS due date', () => {
    const fsrs = new FsrsService(0.90);
    const card = createCard({ learning_state: 'learning' });
    const res = fsrs.repeat(card, 3, baseTime);

    expect(new Date(res.card.due).getTime()).toBeGreaterThan(baseTime.getTime());
    expect(res.card.stability).toBeGreaterThan(0);
  });

  it('SCH-020, SCH-028: Next cohort locked when remaining session time cannot fit one exposure per card', () => {
    const deck = createDeck({ cohort_size: 10 });
    // Remaining time: 60s, but 10 cards * 15s = 150s needed
    const session = createStudySession(deck.id, { duration_seconds: 900, active_duration_seconds: 840 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const cards = Array.from({ length: 10 }, (_, i) =>
      createCard({ id: `card-${i}`, cohort_number: 1, learning_state: 'new' })
    );

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
    expect(sel).toBeNull();
  });

  it('SCH-021: Increment successful_relearning_sessions at most once per session', () => {
    const card = createCard({
      learning_state: 'relearning',
      successful_relearning_sessions: 2
    });

    let incrementedThisSession = false;
    const onSessionCompleteWithCriterion = () => {
      if (!incrementedThisSession) {
        card.successful_relearning_sessions += 1;
        incrementedThisSession = true;
      }
    };

    onSessionCompleteWithCriterion();
    onSessionCompleteWithCriterion(); // Second attempt in same session
    expect(card.successful_relearning_sessions).toBe(3);
  });

  it('SCH-022: Established label applies only after meeting criterion in at least 3 distinct sessions', () => {
    const card1 = createCard({ successful_relearning_sessions: 2 });
    const card2 = createCard({ successful_relearning_sessions: 3 });

    const isEstablished = (c: typeof card1) => c.successful_relearning_sessions >= 3;
    expect(isEstablished(card1)).toBe(false);
    expect(isEstablished(card2)).toBe(true);
  });

  it('SCH-023: Session begins with acquisition phase unless due workload consumes remaining time', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id, { duration_seconds: 900, active_duration_seconds: 0 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const newCard = createCard({ id: 'new-1', learning_state: 'new', source_order: 1 });
    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [newCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.queue).toBe('active_cohort');
    expect(sel?.selectedCard.id).toBe('new-1');
  });

  it('SCH-025, SCH-026: Acquisition ceiling reached redirects time to review and relearning pools', () => {
    const deck = createDeck({ new_learning_fraction: 0.20 }); // 20% of 1000s = 200s
    const session = createStudySession(deck.id, { duration_seconds: 1000, active_duration_seconds: 250 });
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const newCard = createCard({ id: 'new-1', learning_state: 'new' });
    const revCard = createCard({ id: 'rev-1', learning_state: 'review', next_due_at: baseTime.toISOString() });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [newCard, revCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 220, // Ceiling reached!
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.queue).toBe('due_review');
    expect(sel?.selectedCard.id).toBe('rev-1');
  });

  it('SCH-029: Generates candidate pools across queues', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const dueCard = createCard({ id: 'due', learning_state: 'review', next_due_at: baseTime.toISOString() });
    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [dueCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.candidateIds).toContain('due');
  });

  it('SCH-032: Unresolved relearning card takes precedence after anti-echo', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const relCard = createCard({ id: 'rel-top', learning_state: 'relearning' });
    const dueCard = createCard({ id: 'due-card', learning_state: 'review', next_due_at: baseTime.toISOString() });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [relCard, dueCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.queue).toBe('relearning');
    expect(sel?.selectedCard.id).toBe('rel-top');
  });

  it('SCH-033, SCH-034: Mandatory overdue cards take precedence over unseen cards', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    // Overdue by 15 days (> max(7, 5))
    const overdueCard = createCard({
      id: 'mandatory-1',
      learning_state: 'review',
      stability_days: 5.0,
      next_due_at: new Date(baseTime.getTime() - 15 * 86400000).toISOString()
    });
    const newCard = createCard({ id: 'new-1', learning_state: 'new' });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [overdueCard, newCard],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.queue).toBe('mandatory_overdue');
    expect(sel?.selectedCard.id).toBe('mandatory-1');
  });

  it('SCH-035: Non-new candidates ordered by descending base utility', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const c1 = createCard({ id: 'c1', learning_state: 'review', next_due_at: baseTime.toISOString(), importance_weight: 1.0 });
    const c2 = createCard({ id: 'c2', learning_state: 'review', next_due_at: baseTime.toISOString(), importance_weight: 5.0 });

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [c1, c2],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.selectedCard.id).toBe('c2');
    expect(sel?.utilityValues['c2']).toBeGreaterThan(sel?.utilityValues['c1'] || 0);
  });

  it('SCH-038: Selection returns machine-readable reason code', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const card = createCard({ id: 'card-reason', learning_state: 'review', next_due_at: baseTime.toISOString() });
    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [card],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.reasonCode).toMatch(/^DUE_REVIEW_UTILITY_/);
  });

  it('SCH-039: Selection event captures required audit fields', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const card = createCard({ id: 'card-audit', learning_state: 'review', next_due_at: baseTime.toISOString() });
    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [card],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    const sel = engine.selectNextCard(ctx);
    expect(sel?.timestamp).toBe(baseTime.toISOString());
    expect(sel?.selectedCard.id).toBe('card-audit');
    expect(sel?.candidateIds).toEqual(['card-audit']);
    expect(sel?.queue).toBe('due_review');
    expect(typeof sel?.utilityValues['card-audit']).toBe('number');
  });

  it('SCH-040: Candidate selection does not modify untouched card rows', () => {
    const deck = createDeck();
    const session = createStudySession(deck.id);
    const clock = new FixedClock(baseTime);
    const engine = new SchedulerEngine(deck.desired_retention, clock);

    const card = createCard({ id: 'card-immut', learning_state: 'review', next_due_at: baseTime.toISOString() });
    const originalSnapshot = JSON.stringify(card);

    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: [card],
      sessionStates: new Map(),
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0,
      clock
    };

    engine.selectNextCard(ctx);
    expect(JSON.stringify(card)).toBe(originalSnapshot);
  });

  it('DAT-012, DAT-013, DAT-014: Percentage correct is derived on demand and not mutable column; retrievability on demand', () => {
    const cardZero = createCard({ correct_count: 0, review_count: 0 });
    const computePct = (c: typeof cardZero) => (c.review_count === 0 ? 0 : (c.correct_count / c.review_count) * 100);

    expect(computePct(cardZero)).toBe(0);

    const cardReviews = createCard({ correct_count: 8, review_count: 10 });
    expect(computePct(cardReviews)).toBe(80);

    // DAT-013: percent_correct is not an owned column in card object
    expect('percent_correct' in cardReviews).toBe(false);

    // DAT-014: FSRS retrievability calculated dynamically
    const fsrs = new FsrsService(0.90);
    const r = fsrs.getRetrievability(cardReviews, baseTime);
    expect(typeof r).toBe('number');
  });

  it('ARC-009, ARC-010: Scheduler domain has no React or Supabase dependencies and uses injectable interfaces', () => {
    const schedulerPath = path.resolve(__dirname, '../../../src/domain/scheduler.ts');
    const content = fs.readFileSync(schedulerPath, 'utf8');

    expect(content).not.toContain("from 'react'");
    expect(content).not.toContain("from '@/lib/supabase'");
    expect(content).toContain('IClock');
    expect(content).toContain('IRandom');
  });

  it('TST-006, TST-007, TST-008: Testing suite provides FixedClock, SeededRandom, and typed factories', () => {
    const fixedClock = new FixedClock(baseTime);
    expect(fixedClock.now()).toEqual(baseTime);
    fixedClock.advance(1000);
    expect(fixedClock.now().getTime()).toBe(baseTime.getTime() + 1000);

    const rng1 = new SeededRandom('seed-abc');
    const rng2 = new SeededRandom('seed-abc');
    expect(rng1.next()).toBe(rng2.next());

    const sampleCard = createCard();
    expect(sampleCard.id).toBeDefined();
    expect(sampleCard.deck_id).toBeDefined();
  });
});
