/**
 * Accessible Study View Component
 * Implements UI-001..UI-016, ACC-001..ACC-007
 */

import React, { useEffect, useRef } from 'react';
import { Card, Deck } from '@/domain/types';
import { useStudySession, SessionSummaryData } from '@/hooks/useStudySession';
import { Play, Pause, RotateCcw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface StudyViewProps {
  deck: Deck;
  cards: Card[];
  durationMinutes: number;
  onFinish: (summary: SessionSummaryData) => void;
  onExit: () => void;
}

export const StudyView: React.FC<StudyViewProps> = ({
  deck,
  cards,
  durationMinutes,
  onFinish,
  onExit
}) => {
  const {
    currentCard,
    queue,
    isRevealed,
    isPaused,
    isPending,
    errorState,
    canUndo,
    timeRemainingSeconds,
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
  } = useStudySession({
    deck,
    initialCards: cards,
    sessionDurationMinutes: durationMinutes,
    onFinishSession: onFinish
  });

  const cardContainerRef = useRef<HTMLDivElement>(null);
  const revealButtonRef = useRef<HTMLButtonElement>(null);

  // Keyboard navigation (UI-011, UI-012, UI-013)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (isPaused || isEnded || isPending) return;

      if (!isRevealed) {
        // UI-012: Space or Enter reveals answer
        if (e.key === ' ' || e.key === 'Enter') {
          // If focus is currently on an active button, don't double trigger
          if ((e.target as HTMLElement)?.tagName !== 'BUTTON' || e.target === revealButtonRef.current) {
            e.preventDefault();
            revealAnswer();
          }
        }
      } else {
        // UI-013: 1 for 'I got it!', 2 for 'Dang, I missed it!'
        if (e.key === '1') {
          e.preventDefault();
          submitGrade('correct');
        } else if (e.key === '2') {
          e.preventDefault();
          submitGrade('incorrect');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRevealed, isPaused, isEnded, isPending, revealAnswer, submitGrade]);

  // Format time remaining
  const minutes = Math.floor(timeRemainingSeconds / 60);
  const seconds = timeRemainingSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  if (isEnded) {
    return (
      <div className="max-w-2xl mx-auto p-6 bg-slate-800 rounded-xl border border-slate-700 shadow-xl text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Study Session Completed</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 my-6">
          <div className="bg-slate-900 p-4 rounded-lg">
            <span className="text-slate-400 text-sm block">Cards Reviewed</span>
            <span className="text-2xl font-bold text-blue-400">{completedReviews}</span>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg">
            <span className="text-slate-400 text-sm block">Correct</span>
            <span className="text-2xl font-bold text-green-400">{correctCount}</span>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg">
            <span className="text-slate-400 text-sm block">Missed</span>
            <span className="text-2xl font-bold text-red-400">{incorrectCount}</span>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg">
            <span className="text-slate-400 text-sm block">New Cards</span>
            <span className="text-2xl font-bold text-purple-400">{newCardsIntroduced}</span>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg">
            <span className="text-slate-400 text-sm block">Due Remaining</span>
            <span className="text-2xl font-bold text-amber-400">{dueCardsRemaining}</span>
          </div>
          <div className="bg-slate-900 p-4 rounded-lg">
            <span className="text-slate-400 text-sm block">Accuracy</span>
            <span className="text-2xl font-bold text-cyan-400">
              {completedReviews > 0 ? `${Math.round((correctCount / completedReviews) * 100)}%` : '0%'}
            </span>
          </div>
        </div>
        <button
          onClick={onExit}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none"
        >
          Return to Deck
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6" role="region" aria-label="Flashcard Study Session">
      {/* Session Metrics Bar (UI-016) */}
      <header className="p-3 sm:p-4 bg-slate-800 rounded-xl border border-slate-700 shadow-md mb-4 sm:mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6 text-center sm:text-left">
          <div className="bg-slate-900/50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
            <span className="text-[11px] sm:text-xs text-slate-400 uppercase font-semibold block">Time Left</span>
            <span
              className={`text-lg sm:text-xl font-mono font-bold ${timeRemainingSeconds < 60 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}
              aria-live="polite"
            >
              {formattedTime}
            </span>
          </div>
          <div className="bg-slate-900/50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
            <span className="text-[11px] sm:text-xs text-slate-400 uppercase font-semibold block">Reviewed</span>
            <span className="text-base sm:text-lg font-bold text-blue-400">{completedReviews}</span>
          </div>
          <div className="bg-slate-900/50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
            <span className="text-[11px] sm:text-xs text-slate-400 uppercase font-semibold block">New Introduced</span>
            <span className="text-base sm:text-lg font-bold text-purple-400">{newCardsIntroduced}</span>
          </div>
          <div className="bg-slate-900/50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
            <span className="text-[11px] sm:text-xs text-slate-400 uppercase font-semibold block">Due Remaining</span>
            <span className="text-base sm:text-lg font-bold text-amber-400">{dueCardsRemaining}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-700/60">
          {/* UI-014: Pause/Resume Control */}
          <button
            onClick={togglePause}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none min-h-[44px]"
            aria-label={isPaused ? 'Resume study session' : 'Pause study session'}
          >
            {isPaused ? <Play className="w-4 h-4 text-green-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          {/* SES-006: End Early Control */}
          <button
            onClick={endSessionEarly}
            className="flex-1 sm:flex-none px-4 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700 text-red-200 text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-red-400 focus:outline-none min-h-[44px] text-center"
            aria-label="End session early"
          >
            End Session
          </button>
        </div>
      </header>

      {/* Recoverable Error Banner (UI-009) */}
      {errorState && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-6 p-4 bg-red-950/80 border border-red-600 rounded-xl flex items-center justify-between text-red-200"
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorState.message}</span>
          </div>
          <button
            onClick={errorState.retryFn}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg focus:ring-2 focus:ring-red-400 focus:outline-none"
          >
            Retry
          </button>
        </div>
      )}

      {/* Paused Overlay State (UI-014, UI-015) */}
      {isPaused && (
        <div className="p-12 text-center bg-slate-800/90 border border-slate-700 rounded-2xl shadow-xl backdrop-blur-sm my-8">
          <Pause className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Session Paused</h3>
          <p className="text-slate-400 mb-6">Interaction time and session allocations are currently halted.</p>
          <button
            onClick={togglePause}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            Resume Study
          </button>
        </div>
      )}

      {/* Main Flashcard Stage (UI-001..UI-007) */}
      {!isPaused && currentCard && (
        <main
          ref={cardContainerRef}
          className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-5 sm:p-8 md:p-10 transition-all"
        >
          {/* Card Meta & Queue Badge */}
          <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-700/60 pb-3 mb-6">
            <span className="uppercase tracking-wider font-semibold">
              Queue: <span className="text-blue-400">{queue?.replace('_', ' ')}</span>
            </span>
            {isExpired && (
              <span className="text-amber-400 font-medium">
                Time expired — completing last card
              </span>
            )}
          </div>

          {/* Question Text (UI-001) */}
          <div className="mb-6 sm:mb-8">
            <h2 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">Question</h2>
            <div className="text-lg sm:text-xl md:text-2xl font-medium text-slate-100 whitespace-pre-wrap leading-relaxed break-words">
              {currentCard.question_text}
            </div>
          </div>

          {/* Reveal Control (UI-002, UI-003, UI-012) */}
          {!isRevealed && (
            <div className="pt-6 border-t border-slate-700/60 text-center">
              <button
                ref={revealButtonRef}
                onClick={revealAnswer}
                disabled={isPending}
                className="w-full sm:w-auto px-8 py-3.5 min-h-[48px] bg-blue-600 hover:bg-blue-500 text-white text-base sm:text-lg font-semibold rounded-xl shadow-lg hover:shadow-blue-500/20 transition-all focus:ring-4 focus:ring-blue-400/50 focus:outline-none"
                aria-label="Give me the answer"
              >
                Give me the answer
              </button>
              <div className="text-xs text-slate-400 mt-3 font-mono">
                Shortcut: <kbd className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-300">Space</kbd> or <kbd className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-slate-300">Enter</kbd>
              </div>
            </div>
          )}

          {/* Answer State & Grading Controls (UI-003..UI-008, UI-013) */}
          {isRevealed && (
            <div className="pt-6 border-t border-slate-700/60 transition-opacity animate-in fade-in duration-200">
              <div className="mb-6 sm:mb-8">
                <h3 className="text-xs uppercase tracking-wider font-bold text-emerald-400 mb-2">Answer</h3>
                <div className="text-lg sm:text-xl md:text-2xl font-medium text-slate-100 whitespace-pre-wrap leading-relaxed break-words">
                  {currentCard.answer_text}
                </div>
              </div>

              {/* Exactly two primary grading controls (UI-004) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <button
                  onClick={() => submitGrade('correct')}
                  disabled={isPending}
                  className="flex items-center justify-center gap-3 py-4 px-4 sm:px-6 min-h-[56px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-base sm:text-lg font-bold rounded-xl shadow-lg hover:shadow-emerald-500/20 transition-all focus:ring-4 focus:ring-emerald-400/50 focus:outline-none"
                  aria-label="I got it!"
                >
                  <CheckCircle2 className="w-6 h-6 shrink-0" />
                  <span>I got it!</span>
                  <kbd className="text-xs font-mono font-normal ml-auto px-2 py-0.5 bg-emerald-700/80 rounded border border-emerald-500">1</kbd>
                </button>

                <button
                  onClick={() => submitGrade('incorrect')}
                  disabled={isPending}
                  className="flex items-center justify-center gap-3 py-4 px-4 sm:px-6 min-h-[56px] bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-base sm:text-lg font-bold rounded-xl shadow-lg hover:shadow-rose-500/20 transition-all focus:ring-4 focus:ring-rose-400/50 focus:outline-none"
                  aria-label="Dang, I missed it!"
                >
                  <XCircle className="w-6 h-6 shrink-0" />
                  <span>Dang, I missed it!</span>
                  <kbd className="text-xs font-mono font-normal ml-auto px-2 py-0.5 bg-rose-700/80 rounded border border-rose-500">2</kbd>
                </button>
              </div>
            </div>
          )}

          {/* Undo Last Grade Control (UI-007) */}
          {canUndo && (
            <div className="mt-6 pt-4 border-t border-slate-700/40 flex justify-end">
              <button
                onClick={undoLastGrade}
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] bg-slate-700/80 hover:bg-slate-600 text-slate-300 text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none"
                aria-label="Undo last grade"
              >
                <RotateCcw className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Undo last grade</span>
              </button>
            </div>
          )}
        </main>
      )}

      {/* Keyboard Controls Reference Footer (UI-011) */}
      <footer className="mt-6 p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 flex flex-wrap items-center justify-center gap-6">
        <span>Keyboard Navigation:</span>
        <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Space</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">Enter</kbd> Reveal Answer</span>
        <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">1</kbd> I got it!</span>
        <span><kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700">2</kbd> Dang, I missed it!</span>
      </footer>
    </div>
  );
};
