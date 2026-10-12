/**
 * FSRS Memory Service & Utility Calculation
 * Implements SCH-001..SCH-009 and Section 9.4 of FCA-SRS-001
 */

import {
  fsrs,
  Rating,
  State,
  createEmptyCard,
  Card as FSRSCard,
  FSRSParameters
} from 'ts-fsrs';
import { Card } from './types';

export const FSRS_PACKAGE_VERSION = '4.4.1';
export const FSRS_PARAMETER_SET_VERSION = 'default-v4';
export const SCHEDULING_POLICY_VERSION = 'fca-v1.0';

/**
 * Maps application LearningState to FSRS State
 */
export function toFsrsState(state: string): State {
  switch (state) {
    case 'new':
      return State.New;
    case 'learning':
      return State.Learning;
    case 'review':
      return State.Review;
    case 'relearning':
      return State.Relearning;
    default:
      return State.New;
  }
}

/**
 * Converts domain Card into FSRSCard representation
 */
export function toFsrsCard(card: Card, now: Date): FSRSCard {
  if (card.learning_state === 'new' && card.review_count === 0) {
    const empty = createEmptyCard(now);
    return empty;
  }

  const due = card.next_due_at ? new Date(card.next_due_at) : now;
  const lastReview = card.last_review_at 
    ? new Date(card.last_review_at) 
    : (card.learning_state === 'new' && card.review_count === 0 
        ? undefined 
        : new Date(due.getTime() - Math.max(1, card.stability_days || 1) * 86400000));
  const elapsedDays = lastReview ? Math.max(0, (now.getTime() - lastReview.getTime()) / 86400000) : 0;

  return {
    due,
    stability: card.stability_days,
    difficulty: card.difficulty,
    elapsed_days: elapsedDays,
    scheduled_days: 0,
    reps: card.review_count,
    lapses: card.lapse_count,
    state: toFsrsState(card.learning_state),
    last_review: lastReview
  };
}

export class FsrsService {
  private readonly desiredRetention: number;
  private readonly f: ReturnType<typeof fsrs>;

  constructor(desiredRetention: number = 0.90, customParams?: Partial<FSRSParameters>) {
    this.desiredRetention = desiredRetention;
    this.f = fsrs({
      request_retention: desiredRetention,
      ...customParams
    });
  }

  getDesiredRetention(): number {
    return this.desiredRetention;
  }

  /**
   * Calculates retrievability R(t) at given timestamp
   */
  getRetrievability(card: Card, atTime: Date): number {
    if (card.learning_state === 'new') {
      return 1.0;
    }
    if (card.stability_days <= 0 || !card.last_review_at) {
      return 1.0;
    }

    const fsrsCard = toFsrsCard(card, atTime);
    // Use fsrs library retrievability calculator (returns 0..1 number)
    try {
      const rawR = this.f.get_retrievability(fsrsCard, atTime, false);
      const r = typeof rawR === 'number' ? rawR : parseFloat(String(rawR).replace('%', '')) / 100;
      return Math.min(1.0, Math.max(0.0, r));
    } catch {
      return 1.0;
    }
  }

  /**
   * Applies grade rating: Rating.Good (3) or Rating.Again (1)
   */
  repeat(card: Card, rating: Rating.Good | Rating.Again, reviewTime: Date) {
    const fsrsCard = toFsrsCard(card, reviewTime);
    const item = this.f.repeat(fsrsCard, reviewTime);
    return item[rating];
  }

  /**
   * Calculates candidate utility per Section 9.4:
   * - H: exam date or max(t + 365 days, next_due_at)
   * - R_now: FSRS retrievability at t
   * - P0: predicted retrievability at H with no review at t
   * - Pg: predicted retrievability at H after Good at t
   * - Pa: predicted retrievability at H after Again at t with corrective feedback
   * - expected_gain = R_now * Pg + (1 - R_now) * Pa - P0
   * - base_utility = importance_weight * expected_gain / estimated_review_seconds
   */
  calculateUtility(
    card: Card,
    now: Date,
    examDate?: Date | null,
    estimatedReviewSeconds: number = 15.0
  ): {
    r_now: number;
    p0: number;
    pg: number;
    pa: number;
    expected_gain: number;
    base_utility: number;
    horizon: Date;
  } {
    // 1. Determine horizon H
    let horizon: Date;
    if (examDate && examDate.getTime() > now.getTime()) {
      horizon = examDate;
    } else {
      const oneYearOut = new Date(now.getTime() + 365 * 86400000);
      const dueDate = card.next_due_at ? new Date(card.next_due_at) : now;
      horizon = dueDate.getTime() > oneYearOut.getTime() ? dueDate : oneYearOut;
    }

    // 2. R_now
    const r_now = this.getRetrievability(card, now);

    const safeGetR = (fCard: FSRSCard, date: Date) => {
      try {
        if (!fCard.last_review) return 1.0;
        const raw = this.f.get_retrievability(fCard, date, false);
        return typeof raw === 'number' ? raw : parseFloat(String(raw).replace('%', '')) / 100;
      } catch {
        return 1.0;
      }
    };

    // 3. P0: Retrievability at H with no review at now
    const fsrsCardCurrent = toFsrsCard(card, now);
    const p0 = safeGetR(fsrsCardCurrent, horizon);

    // 4. Pg: Simulate Good at now
    const repeatRecord = this.f.repeat(fsrsCardCurrent, now);
    const goodCard = repeatRecord[Rating.Good].card;
    const pg = safeGetR(goodCard, horizon);

    // 5. Pa: Simulate Again at now
    const againCard = repeatRecord[Rating.Again].card;
    const pa = safeGetR(againCard, horizon);

    // 6. Expected gain & base utility
    const expected_gain = r_now * pg + (1.0 - r_now) * pa - p0;
    const reviewSecs = Math.max(1.0, estimatedReviewSeconds);
    const weight = Math.max(0.001, card.importance_weight || 1.0);
    const base_utility = (weight * expected_gain) / reviewSecs;

    return {
      r_now,
      p0,
      pg,
      pa,
      expected_gain,
      base_utility,
      horizon
    };
  }
}
