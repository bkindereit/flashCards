/**
 * Adaptive Flashcard Selection Engine
 * Implements SCH-010..SCH-040 of FCA-SRS-001
 */

import { Card, Deck, StudySession, SessionCardState, QueueName, SelectionResult, SelectionCandidate } from './types';
import { FsrsService } from './fsrsService';
import { IClock, IRandom, SystemClock, SystemRandom } from './clock';

export interface SchedulerContext {
  deck: Deck;
  session: StudySession;
  allCards: Card[];
  sessionStates: Map<string, SessionCardState>; // card_id -> state
  lastCardId?: string;
  cumulativeNewLearningSeconds: number;
  estimatedReviewSeconds: number;
  clock?: IClock;
  random?: IRandom;
}

export class SchedulerEngine {
  private readonly clock: IClock;
  private readonly random: IRandom;
  private readonly fsrsService: FsrsService;

  constructor(desiredRetention: number = 0.90, clock?: IClock, random?: IRandom) {
    this.clock = clock ?? new SystemClock();
    this.random = random ?? new SystemRandom();
    this.fsrsService = new FsrsService(desiredRetention);
  }

  /**
   * Main selection method (SCH-029..SCH-040)
   */
  selectNextCard(ctx: SchedulerContext): SelectionResult | null {
    const now = (ctx.clock ?? this.clock).now();
    const rng = ctx.random ?? this.random;
    const { deck, session, allCards, sessionStates, lastCardId } = ctx;

    // Filter out suspended and archived cards (SCH-030)
    const activeCards = allCards.filter(c => !c.suspended_at && !c.archived_at);
    if (activeCards.length === 0) {
      return null;
    }

    const estimatedSecs = ctx.estimatedReviewSeconds > 0 ? ctx.estimatedReviewSeconds : 15.0;
    const examDate = deck.exam_date ? new Date(deck.exam_date) : null;

    // Remaining session time
    const sessionDuration = session.duration_seconds;
    const elapsedActive = session.active_duration_seconds;
    const remainingSessionSecs = Math.max(0, sessionDuration - elapsedActive);

    // Ceiling for new learning time (SCH-024)
    const newLearningTimeCeiling = deck.new_learning_fraction * sessionDuration;

    // 1. Identify queues
    // Queue 1: Relearning cards
    // Queue 2: Mandatory overdue cards (> max(7 days, scheduled_interval))
    // Queue 3: Due review cards (next_due_at <= now)
    // Queue 4: Active cohort (new / learning cards)
    // Queue 5: Beneficial early review

    const relearningCandidates: Card[] = [];
    const mandatoryOverdueCandidates: Card[] = [];
    const dueReviewCandidates: Card[] = [];
    const earlyReviewCandidates: Card[] = [];
    const unseenCards: Card[] = [];
    const activeLearningCards: Card[] = [];

    // Map cards into respective preliminary buckets
    for (const card of activeCards) {
      const sState = sessionStates.get(card.id);

      if (card.learning_state === 'relearning') {
        relearningCandidates.push(card);
      } else if (card.learning_state === 'review') {
        if (!card.next_due_at) {
          dueReviewCandidates.push(card);
        } else {
          const dueDate = new Date(card.next_due_at);
          if (dueDate.getTime() <= now.getTime()) {
            // Check mandatory overdue (SCH-033: overdue by > max(7 days, 1 scheduled interval))
            const scheduledIntervalDays = Math.max(1, card.stability_days || 1);
            const overdueThresholdDays = Math.max(7, scheduledIntervalDays);
            const overdueDays = (now.getTime() - dueDate.getTime()) / 86400000;

            if (overdueDays > overdueThresholdDays) {
              mandatoryOverdueCandidates.push(card);
            } else {
              dueReviewCandidates.push(card);
            }
          } else {
            earlyReviewCandidates.push(card);
          }
        }
      } else if (card.learning_state === 'new') {
        unseenCards.push(card);
      } else if (card.learning_state === 'learning') {
        // If in session state, check if unresolved failure or pending criterion
        if (!sState || !sState.has_met_criterion) {
          activeLearningCards.push(card);
        } else {
          earlyReviewCandidates.push(card);
        }
      }
    }

    // SCH-024: Cumulative valid interaction time on new and learning cards shall not exceed the deck's new-learning time fraction while an eligible review or relearning card exists.
    const hasEligibleReviewOrRelearning = relearningCandidates.length > 0 ||
      mandatoryOverdueCandidates.length > 0 ||
      dueReviewCandidates.length > 0 ||
      earlyReviewCandidates.length > 0;
    const acquisitionCeilingReached = hasEligibleReviewOrRelearning &&
      (ctx.cumulativeNewLearningSeconds >= newLearningTimeCeiling);

    // Workload estimation (SCH-027): due and relearning workload
    const dueAndRelearningCount = relearningCandidates.length + mandatoryOverdueCandidates.length + dueReviewCandidates.length;
    const dueWorkloadSecs = dueAndRelearningCount * estimatedSecs;
    const dueWorkloadConsumesRemaining = dueWorkloadSecs >= remainingSessionSecs;

    // -------------------------------------------------------------
    // Candidate evaluation with anti-echo and delay rules (SCH-016, SCH-017, SCH-031, SCH-032)
    // -------------------------------------------------------------

    // Helper for relearning / failed card eligibility
    const isRetryEligible = (_card: Card, sState?: SessionCardState, totalOtherEligible: number = 0) => {
      if (!sState || !sState.has_unresolved_failure) {
        return true;
      }
      if (totalOtherEligible < 2) {
        return true; // SCH-017: except when fewer than two other cards are eligible
      }
      const minDelayMs = deck.min_failed_retry_delay_seconds * 1000;
      const lastFailTime = sState.last_failure_at ? new Date(sState.last_failure_at).getTime() : 0;
      const delayMet = (now.getTime() - lastFailTime) >= minDelayMs;
      const interveningMet = sState.intervening_cards_since_failure >= deck.min_intervening_cards;
      return delayMet && interveningMet;
    };

    // Filter eligible relearning
    const eligibleRelearning = relearningCandidates.filter(c => {
      const sState = sessionStates.get(c.id);
      return isRetryEligible(c, sState, activeCards.length - 1);
    });

    // Determine active cohort (SCH-010, SCH-011, SCH-020)
    // Find active cohort number: smallest cohort number with cards that have not met criterion
    const cohortSize = deck.cohort_size;
    const sortedNewCards = unseenCards.sort((a, b) => a.source_order - b.source_order);

    let activeCohortCards: Card[] = [];
    if (!dueWorkloadConsumesRemaining && (!acquisitionCeilingReached || activeLearningCards.length > 0)) {
      // Find current active cohort
      // If there are learning cards, their cohort is active
      if (activeLearningCards.length > 0) {
        activeCohortCards = activeLearningCards.filter(c => {
          const sState = sessionStates.get(c.id);
          return isRetryEligible(c, sState, activeCards.length - 1);
        });
      } else if (!acquisitionCeilingReached && sortedNewCards.length > 0) {
        // Can introduce new cards from active cohort if time allows
        const firstNew = sortedNewCards[0];
        if (firstNew) {
          const activeCohortNum = firstNew.cohort_number || (Math.floor((firstNew.source_order - 1) / cohortSize) + 1);
          // Check if sufficient time remains for one estimated first exposure per card in cohort (SCH-020, SCH-028)
          const cohortCards = sortedNewCards.filter(c => (c.cohort_number || (Math.floor((c.source_order - 1) / cohortSize) + 1)) === activeCohortNum);
          const exposureTime = cohortCards.length * estimatedSecs;

          if (exposureTime <= remainingSessionSecs) {
            activeCohortCards = cohortCards.slice(0, cohortSize);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // PRIORITY SELECTION HIERARCHY
    // 1. Eligible relearning
    // 2. Mandatory overdue
    // 3. Due review
    // 4. Active cohort (unless suppressed by workload or ceiling)
    // 5. Beneficial early review
    // -------------------------------------------------------------

    type PoolEntry = { queue: QueueName; cards: Card[]; reasonPrefix: string };
    const pools: PoolEntry[] = [
      { queue: 'relearning', cards: eligibleRelearning, reasonPrefix: 'RELEARNING_PRIORITY' },
      { queue: 'mandatory_overdue', cards: mandatoryOverdueCandidates, reasonPrefix: 'MANDATORY_OVERDUE' },
      { queue: 'due_review', cards: dueReviewCandidates, reasonPrefix: 'DUE_REVIEW' },
      { queue: 'active_cohort', cards: activeCohortCards, reasonPrefix: 'ACTIVE_COHORT' },
      { queue: 'early_review', cards: earlyReviewCandidates, reasonPrefix: 'EARLY_REVIEW' }
    ];

    for (const pool of pools) {
      if (pool.cards.length === 0) continue;

      // Anti-echo filter (SCH-031): exclude immediately preceding card when >= 2 other eligible cards exist
      let candidates = pool.cards;
      if (lastCardId && candidates.some(c => c.id === lastCardId)) {
        if (activeCards.length >= 3) {
          const filtered = candidates.filter(c => c.id !== lastCardId);
          if (filtered.length > 0) {
            candidates = filtered;
          }
        }
      }

      // Calculate utility for candidates (SCH-035)
      const scored: SelectionCandidate[] = candidates.map(card => {
        const u = this.fsrsService.calculateUtility(card, now, examDate, estimatedSecs);
        return {
          card,
          queue: pool.queue,
          base_utility: u.base_utility,
          expected_gain: u.expected_gain,
          r_now: u.r_now,
          p0: u.p0,
          pg: u.pg,
          pa: u.pa,
          reason_code: `${pool.reasonPrefix}_UTILITY_${u.base_utility.toFixed(4)}`
        };
      });

      // SCH-035: Candidates within the same non-new queue shall be ordered by descending base utility.
      // For active_cohort, cards are ordered by source_order ascending (SCH-010).
      if (pool.queue === 'active_cohort') {
        scored.sort((a, b) => a.card.source_order - b.card.source_order);
      } else {
        // Sort non-new queues by descending base_utility (SCH-035)
        scored.sort((a, b) => b.base_utility - a.base_utility);
      }

      // Tie-breaking (SCH-036, SCH-037): equal score within tolerance 1e-6
      let chosenCandidate: SelectionCandidate;
      if (pool.queue === 'active_cohort') {
        // Deterministic pick based on sorted order for active cohort
        chosenCandidate = scored[0]!;
      } else {
        const bestScore = scored[0]?.base_utility ?? 0;
        const epsilon = 1e-6;
        const tiedCandidates = scored.filter(c => Math.abs(c.base_utility - bestScore) <= epsilon);

        if (tiedCandidates.length <= 1) {
          chosenCandidate = tiedCandidates[0] ?? scored[0]!;
        } else {
          // Seeded random pick among ties
          const idx = Math.floor(rng.next() * tiedCandidates.length);
          chosenCandidate = tiedCandidates[idx] ?? scored[0]!;
        }
      }

      const utilityValues: Record<string, number> = {};
      for (const s of scored) {
        utilityValues[s.card.id] = s.base_utility;
      }

      return {
        selectedCard: chosenCandidate.card,
        queue: chosenCandidate.queue,
        reasonCode: chosenCandidate.reason_code,
        seed: rng.getSeed(),
        candidateIds: scored.map(s => s.card.id),
        utilityValues,
        timestamp: now.toISOString()
      };
    }

    return null;
  }
}
