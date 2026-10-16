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
import { Card, AdaptiveWeights } from './types';

export const FSRS_PACKAGE_VERSION = '4.4.1';
export const FSRS_PARAMETER_SET_VERSION = 'default-v4';
export const SCHEDULING_POLICY_VERSION = 'fca-v1.0';

export const DEFAULT_ADAPTIVE_WEIGHTS: AdaptiveWeights = {
  w_fsrs: 1.00,
  w_streak: 0.25,
  w_recent: 0.30,
  w_leech: 0.35,
  w_complexity: 0.15,
  w_cluster: 0.40
};

const CLUSTER_STOPWORDS = new Set([
  'what', 'which', 'where', 'when', 'who', 'whom', 'whose', 'why', 'how',
  'the', 'and', 'for', 'are', 'with', 'from', 'that', 'this', 'does', 'define',
  'sample', 'question', 'answer', 'card', 'test', 'item', 'example'
]);

/**
 * SCH-041: Derives or retrieves consecutive correct streak count
 */
export function deriveStreakCount(card: Card): number {
  if (typeof card.streak_count === 'number') {
    return Math.max(0, Math.floor(card.streak_count));
  }
  if (card.last_rating === 1 || card.learning_state === 'relearning') {
    return 0;
  }
  if (card.incorrect_count === 0) {
    return Math.max(0, card.correct_count);
  }
  return Math.max(0, card.correct_count - card.incorrect_count);
}

/**
 * SCH-041: Updates streak count after a binary review grade
 */
export function updateStreakCount(prevStreak: number, result: 'correct' | 'incorrect'): number {
  return result === 'correct' ? Math.max(0, prevStreak) + 1 : 0;
}

/**
 * SCH-042: Derives or retrieves EWMA recent accuracy in [0, 1]
 */
export function deriveRecentAccuracy(card: Card): number {
  if (typeof card.recent_accuracy === 'number') {
    return Math.min(1.0, Math.max(0.0, card.recent_accuracy));
  }
  if (card.review_count <= 0) {
    return 1.0;
  }
  const baseRatio = card.correct_count / card.review_count;
  if (card.last_rating === 1) {
    return Math.max(0.0, 0.75 * baseRatio);
  }
  return Math.min(1.0, Math.max(0.0, baseRatio));
}

/**
 * SCH-042: Updates EWMA recent accuracy after a binary review grade (default alpha = 0.25)
 */
export function updateRecentAccuracy(
  prevRecent: number | undefined,
  reviewCount: number,
  result: 'correct' | 'incorrect',
  alpha: number = 0.25
): number {
  const outcome = result === 'correct' ? 1.0 : 0.0;
  if (reviewCount <= 0 || typeof prevRecent !== 'number') {
    return outcome;
  }
  const clampedAlpha = Math.min(1.0, Math.max(0.05, alpha));
  return Math.min(1.0, Math.max(0.0, clampedAlpha * outcome + (1.0 - clampedAlpha) * prevRecent));
}

/**
 * SCH-043: Calculates leech severity score in [0, 1] from lapse and failure density
 */
export function computeLeechScore(card: Card): number {
  if (typeof card.leech_score === 'number') {
    return Math.min(1.0, Math.max(0.0, card.leech_score));
  }
  const raw = (2 * Math.max(0, card.lapse_count) + Math.max(0, card.incorrect_count - 1)) / 10.0;
  return Math.min(1.0, Math.max(0.0, raw));
}

/**
 * SCH-043: Calculates elapsed staleness score in [0, 1] for long-unasked cards
 */
export function computeStalenessScore(card: Card, now: Date): number {
  if (!card.last_review_at) {
    return 0.0;
  }
  const elapsedDays = Math.max(0, (now.getTime() - new Date(card.last_review_at).getTime()) / 86400000);
  const thresholdDays = Math.max(7.0, card.stability_days || 1.0);
  if (elapsedDays <= thresholdDays) {
    return 0.0;
  }
  return Math.min(1.0, (elapsedDays - thresholdDays) / 30.0);
}

/**
 * SCH-044: Derives structural complexity index in [0, 1] from prompt/answer structure
 * without penalizing response latency or recall fluency.
 */
export function computeComplexityIndex(questionText: string, answerText: string): number {
  const combined = `${questionText} ${answerText}`;
  const totalLen = questionText.length + answerText.length;
  const markerMatches = combined.match(/[\n;=+\-*/^%$]/g);
  const markerCount = markerMatches ? markerMatches.length : 0;
  if (totalLen <= 60 && markerCount === 0) {
    return 0.0;
  }
  const lengthComponent = Math.max(0, totalLen - 60) / 400.0;
  const structureComponent = 0.05 * markerCount;
  return Math.min(1.0, lengthComponent + structureComponent);
}

/**
 * SCH-045: Extracts semantic confusion cluster key from normalized card tokens
 */
export function computeClusterId(card: Card): string | null {
  if (card.cluster_id !== undefined) {
    return card.cluster_id;
  }
  const tokens = (card.normalized_question || card.question_text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !CLUSTER_STOPWORDS.has(t) && !/^\d+$/.test(t));

  return tokens[0] ?? null;
}

/**
 * SCH-046: Dynamically adjusts adaptive weights after a graded review based on
 * empirical recall prediction accuracy so effective predictors gain weight and
 * ineffective variables decay.
 */
