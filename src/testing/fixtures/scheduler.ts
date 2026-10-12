/**
 * Canonical Scheduler Fixtures (FCA-VVP §10.2, SCHF-001..SCHF-012)
 * Typed factory builders creating exact test states for scheduler validation.
 */

import { Card, Deck, StudySession, SessionCardState } from '@/domain/types';
import { createDeck, createCard, createStudySession, createSessionCardState } from '@/testing/factories';
import { IClock, FixedClock } from '@/domain/clock';

export interface SchedulerFixtureState {
  id: string;
  description: string;
  deck: Deck;
  session: StudySession;
  allCards: Card[];
  sessionStates: Map<string, SessionCardState>;
  clock: IClock;
  cumulativeNewLearningSeconds: number;
  estimatedReviewSeconds: number;
}

const baseTime = new Date('2026-06-01T12:00:00Z');

export function createSchedulerFixture(fixtureId: string): SchedulerFixtureState {
  const deck = createDeck({
    cohort_size: 10,
    desired_retention: 0.90,
    new_learning_fraction: 0.30,
    min_failed_retry_delay_seconds: 60,
    min_intervening_cards: 3
  });
  const session = createStudySession(deck.id, { duration_seconds: 900 });
  const clock = new FixedClock(baseTime);
  const sessionStates = new Map<string, SessionCardState>();

  switch (fixtureId) {
    case 'SCHF-001': {
      // Ten unseen cards, no review cards
      const allCards = Array.from({ length: 10 }, (_, i) =>
        createCard({
          deck_id: deck.id,
          learning_state: 'new',
          source_order: i + 1,
          cohort_number: 1
        })
      );
      return {
        id: 'SCHF-001',
        description: 'Ten unseen cards, no review cards',
        deck,
        session,
        allCards,
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-002': {
      // One failed learning card with delay not met
      const failedCard = createCard({
        deck_id: deck.id,
        learning_state: 'learning',
        source_order: 1,
        cohort_number: 1
      });
      const otherCard1 = createCard({
        deck_id: deck.id,
        learning_state: 'new',
        source_order: 2,
        cohort_number: 1
      });
      const otherCard2 = createCard({
        deck_id: deck.id,
        learning_state: 'new',
        source_order: 3,
        cohort_number: 1
      });
      // Delay is 60s, failed 20s ago; totalOtherEligible = 2 >= 2 triggers delay check
      const sState = createSessionCardState(session.id, failedCard.id, {
        has_met_criterion: false,
        has_unresolved_failure: true,
        last_failure_at: new Date(baseTime.getTime() - 20000).toISOString(),
        intervening_cards_since_failure: 1
      });
      sessionStates.set(failedCard.id, sState);

      return {
        id: 'SCHF-002',
        description: 'One failed learning card with delay not met',
        deck,
        session,
        allCards: [failedCard, otherCard1, otherCard2],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 30,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-003': {
      // One failed learning card with delay and intervening count met
      const failedCard = createCard({
        deck_id: deck.id,
        learning_state: 'learning',
        source_order: 1,
        cohort_number: 1
      });
      const otherCards = Array.from({ length: 4 }, (_, i) =>
        createCard({
          deck_id: deck.id,
          learning_state: 'new',
          source_order: i + 2,
          cohort_number: 1
        })
      );
      // Delay 70s ago (> 60s), intervening 4 cards (>= 3)
      const sState = createSessionCardState(session.id, failedCard.id, {
        has_met_criterion: false,
        has_unresolved_failure: true,
        last_failure_at: new Date(baseTime.getTime() - 70000).toISOString(),
        intervening_cards_since_failure: 4
      });
      sessionStates.set(failedCard.id, sState);

      return {
        id: 'SCHF-003',
        description: 'One failed learning card with delay and intervening count met',
        deck,
        session,
        allCards: [failedCard, ...otherCards],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 50,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-004': {
      // Completed cohort and locked next cohort (ceiling reached)
      const deckC = createDeck({ cohort_size: 5, new_learning_fraction: 0.10 }); // 90s ceiling
      const sessC = createStudySession(deckC.id, { duration_seconds: 900 });
      const cards = Array.from({ length: 10 }, (_, i) =>
        createCard({
          deck_id: deckC.id,
          learning_state: i < 5 ? 'review' : 'new',
          next_due_at: i < 5 ? new Date(baseTime.getTime() + 5 * 86400000).toISOString() : undefined, // future due
          last_review_at: i < 5 ? new Date(baseTime.getTime() - 86400000).toISOString() : undefined,
          source_order: i + 1,
          cohort_number: Math.floor(i / 5) + 1
        })
      );
      return {
        id: 'SCHF-004',
        description: 'Completed cohort and locked next cohort',
        deck: deckC,
        session: sessC,
        allCards: cards,
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 100, // exceeds 90s ceiling
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-005': {
      // Manageable due pool plus unseen cards
      const dueCard = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        stability_days: 5.0,
        last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
        next_due_at: baseTime.toISOString()
      });
      const unseenCards = Array.from({ length: 5 }, (_, i) =>
        createCard({
          deck_id: deck.id,
          learning_state: 'new',
          source_order: i + 1,
          cohort_number: 1
        })
      );
      return {
        id: 'SCHF-005',
        description: 'Manageable due pool plus unseen cards',
        deck,
        session,
        allCards: [dueCard, ...unseenCards],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-006': {
      // Due workload equal to remaining session capacity (SCH-027)
      // 10 due cards * 15s = 150s, remaining session = 150s
      const sess = createStudySession(deck.id, { duration_seconds: 300, active_duration_seconds: 150 });
      const dueCards = Array.from({ length: 10 }, (_, i) =>
        createCard({
          deck_id: deck.id,
          learning_state: 'review',
          source_order: i + 1,
          stability_days: 3.0,
          last_review_at: new Date(baseTime.getTime() - 3 * 86400000).toISOString(),
          next_due_at: baseTime.toISOString()
        })
      );
      const newCard = createCard({ deck_id: deck.id, learning_state: 'new', source_order: 11 });
      return {
        id: 'SCHF-006',
        description: 'Due workload equal to remaining session capacity',
        deck,
        session: sess,
        allCards: [...dueCards, newCard],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-007': {
      // Due workload greater than remaining capacity (SCH-027)
      // 15 due cards * 15s = 225s > 100s remaining
      const sess = createStudySession(deck.id, { duration_seconds: 300, active_duration_seconds: 200 });
      const dueCards = Array.from({ length: 15 }, (_, i) =>
        createCard({
          deck_id: deck.id,
          learning_state: 'review',
          source_order: i + 1,
          stability_days: 3.0,
          last_review_at: new Date(baseTime.getTime() - 3 * 86400000).toISOString(),
          next_due_at: baseTime.toISOString()
        })
      );
      const newCard = createCard({ deck_id: deck.id, learning_state: 'new', source_order: 16 });
      return {
        id: 'SCHF-007',
        description: 'Due workload greater than remaining capacity',
        deck,
        session: sess,
        allCards: [...dueCards, newCard],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-008': {
      // Overdue mandatory cards (SCH-033: overdue > max(7 days, stability))
      const mandatoryOverdueCard = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        stability_days: 5.0,
        last_review_at: new Date(baseTime.getTime() - 20 * 86400000).toISOString(),
        next_due_at: new Date(baseTime.getTime() - 15 * 86400000).toISOString()
      });
      const regularDueCard = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        stability_days: 5.0,
        last_review_at: new Date(baseTime.getTime() - 6 * 86400000).toISOString(),
        next_due_at: new Date(baseTime.getTime() - 86400000).toISOString()
      });
      return {
        id: 'SCHF-008',
        description: 'Overdue mandatory cards',
        deck,
        session,
        allCards: [mandatoryOverdueCard, regularDueCard],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-009': {
      // Equal utility tie candidates with fixed seed (SCH-036, SCH-037)
      const cardA = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        stability_days: 5.0,
        importance_weight: 1.0,
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
      return {
        id: 'SCHF-009',
        description: 'Equal utility tie candidates with fixed seed',
        deck,
        session,
        allCards: [cardA, cardB],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-010': {
      // Exam in seven days with weak and strong candidates
      const examDate = new Date(baseTime.getTime() + 7 * 86400000);
      const deckWithExam = createDeck({ exam_date: examDate.toISOString() });
      const weakCard = createCard({
        deck_id: deckWithExam.id,
        learning_state: 'review',
        stability_days: 2.0,
        difficulty: 8.0,
        last_review_at: new Date(baseTime.getTime() - 2 * 86400000).toISOString(),
        next_due_at: baseTime.toISOString(),
        source_order: 1
      });
      const strongCard = createCard({
        deck_id: deckWithExam.id,
        learning_state: 'review',
        stability_days: 30.0,
        difficulty: 2.0,
        last_review_at: new Date(baseTime.getTime() - 2 * 86400000).toISOString(),
        next_due_at: new Date(baseTime.getTime() + 28 * 86400000).toISOString(),
        source_order: 2
      });
      return {
        id: 'SCHF-010',
        description: 'Exam in seven days with weak and strong candidates',
        deck: deckWithExam,
        session,
        allCards: [weakCard, strongCard],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-011': {
      // Suspended high-utility card
      const suspendedCard = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        suspended_at: baseTime.toISOString(),
        importance_weight: 10.0,
        stability_days: 1.0,
        last_review_at: new Date(baseTime.getTime() - 86400000).toISOString(),
        next_due_at: baseTime.toISOString()
      });
      const normalCard = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        importance_weight: 1.0,
        stability_days: 1.0,
        last_review_at: new Date(baseTime.getTime() - 86400000).toISOString(),
        next_due_at: baseTime.toISOString()
      });
      return {
        id: 'SCHF-011',
        description: 'Suspended high-utility card',
        deck,
        session,
        allCards: [suspendedCard, normalCard],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    case 'SCHF-012': {
      // Review card that lapses into relearning
      const relearningCard = createCard({
        deck_id: deck.id,
        learning_state: 'relearning',
        stability_days: 2.0,
        lapse_count: 1,
        last_review_at: new Date(baseTime.getTime() - 86400000).toISOString(),
        next_due_at: baseTime.toISOString()
      });
      const regularReviewCard = createCard({
        deck_id: deck.id,
        learning_state: 'review',
        stability_days: 5.0,
        last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
        next_due_at: baseTime.toISOString()
      });
      return {
        id: 'SCHF-012',
        description: 'Review card that lapses into relearning',
        deck,
        session,
        allCards: [relearningCard, regularReviewCard],
        sessionStates,
        clock,
        cumulativeNewLearningSeconds: 0,
        estimatedReviewSeconds: 15.0
      };
    }

    default:
      throw new Error(`Unknown scheduler fixture ID: ${fixtureId}`);
  }
}
