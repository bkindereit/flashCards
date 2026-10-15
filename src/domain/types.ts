/**
 * Domain Types for Adaptive Flashcard Application
 * Baseline: FCA-SRS-001
 */

export type LearningState = 'new' | 'learning' | 'review' | 'relearning' | 'suspended';

export type ReviewResult = 'correct' | 'incorrect';

export interface Card {
  id: string;
  user_id: string;
  deck_id: string;
  import_batch_id?: string | null;
  source_row_number?: number | null;
  question_text: string;
  answer_text: string;
  normalized_question: string;
  normalized_answer: string;
  content_hash: string;
  first_imported_at: string;
  created_at: string;
  updated_at: string;
  suspended_at?: string | null;
  archived_at?: string | null;
  cohort_number: number;
  source_order: number;
  importance_weight: number;
  learning_state: LearningState;
  difficulty: number;
  stability_days: number;
  last_review_at?: string | null;
  next_due_at?: string | null;
  last_rating?: number | null;
  algorithm_version: string;
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  lapse_count: number;
  last_correct_at?: string | null;
  last_incorrect_at?: string | null;
  successful_relearning_sessions: number;
  percent_correct?: number;
}

export interface Deck {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  exam_date?: string | null;
  desired_retention: number; // 0.70 .. 0.97 (default 0.90)
  cohort_size: number; // 5 .. 20 (default 10)
  new_learning_fraction: number; // 0.00 .. 0.50 (default 0.30)
  min_failed_retry_delay_seconds: number; // default 60
  min_intervening_cards: number; // default 3
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  deck_id: string;
  duration_seconds: number;
  status: 'active' | 'completed' | 'ended_early';
  started_at: string;
  ended_at?: string | null;
  active_duration_seconds: number;
  settings_snapshot: {
    cohort_size: number;
    desired_retention: number;
    new_learning_fraction: number;
    min_failed_retry_delay_seconds: number;
    min_intervening_cards: number;
    exam_date?: string | null;
  };
  cards_reviewed: number;
  correct_count: number;
  incorrect_count: number;
  new_cards_introduced: number;
  due_cards_completed: number;
  created_at: string;
}

export interface SessionCardState {
  id?: string;
  session_id: string;
  card_id: string;
  user_id: string;
  has_met_criterion: boolean;
  has_unresolved_failure: boolean;
  last_failure_at?: string | null;
  intervening_cards_since_failure: number;
  introduced_in_session: boolean;
}

export type QueueName =
  | 'relearning'
  | 'mandatory_overdue'
  | 'due_review'
  | 'active_cohort'
  | 'early_review';

export interface SelectionCandidate {
  card: Card;
  queue: QueueName;
  base_utility: number;
  expected_gain: number;
  r_now: number;
  p0: number;
  pg: number;
  pa: number;
  reason_code: string;
}

export interface SelectionResult {
  selectedCard: Card;
  queue: QueueName;
  reasonCode: string;
  seed: string;
  candidateIds: string[];
  utilityValues: Record<string, number>;
  timestamp: string;
}

export interface ReviewEvent {
  id: string;
  user_id: string;
  card_id: string;
  deck_id: string;
  study_session_id?: string | null;
  operation_id: string;
  shown_at: string;
  revealed_at: string;
  rated_at: string;
  result: ReviewResult;
  rating: number; // 1 (Again), 3 (Good)
  response_latency_ms: number;
  pre_state: Record<string, unknown>;
  post_state: Record<string, unknown>;
  algorithm_version: string;
  is_invalidated: boolean;
  invalidation_reason?: string | null;
  superseded_by_operation_id?: string | null;
  created_at: string;
}