export function calibrateAdaptiveWeights(
  weights: AdaptiveWeights,
  card: Card,
  rNow: number,
  result: 'correct' | 'incorrect',
  learningRate: number = 0.08
): AdaptiveWeights {
  const y = result === 'correct' ? 1.0 : 0.0;
  const streak = deriveStreakCount(card);
  const streakSignal = streak > 1 ? 1.0 - 1.0 / (1.0 + 0.25 * (streak - 1)) : 0.0;
  const recentAcc = deriveRecentAccuracy(card);
  const recentDeficit = (card.review_count > 1 || card.incorrect_count > 0)
    ? Math.max(0.0, 0.90 - recentAcc)
    : 0.0;
  const leechSignal = computeLeechScore(card);
  const complexitySignal = typeof card.complexity_index === 'number'
    ? card.complexity_index
    : computeComplexityIndex(card.question_text, card.answer_text);

  const clampWeight = (val: number) => Math.min(2.0, Math.max(0.05, Number(val.toFixed(4))));

  const streakDelta = learningRate * streakSignal * (y === 1.0 ? (1.0 - 0.5 * rNow) : -rNow);
  const recentDelta = learningRate * recentDeficit * (y === 0.0 ? rNow : -0.5 * (1.0 - rNow + 0.2));
  const leechDelta = learningRate * leechSignal * (y === 0.0 ? rNow : -0.5 * (1.0 - rNow + 0.2));
  const complexityDelta = learningRate * complexitySignal * (y === 0.0 ? rNow : -0.5 * (1.0 - rNow + 0.2));

  return {
    w_fsrs: clampWeight(weights.w_fsrs),
    w_streak: clampWeight(weights.w_streak + streakDelta),
    w_recent: clampWeight(weights.w_recent + recentDelta),
    w_leech: clampWeight(weights.w_leech + leechDelta),
    w_complexity: clampWeight(weights.w_complexity + complexityDelta),
    w_cluster: clampWeight(weights.w_cluster)
  };
}

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
    : new Date(due.getTime() - Math.max(1, card.stability_days || 1) * 86400000);
  const elapsedDays = (now.getTime() - lastReview.getTime()) / 86400000;

  return {
    due,
    stability: card.stability_days,
    difficulty: card.difficulty,
    elapsed_days: Math.max(0, elapsedDays),
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
    const r = this.f.get_retrievability(fsrsCard, atTime, false) as number;
    return Math.min(1.0, Math.max(0.0, r));
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

    const safeGetR = (fCard: FSRSCard, date: Date): number => {
      if (!fCard.last_review) return 1.0;
      const r = this.f.get_retrievability(fCard, date, false) as number;
      return Math.min(1.0, Math.max(0.0, r));
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

  /**
   * Calculates multi-factor composite priority utility per Section 9.5 (SCH-041..SCH-046)
   */
  calculateMultiFactorUtility(
    card: Card,
    now: Date,
    examDate?: Date | null,
    estimatedReviewSeconds: number = 15.0,
    weights: AdaptiveWeights = DEFAULT_ADAPTIVE_WEIGHTS,
    lastCardClusterId?: string | null,
    hasAlternativeCluster: boolean = false
  ): {
    r_now: number;
    p0: number;
    pg: number;
    pa: number;
    expected_gain: number;
    base_utility: number;
    composite_utility: number;
    streak_factor: number;
    recent_accuracy_factor: number;
    leech_staleness_factor: number;
    complexity_factor: number;
    cluster_factor: number;
    horizon: Date;
  } {
    const base = this.calculateUtility(card, now, examDate, estimatedReviewSeconds);
    const streak = deriveStreakCount(card);
    const streak_factor = streak > 1 ? -(1.0 - 1.0 / (1.0 + 0.25 * (streak - 1))) : 0.0;

    const recentAcc = deriveRecentAccuracy(card);
    const recent_accuracy_factor = (card.review_count > 1 || card.incorrect_count > 0)
      ? Math.max(0.0, 0.90 - recentAcc)
      : 0.0;

    const leech = computeLeechScore(card);
    const staleness = computeStalenessScore(card, now);
    const leech_staleness_factor = Math.min(1.0, leech + 0.5 * staleness);

    const complexity_factor = typeof card.complexity_index === 'number'
      ? Math.min(1.0, Math.max(0.0, card.complexity_index))
      : computeComplexityIndex(card.question_text, card.answer_text);

    const cardCluster = computeClusterId(card);
    const cluster_factor = (lastCardClusterId && cardCluster && cardCluster === lastCardClusterId && hasAlternativeCluster)
      ? -1.0
      : 0.0;

    const weightedSignal =
      weights.w_streak * streak_factor +
      weights.w_recent * recent_accuracy_factor +
      weights.w_leech * leech_staleness_factor +
      weights.w_complexity * complexity_factor +
      weights.w_cluster * cluster_factor;

    const composite_utility = (weightedSignal === 0.0 && weights.w_fsrs === 1.0)
      ? base.base_utility
      : Math.max(1e-9, weights.w_fsrs * base.base_utility * Math.max(0.10, 1.0 + weightedSignal) + 0.001 * weightedSignal);

    return {
      ...base,
      composite_utility,
      streak_factor,
      recent_accuracy_factor,
      leech_staleness_factor,
      complexity_factor,
      cluster_factor
    };
  }
}

