/**
 * Study Session State Management Hook
 * Implements UI-001..UI-016, SES-001..SES-010, REV-001..REV-014
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Deck, StudySession, SessionCardState, SelectionResult } from '@/domain/types';
import { SchedulerEngine } from '@/domain/scheduler';
import { FsrsService } from '@/domain/fsrsService';
import { supabase } from '@/lib/supabase';

export interface UseStudySessionProps {
  deck: Deck;
  initialCards: Card[];
  sessionDurationMinutes: number;
  onFinishSession?: (summary: SessionSummaryData) => void;
}

export interface SessionSummaryData {
  elapsedActiveSeconds: number;
  cardsReviewed: number;
  correctCount: number;
  incorrectCount: number;
  newCardsIntroduced: number;
  dueCardsCompleted: number;
}

export function useStudySession({
  deck,
  initialCards,
  sessionDurationMinutes,
  onFinishSession
}: UseStudySessionProps) {
  const durationSeconds = sessionDurationMinutes * 60;

  // Session metadata
  const [sessionId] = useState<string>(() => crypto.randomUUID());
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [sessionStates, setSessionStates] = useState<Map<string, SessionCardState>>(new Map());
  const [currentSelection, setCurrentSelection] = useState<SelectionResult | null>(null);

  // Interaction state
  const [isRevealed, setIsRevealed] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isPending, setIsPending] = useState<boolean>(false);
  const [errorState, setErrorState] = useState<{ message: string; retryFn: () => void } | null>(null);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [lastCommittedOpId, setLastCommittedOpId] = useState<string | null>(null);

  // Timing & metrics
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState<number>(durationSeconds);
  const [activeDurationSeconds, setActiveDurationSeconds] = useState<number>(0);
  const [cumulativeNewLearningSeconds, setCumulativeNewLearningSeconds] = useState<number>(0);
  const [ewmaSecondsPerReview, setEwmaSecondsPerReview] = useState<number>(15.0);

  // Counters
  const [completedReviews, setCompletedReviews] = useState<number>(0);
  const [correctCount, setCorrectCount] = useState<number>(0);
  const [incorrectCount, setIncorrectCount] = useState<number>(0);
  const [newCardsIntroduced, setNewCardsIntroduced] = useState<number>(0);
  const [dueCardsCompleted, setDueCardsCompleted] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [isEnded, setIsEnded] = useState<boolean>(false);

  // Timestamps for current review opportunity
  const shownAtRef = useRef<Date>(new Date());
  const revealedAtRef = useRef<Date | null>(null);
  const currentCardShownDurationRef = useRef<number>(0);
  const isInterruptedRef = useRef<boolean>(false);

  const schedulerEngineRef = useRef<SchedulerEngine>(new SchedulerEngine(deck.desired_retention));
  const fsrsServiceRef = useRef<FsrsService>(new FsrsService(deck.desired_retention));

  // Initialize session record
  useEffect(() => {
    shownAtRef.current = new Date();
  }, []);

  // Tick timer
  useEffect(() => {
    if (isPaused || isEnded) return;

    const interval = setInterval(() => {
      setTimeRemainingSeconds(prev => {
        if (prev <= 1) {
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });

      setActiveDurationSeconds(prev => prev + 1);
      currentCardShownDurationRef.current += 1;
    }, 1000);

    return () => clearInterval(interval);
  }, [isPaused, isEnded]);

  // Pick next card
  const selectNext = useCallback((cardsPool: Card[], states: Map<string, SessionCardState>, lastId?: string) => {
    if (isExpired) {
      setIsEnded(true);
      return;
    }

    const sessionObj: StudySession = {
      id: sessionId,
      user_id: deck.user_id,
      deck_id: deck.id,
      duration_seconds: durationSeconds,
      status: 'active',
      started_at: new Date().toISOString(),
      active_duration_seconds: activeDurationSeconds,
      settings_snapshot: {
        cohort_size: deck.cohort_size,
        desired_retention: deck.desired_retention,
        new_learning_fraction: deck.new_learning_fraction,
        min_failed_retry_delay_seconds: deck.min_failed_retry_delay_seconds,
        min_intervening_cards: deck.min_intervening_cards,
        exam_date: deck.exam_date
      },
      cards_reviewed: completedReviews,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      new_cards_introduced: newCardsIntroduced,
      due_cards_completed: dueCardsCompleted,
      created_at: new Date().toISOString()
    };

    const sel = schedulerEngineRef.current.selectNextCard({
      deck,
      session: sessionObj,
      allCards: cardsPool,
      sessionStates: states,
      lastCardId: lastId,
      cumulativeNewLearningSeconds,
      estimatedReviewSeconds: ewmaSecondsPerReview
    });

    if (!sel) {
      setIsEnded(true);
      return;
    }

    setCurrentSelection(sel);
    setIsRevealed(false);
    shownAtRef.current = new Date();
    revealedAtRef.current = null;
    currentCardShownDurationRef.current = 0;
    isInterruptedRef.current = false;
  }, [
    deck,
    durationSeconds,
    activeDurationSeconds,
    completedReviews,
    correctCount,
    incorrectCount,
    newCardsIntroduced,
    dueCardsCompleted,
    cumulativeNewLearningSeconds,
    ewmaSecondsPerReview,
    isExpired,
    sessionId
  ]);

  // Initial selection
  useEffect(() => {
    if (!currentSelection && cards.length > 0 && !isEnded) {
      selectNext(cards, sessionStates);
    }
  }, [currentSelection, cards, isEnded, selectNext, sessionStates]);

  // UI-002, UI-003: Reveal Answer
  const revealAnswer = useCallback(() => {
    if (isRevealed || isPaused || isEnded || !currentSelection) return;
    revealedAtRef.current = new Date();
    setIsRevealed(true);
  }, [isRevealed, isPaused, isEnded, currentSelection]);

  // UI-004..UI-006: Submit Grade
  const submitGrade = useCallback(async (result: 'correct' | 'incorrect') => {
    if (!isRevealed || isPending || !currentSelection) return;

    setIsPending(true);
    setErrorState(null);

    const opId = crypto.randomUUID();
    const card = currentSelection.selectedCard;
    const now = new Date();
    const rating = result === 'correct' ? 3 : 1;
    const validDuration = currentCardShownDurationRef.current;

    // Simulate next FSRS state
    const repeatRes = fsrsServiceRef.current.repeat(card, rating as 1 | 3, now);
    const postState = {
      learning_state: result === 'correct' ? (card.learning_state === 'new' || card.learning_state === 'learning' ? 'review' : card.learning_state) : (card.learning_state === 'review' ? 'relearning' : card.learning_state),
      difficulty: repeatRes.card.difficulty,
      stability_days: repeatRes.card.stability,
      next_due_at: repeatRes.card.due.toISOString()
    };

    const executeRpc = async () => {
      try {
        const { error } = await supabase.rpc('rpc_submit_grade', {
          p_operation_id: opId,
          p_session_id: sessionId,
          p_card_id: card.id,
          p_rating: rating,
          p_result: result,
          p_shown_at: shownAtRef.current.toISOString(),
          p_revealed_at: revealedAtRef.current?.toISOString() || now.toISOString(),
          p_rated_at: now.toISOString(),
          p_valid_duration: validDuration,
          p_is_interrupted: isInterruptedRef.current,
          p_post_state: postState,
          p_algorithm_version: 'fsrs-v4'
        });

        if (error) {
          throw error;
        }

        // Commit local state updates
        setLastCommittedOpId(opId);
        setCanUndo(true);

        // Update EWMA (SES-010): alpha = 0.1
        if (!isInterruptedRef.current && validDuration > 0 && validDuration < 120) {
          setEwmaSecondsPerReview(prev => 0.1 * validDuration + 0.9 * prev);
        }

        if (card.learning_state === 'new' || card.learning_state === 'learning') {
          setCumulativeNewLearningSeconds(prev => prev + validDuration);
        }

        // Update card in cards state
        const updatedCard: Card = {
          ...card,
          learning_state: postState.learning_state as any,
          difficulty: postState.difficulty,
          stability_days: postState.stability_days,
          next_due_at: postState.next_due_at,
          last_review_at: now.toISOString(),
          last_rating: rating,
          review_count: card.review_count + 1,
          correct_count: result === 'correct' ? card.correct_count + 1 : card.correct_count,
          incorrect_count: result === 'incorrect' ? card.incorrect_count + 1 : card.incorrect_count,
          lapse_count: card.learning_state === 'review' && result === 'incorrect' ? card.lapse_count + 1 : card.lapse_count
        };

        const nextCards = cards.map(c => c.id === card.id ? updatedCard : c);
        setCards(nextCards);

        // Update session card state
        const nextStates = new Map(sessionStates);
        const existingSState = nextStates.get(card.id) || {
          session_id: sessionId,
          card_id: card.id,
          user_id: deck.user_id,
          has_met_criterion: false,
          has_unresolved_failure: false,
          intervening_cards_since_failure: 0,
          introduced_in_session: true
        };

        if (result === 'correct') {
          existingSState.has_met_criterion = true;
          existingSState.has_unresolved_failure = false;
        } else {
          existingSState.has_unresolved_failure = true;
          existingSState.last_failure_at = now.toISOString();
          existingSState.intervening_cards_since_failure = 0;
        }

        // Increment intervening cards count for all other failed cards
        for (const [sId, st] of nextStates.entries()) {
          if (sId !== card.id && st.has_unresolved_failure) {
            st.intervening_cards_since_failure += 1;
          }
        }
        nextStates.set(card.id, existingSState);
        setSessionStates(nextStates);

        // Counters
        setCompletedReviews(prev => prev + 1);
        if (result === 'correct') {
          setCorrectCount(prev => prev + 1);
        } else {
          setIncorrectCount(prev => prev + 1);
        }

        if (card.learning_state === 'new') {
          setNewCardsIntroduced(prev => prev + 1);
        }
        if (card.learning_state === 'review' || card.learning_state === 'relearning') {
          setDueCardsCompleted(prev => prev + 1);
        }

        setIsPending(false);
        selectNext(nextCards, nextStates, card.id);
      } catch (err: unknown) {
        setIsPending(false);
        const msg = err instanceof Error ? err.message : 'Network error submitting grade';
        setErrorState({
          message: msg,
          retryFn: executeRpc
        });
      }
    };

    await executeRpc();
  }, [
    isRevealed,
    isPending,
    currentSelection,
    sessionId,
    deck.user_id,
    deck.id,
    cards,
    sessionStates,
    selectNext
  ]);

  // UI-007, REV-011..REV-013: Undo Last Grade
  const undoLastGrade = useCallback(async () => {
    if (!canUndo || !lastCommittedOpId || isPending) return;

    setIsPending(true);
    setErrorState(null);

    const undoOpId = crypto.randomUUID();
    try {
      const { error } = await supabase.rpc('rpc_undo_grade', {
        p_undo_operation_id: undoOpId,
        p_session_id: sessionId,
        p_target_operation_id: lastCommittedOpId,
        p_reason: 'User triggered undo'
      });

      if (error) {
        throw error;
      }

      setCanUndo(false);
      setLastCommittedOpId(null);
      setIsPending(false);

      // Rollback counters
      setCompletedReviews(prev => Math.max(0, prev - 1));
      // Re-trigger selection
      selectNext(cards, sessionStates);
    } catch (err: unknown) {
      setIsPending(false);
      const msg = err instanceof Error ? err.message : 'Failed to undo grade';
      setErrorState({
        message: msg,
        retryFn: undoLastGrade
      });
    }
  }, [canUndo, lastCommittedOpId, isPending, sessionId, cards, sessionStates, selectNext]);

  // UI-014, UI-015: Pause and Resume
  const togglePause = useCallback(() => {
    setIsPaused(prev => !prev);
    isInterruptedRef.current = true;
  }, []);

  // SES-006: End session early
  const endSessionEarly = useCallback(() => {
    setIsEnded(true);
    if (onFinishSession) {
      onFinishSession({
        elapsedActiveSeconds: activeDurationSeconds,
        cardsReviewed: completedReviews,
        correctCount,
        incorrectCount,
        newCardsIntroduced,
        dueCardsCompleted
      });
    }
  }, [
    activeDurationSeconds,
    completedReviews,
    correctCount,
    incorrectCount,
    newCardsIntroduced,
    dueCardsCompleted,
    onFinishSession
  ]);

  // Compute remaining due cards count
  const dueCardsRemaining = cards.filter(c =>
    !c.suspended_at &&
    !c.archived_at &&
    (c.learning_state === 'relearning' ||
     (c.learning_state === 'review' && c.next_due_at && new Date(c.next_due_at) <= new Date()))
  ).length;

  return {
    currentCard: currentSelection?.selectedCard ?? null,
    queue: currentSelection?.queue ?? null,
    reasonCode: currentSelection?.reasonCode ?? null,
    isRevealed,
    isPaused,
    isPending,
    errorState,
    canUndo,
    timeRemainingSeconds,
    activeDurationSeconds,
    completedReviews,
    correctCount,
    incorrectCount,
    newCardsIntroduced,
    dueCardsRemaining,
    isExpired,
    isEnded,
    revealAnswer,
    submitGrade,
    undoLastGrade,
    togglePause,
    endSessionEarly
  };
}
