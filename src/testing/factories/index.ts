/**
 * Typed Factories for Testing (TST-008)
 */

import { Card, Deck, StudySession, SessionCardState, LearningState } from '@/domain/types';

let idCounter = 1000;
function nextId(): string {
  idCounter++;
  return `00000000-0000-0000-0000-${idCounter.toString().padStart(12, '0')}`;
}

export function createDeck(overrides?: Partial<Deck>): Deck {
  return {
    id: nextId(),
    user_id: 'user-default-id',
    name: 'Test Deck',
    description: 'Sample description',
    exam_date: null,
    desired_retention: 0.90,
    cohort_size: 10,
    new_learning_fraction: 0.30,
    min_failed_retry_delay_seconds: 60,
    min_intervening_cards: 3,
    is_archived: false,
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    ...overrides
  };
}

export function createCard(overrides?: Partial<Card>): Card {
  const learning_state: LearningState = overrides?.learning_state ?? 'new';
  const correct_count = overrides?.correct_count ?? (learning_state === 'review' ? 1 : 0);
  const incorrect_count = overrides?.incorrect_count ?? 0;
  const review_count = overrides?.review_count ?? (correct_count + incorrect_count);

  return {
    id: nextId(),
    user_id: 'user-default-id',
    deck_id: 'deck-default-id',
    source_row_number: 1,
    question_text: 'Sample Question',
    answer_text: 'Sample Answer',
    normalized_question: 'Sample Question',
    normalized_answer: 'Sample Answer',
    content_hash: 'content-hash-' + Math.random().toString(36).substring(2),
    first_imported_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    updated_at: new Date('2026-01-01T00:00:00Z').toISOString(),
    cohort_number: 1,
    source_order: 1,
    importance_weight: 1.0,
    learning_state,
    difficulty: learning_state === 'new' ? 0 : 5.0,
    stability_days: learning_state === 'new' ? 0 : 3.0,
    algorithm_version: 'fsrs-v4',
    review_count,
    correct_count,
    incorrect_count,
    lapse_count: overrides?.lapse_count ?? 0,
    successful_relearning_sessions: overrides?.successful_relearning_sessions ?? 0,
    ...overrides
  };
}

export function createStudySession(deckId: string, overrides?: Partial<StudySession>): StudySession {
  return {
    id: nextId(),
    user_id: 'user-default-id',
    deck_id: deckId,
    duration_seconds: 900, // 15 mins
    status: 'active',
    started_at: new Date('2026-01-01T12:00:00Z').toISOString(),
    active_duration_seconds: 0,
    settings_snapshot: {
      cohort_size: 10,
      desired_retention: 0.90,
      new_learning_fraction: 0.30,
      min_failed_retry_delay_seconds: 60,
      min_intervening_cards: 3
    },
    cards_reviewed: 0,
    correct_count: 0,
    incorrect_count: 0,
    new_cards_introduced: 0,
    due_cards_completed: 0,
    created_at: new Date('2026-01-01T12:00:00Z').toISOString(),
    ...overrides
  };
}

export function createSessionCardState(sessionId: string, cardId: string, overrides?: Partial<SessionCardState>): SessionCardState {
  return {
    id: nextId(),
    session_id: sessionId,
    card_id: cardId,
    user_id: 'user-default-id',
    has_met_criterion: false,
    has_unresolved_failure: false,
    intervening_cards_since_failure: 0,
    introduced_in_session: false,
    ...overrides
  };
}

export function createReviewEvent(overrides?: Partial<import('@/domain/types').ReviewEvent>): import('@/domain/types').ReviewEvent {
  return {
    id: nextId(),
    user_id: 'user-default-id',
    card_id: nextId(),
    deck_id: nextId(),
    study_session_id: nextId(),
    operation_id: nextId(),
    shown_at: new Date('2026-01-01T12:00:00Z').toISOString(),
    revealed_at: new Date('2026-01-01T12:00:05Z').toISOString(),
    rated_at: new Date('2026-01-01T12:00:07Z').toISOString(),
    result: 'correct',
    rating: 3,
    response_latency_ms: 2000,
    pre_state: { learning_state: 'new' },
    post_state: { learning_state: 'learning' },
    algorithm_version: 'v4-default-1.0.0',
    is_invalidated: false,
    invalidation_reason: null,
    superseded_by_operation_id: null,
    created_at: new Date('2026-01-01T12:00:07Z').toISOString(),
    ...overrides
  };
}
