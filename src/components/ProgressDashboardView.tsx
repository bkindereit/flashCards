/**
 * Learning Progress Dashboard View
 * Implements PRG-001..PRG-006, ACC-008
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Card, Deck } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  Flame,
  Target,
  Clock,
  Calendar,
  AlertTriangle,
  Play,
  ArrowLeft,
  ChevronDown,
  Layers,
  Sparkles,
  Award
} from 'lucide-react';

interface ProgressDashboardViewProps {
  decks: Deck[];
  initialDeckId?: string | null;
  onBack: () => void;
  onStudyDeck?: (deck: Deck) => void;
}

interface ReviewEventSummary {
  card_id: string;
  deck_id: string;
  result: 'correct' | 'incorrect';
  rated_at: string;
}

interface SessionSummary {
  id: string;
  deck_id: string;
  started_at: string;
  active_duration_seconds: number;
  cards_reviewed: number;
  correct_count: number;
  incorrect_count: number;
}

function toSafeDateString(dateVal: unknown): string | null {
  if (!dateVal) return null;
  const d = new Date(dateVal as string | number | Date);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0]!;
}

export const ProgressDashboardView: React.FC<ProgressDashboardViewProps> = ({
  decks,
  initialDeckId = null,
  onBack,
  onStudyDeck
}) => {
  const [selectedDeckId, setSelectedDeckId] = useState<string>(initialDeckId || 'all');
  const [cards, setCards] = useState<Card[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [reviewEvents, setReviewEvents] = useState<ReviewEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [revealedCardAnswers, setRevealedCardAnswers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    const fetchProgressData = async () => {
      setIsLoading(true);
      try {
        // Fetch all cards for the user
        const { data: cardsData } = await supabase.from('cards').select('*');
        // Fetch study sessions
        const { data: sessionsData } = await supabase
          .from('study_sessions')
          .select('id, deck_id, started_at, active_duration_seconds, cards_reviewed, correct_count, incorrect_count')
          .order('started_at', { ascending: false });
        // Fetch review events
        const { data: eventsData } = await supabase
          .from('review_events')
          .select('card_id, deck_id, result, rated_at')
          .order('rated_at', { ascending: false });

        if (isMounted) {
          if (cardsData) setCards(cardsData);
          if (sessionsData) setSessions(sessionsData as SessionSummary[]);
          if (eventsData) setReviewEvents(eventsData as ReviewEventSummary[]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchProgressData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Filter cards and metrics based on selected deck
  const activeDeck = useMemo(() => {
    if (selectedDeckId === 'all') return null;
    return decks.find(d => d.id === selectedDeckId) || null;
  }, [decks, selectedDeckId]);

  const filteredCards = useMemo(() => {
    if (selectedDeckId === 'all') return cards;
    return cards.filter(c => c.deck_id === selectedDeckId);
  }, [cards, selectedDeckId]);

  const filteredSessions = useMemo(() => {
    if (selectedDeckId === 'all') return sessions;
    return sessions.filter(s => s.deck_id === selectedDeckId);
  }, [sessions, selectedDeckId]);

  const filteredEvents = useMemo(() => {
    if (selectedDeckId === 'all') return reviewEvents;
    return reviewEvents.filter(e => e.deck_id === selectedDeckId);
  }, [reviewEvents, selectedDeckId]);

  // 1. PRG-001: Mastery Breakdown
  const masteryStats = useMemo(() => {
    const total = filteredCards.length;
    if (total === 0) {
      return { total: 0, new: 0, learning: 0, review: 0, relearning: 0, suspended: 0 };
    }
    const suspended = filteredCards.filter(c => Boolean(c.suspended_at) || c.learning_state === 'suspended').length;
    const active = filteredCards.filter(c => !c.suspended_at && c.learning_state !== 'suspended');

    const newCards = active.filter(c => c.learning_state === 'new').length;
    const learning = active.filter(c => c.learning_state === 'learning').length;
    const review = active.filter(c => c.learning_state === 'review').length;
    const relearning = active.filter(c => c.learning_state === 'relearning').length;

    return {
      total,
      new: newCards,
      learning,
      review,
      relearning,
      suspended
    };
  }, [filteredCards]);

  // 2. PRG-002: True Recall Accuracy & Study Time
  const performanceStats = useMemo(() => {
    let totalReviews = 0;
    let correctCount = 0;

    if (filteredEvents.length > 0) {
      totalReviews = filteredEvents.length;
      correctCount = filteredEvents.filter(e => e.result === 'correct').length;
    } else {
      totalReviews = filteredCards.reduce((acc, c) => acc + (c.review_count || 0), 0);
      correctCount = filteredCards.reduce((acc, c) => acc + (c.correct_count || 0), 0);
    }

    const accuracy = totalReviews > 0 ? Math.round((correctCount / totalReviews) * 100) : 0;
    const totalActiveSeconds = filteredSessions.reduce((acc, s) => acc + (s.active_duration_seconds || 0), 0);
    const totalMinutes = Math.round(totalActiveSeconds / 60);

    return {
      totalReviews,
      correctCount,
      accuracy,
      totalActiveSeconds,
      totalMinutes
    };
  }, [filteredEvents, filteredCards, filteredSessions]);

  // 3. PRG-003: Streak & Daily Activity Heatmap
  const { currentStreak, activityHeatmap } = useMemo(() => {
    const activityMap: Record<string, number> = {};

    // Count reviews per date (YYYY-MM-DD)
    filteredEvents.forEach(e => {
      const dateStr = toSafeDateString(e.rated_at);
      if (dateStr) {
        activityMap[dateStr] = (activityMap[dateStr] || 0) + 1;
      }
    });

    // Also include session start dates if events table is empty
    filteredSessions.forEach(s => {
      const dateStr = toSafeDateString(s.started_at);
      if (dateStr) {
        activityMap[dateStr] = (activityMap[dateStr] || 0) + (s.cards_reviewed || 1);
      }
    });

    // Compute Streak
    let streak = 0;
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]!;

    const hasToday = Boolean(activityMap[todayStr]);
    const checkDate = new Date(today);

    if (!hasToday) {
      checkDate.setDate(checkDate.getDate() - 1);
    }

    let keepChecking = true;
    while (keepChecking) {
      const dateKey = checkDate.toISOString().split('T')[0]!;
      if (activityMap[dateKey] && activityMap[dateKey]! > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        keepChecking = false;
      }
    }

    // Generate last 28 days for heatmap (4 weeks of 7 days)
    const days: Array<{ dateStr: string; label: string; count: number }> = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0]!;
      days.push({
        dateStr: key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: activityMap[key] || 0
      });
    }

    return { currentStreak: streak, activityHeatmap: days };
  }, [filteredEvents, filteredSessions]);

  // 4. PRG-004: Upcoming 7-Day Due Forecast
  const dueForecast = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const forecast: Array<{ dayLabel: string; count: number; dateStr: string }> = [];

    for (let i = 0; i < 7; i++) {
      const startOfDay = new Date(today);
      startOfDay.setDate(startOfDay.getDate() + i);

      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      let dayCount = 0;

      filteredCards.forEach(card => {
        if (card.suspended_at || card.learning_state === 'suspended' || !card.next_due_at) {
          return;
        }
        const dueDate = new Date(card.next_due_at);
        if (isNaN(dueDate.getTime())) return;
        if (i === 0) {
          // Day 0: due today or overdue
          if (dueDate <= endOfDay) {
            dayCount++;
          }
        } else {
          if (dueDate >= startOfDay && dueDate <= endOfDay) {
            dayCount++;
          }
        }
      });

      const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tmrw' : startOfDay.toLocaleDateString(undefined, { weekday: 'short' });
      forecast.push({
        dayLabel,
        count: dayCount,
        dateStr: startOfDay.toISOString().split('T')[0]!
      });
    }

    return forecast;
  }, [filteredCards]);

  // 5. PRG-005: Exam Readiness & Daily Pace Tracker
  const examReadiness = useMemo(() => {
    // Find exam date
    let examDateStr: string | null = null;
    let targetDeckName: string | null = null;

    if (activeDeck && activeDeck.exam_date) {
      examDateStr = activeDeck.exam_date;
      targetDeckName = activeDeck.name;
    } else if (selectedDeckId === 'all') {
      const decksWithExam = decks
        .filter(d => Boolean(d.exam_date))
        .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime());
      if (decksWithExam.length > 0) {
        examDateStr = decksWithExam[0]!.exam_date!;
        targetDeckName = decksWithExam[0]!.name;
      }
    }

    if (!examDateStr) return null;

    const examDate = new Date(examDateStr);
    if (isNaN(examDate.getTime())) return null;
    const today = new Date();
    const diffTime = examDate.getTime() - today.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const unseenCards = filteredCards.filter(c => !c.suspended_at && c.learning_state === 'new').length;
    const totalNonSuspended = filteredCards.filter(c => !c.suspended_at).length;
    const introducedCount = totalNonSuspended - unseenCards;
    const progressPercent = totalNonSuspended > 0 ? Math.round((introducedCount / totalNonSuspended) * 100) : 100;

    const requiredDailyPace = daysRemaining > 0 ? Math.ceil(unseenCards / daysRemaining) : unseenCards;

    return {
      examDate: examDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      targetDeckName,
      daysRemaining,
      unseenCards,
      progressPercent,
      requiredDailyPace,
      isOnTrack: requiredDailyPace <= 20
    };
  }, [activeDeck, selectedDeckId, decks, filteredCards]);

  // 6. PRG-006: Trouble Spots / Difficult Cards
  const difficultCards = useMemo(() => {
    return filteredCards
      .filter(c => !c.suspended_at && ((c.lapse_count && c.lapse_count > 0) || (c.incorrect_count && c.incorrect_count > 0)))
      .sort((a, b) => (b.lapse_count || 0) - (a.lapse_count || 0) || (b.incorrect_count || 0) - (a.incorrect_count || 0))
      .slice(0, 5);
  }, [filteredCards]);

  const toggleRevealAnswer = (cardId: string) => {
    setRevealedCardAnswers(prev => ({ ...prev, [cardId]: !prev[cardId] }));
  };

  const maxDueCount = Math.max(1, ...dueForecast.map(d => d.count));

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" role="region" aria-label="Learning Progress Dashboard">
      {/* Header and Deck Filter Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBack}
            className="text-sm text-blue-400 hover:text-blue-300 font-medium mb-1 block min-h-[36px] flex items-center gap-1.5"
            aria-label="Back to decks"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Decks
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-emerald-400" />
            <span>Learning Progress & Mastery</span>
          </h1>
        </div>

        {/* Deck Selector Filter */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label htmlFor="deck-progress-select" className="sr-only">Filter by Deck</label>
          <div className="relative w-full sm:w-56">
            <select
              id="deck-progress-select"
              value={selectedDeckId}
              onChange={e => setSelectedDeckId(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-base sm:text-sm appearance-none focus:ring-2 focus:ring-blue-400 focus:outline-none min-h-[44px]"
              aria-label="Filter learning progress by deck"
            >
              <option value="all">All Decks Combined</option>
              {decks.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.is_archived ? '(Archived)' : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-400">Loading progress data...</div>
      ) : (
        <div className="space-y-6">
          {/* Top Row: 4 KPI Cards (PRG-002, PRG-003) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Recall Accuracy */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                <span>True Accuracy</span>
                <Target className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                {performanceStats.accuracy}%
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {performanceStats.correctCount} of {performanceStats.totalReviews} correct
              </p>
            </div>

            {/* Study Streak */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                <span>Daily Streak</span>
                <Flame className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 mb-1 flex items-center gap-1.5">
                <span>{currentStreak}</span>
                <span className="text-base sm:text-lg font-semibold text-slate-300">Days</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {currentStreak > 0 ? 'Consistent habit!' : 'Study today to start!'}
              </p>
            </div>

            {/* Active Study Time */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                <span>Time Spent</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                {performanceStats.totalMinutes}
                <span className="text-base sm:text-lg font-semibold text-slate-300 ml-1">min</span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {filteredSessions.length} total sessions
              </p>
            </div>

            {/* Total Cards */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 sm:p-5 shadow-lg">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-medium">
                <span>Cards in Scope</span>
                <Layers className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                {masteryStats.total}
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {masteryStats.new} new unseen
              </p>
            </div>
          </div>

          {/* PRG-001: Deck Mastery Breakdown Bar */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Deck Mastery Breakdown
              </h2>
              <span className="text-xs text-slate-400 font-mono">
                {masteryStats.total} total cards
              </span>
            </div>

            {masteryStats.total === 0 ? (
              <p className="text-xs text-slate-400 py-3">No cards found in this selection.</p>
            ) : (
              <div>
                {/* Segmented Progress Bar */}
                <div
                  className="w-full h-4 sm:h-5 bg-slate-900 rounded-full overflow-hidden flex shadow-inner mb-4"
                  role="progressbar"
                  aria-label="Deck mastery progress"
                  aria-valuenow={masteryStats.total > 0 ? Math.round((masteryStats.review / masteryStats.total) * 100) : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  {/* Mature Review (Emerald) */}
                  <div
                    style={{ width: `${(masteryStats.review / masteryStats.total) * 100}%` }}
                    className="bg-emerald-500 hover:bg-emerald-400 transition-all duration-300"
                    title={`Mature Review: ${masteryStats.review} cards`}
                  />
                  {/* Learning (Blue) */}
                  <div
                    style={{ width: `${(masteryStats.learning / masteryStats.total) * 100}%` }}
                    className="bg-blue-500 hover:bg-blue-400 transition-all duration-300"
                    title={`Learning: ${masteryStats.learning} cards`}
                  />
                  {/* Relearning Lapsed (Amber) */}
                  <div
                    style={{ width: `${(masteryStats.relearning / masteryStats.total) * 100}%` }}
                    className="bg-amber-500 hover:bg-amber-400 transition-all duration-300"
                    title={`Relearning Lapsed: ${masteryStats.relearning} cards`}
                  />
                  {/* New (Slate/Cyan) */}
                  <div
                    style={{ width: `${(masteryStats.new / masteryStats.total) * 100}%` }}
                    className="bg-slate-600 hover:bg-slate-500 transition-all duration-300"
                    title={`New Unseen: ${masteryStats.new} cards`}
                  />
                  {/* Suspended (Rose/Red) */}
                  <div
                    style={{ width: `${(masteryStats.suspended / masteryStats.total) * 100}%` }}
                    className="bg-rose-900 hover:bg-rose-800 transition-all duration-300"
                    title={`Suspended: ${masteryStats.suspended} cards`}
                  />
                </div>

                {/* Legend badges */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-slate-300">Mature:</span>
                    <strong className="text-white ml-auto">{masteryStats.review}</strong>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                    <span className="text-slate-300">Learning:</span>
                    <strong className="text-white ml-auto">{masteryStats.learning}</strong>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-slate-300">Lapsed:</span>
                    <strong className="text-white ml-auto">{masteryStats.relearning}</strong>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500 shrink-0" />
                    <span className="text-slate-300">New:</span>
                    <strong className="text-white ml-auto">{masteryStats.new}</strong>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-slate-900/50 rounded-lg col-span-2 sm:col-span-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-900 shrink-0" />
                    <span className="text-slate-300">Suspended:</span>
                    <strong className="text-white ml-auto">{masteryStats.suspended}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Grid of Forecast & Activity Heatmap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PRG-004: Upcoming 7-Day Due Forecast */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    Upcoming 7-Day Due Forecast
                  </h2>
                  <span className="text-xs text-cyan-400 font-semibold">
                    {dueForecast[0]?.count || 0} Due Today
                  </span>
                </div>

                {/* Mini Bar Chart */}
                <div className="grid grid-cols-7 gap-2 items-end h-32 pt-4 pb-2 border-b border-slate-700/60">
                  {dueForecast.map((item, idx) => {
                    const heightPercent = maxDueCount > 0 ? Math.max(12, Math.round((item.count / maxDueCount) * 100)) : 12;
                    const isToday = idx === 0;

                    return (
                      <div key={item.dateStr} className="flex flex-col items-center h-full justify-end group">
                        <span className="text-[11px] font-mono text-slate-300 mb-1 group-hover:text-white">
                          {item.count}
                        </span>
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[28px] rounded-t-md transition-all ${
                            isToday
                              ? 'bg-blue-500 group-hover:bg-blue-400 shadow-md shadow-blue-500/20'
                              : item.count > 0
                              ? 'bg-slate-600 group-hover:bg-slate-500'
                              : 'bg-slate-700/40'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-7 gap-2 mt-2 text-center text-[10px] sm:text-xs text-slate-400 font-medium">
                  {dueForecast.map(item => (
                    <div key={item.dateStr} className="truncate">{item.dayLabel}</div>
                  ))}
                </div>
              </div>

              {activeDeck && onStudyDeck && (dueForecast[0]?.count ?? 0) > 0 && (
                <div className="mt-4 pt-3">
                  <button
                    onClick={() => onStudyDeck(activeDeck)}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 min-h-[44px]"
                  >
                    <Play className="w-3.5 h-3.5" /> Study Due Cards ({dueForecast[0]?.count ?? 0})
                  </button>
                </div>
              )}
            </div>

            {/* PRG-003: Daily Activity Heatmap (Last 28 Days) */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-400" />
                  Study Activity (Last 4 Weeks)
                </h2>
                <span className="text-xs text-amber-400 font-semibold">
                  {currentStreak} Day Streak
                </span>
              </div>

              {/* 4x7 Days Calendar Matrix */}
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-4">
                {activityHeatmap.map(day => {
                  const hasActivity = day.count > 0;
                  const bgClass =
                    day.count >= 20
                      ? 'bg-emerald-400 text-slate-950 font-bold'
                      : day.count >= 8
                      ? 'bg-emerald-500 text-white'
                      : day.count > 0
                      ? 'bg-emerald-700/80 text-emerald-100'
                      : 'bg-slate-900 border border-slate-800 text-slate-500';

                  return (
                    <div
                      key={day.dateStr}
                      className={`h-9 sm:h-10 rounded-lg flex flex-col items-center justify-center p-1 text-[10px] transition-all ${bgClass}`}
                      title={`${day.label}: ${day.count} reviews`}
                    >
                      <span className="leading-none">{day.label.split(' ')[1]}</span>
                      {hasActivity && (
                        <span className="text-[9px] opacity-90 mt-0.5">{day.count}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div className="flex items-center justify-end gap-2 text-[10px] text-slate-400">
                <span>Less</span>
                <span className="w-2.5 h-2.5 rounded bg-slate-900 border border-slate-700" />
                <span className="w-2.5 h-2.5 rounded bg-emerald-700/80" />
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
                <span>More</span>
              </div>
            </div>
          </div>

          {/* PRG-005: Exam Readiness & Target Pace Tracker */}
          {examReadiness && (
            <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[11px] font-bold uppercase tracking-wider">
                      Exam Target
                    </span>
                    {examReadiness.targetDeckName && (
                      <span className="text-xs text-slate-400">{examReadiness.targetDeckName}</span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Target Exam Date: {examReadiness.examDate}
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xl sm:text-2xl font-extrabold text-amber-400">
                      {examReadiness.daysRemaining} Days
                    </div>
                    <span className="text-[11px] text-slate-400">Time remaining</span>
                  </div>
                </div>
              </div>

              {/* Pace & Introduction Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-900/60 rounded-xl mb-4 text-xs">
                <div>
                  <span className="text-slate-400 block mb-0.5">Required Daily Pace</span>
                  <span className="text-base font-bold text-white">
                    {examReadiness.requiredDailyPace} new cards/day
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Unseen Cards to Learn</span>
                  <span className="text-base font-bold text-amber-300">
                    {examReadiness.unseenCards} cards
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Readiness Status</span>
                  <span
                    className={`font-semibold inline-block px-2 py-0.5 rounded text-[11px] ${
                      examReadiness.isOnTrack
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                        : 'bg-rose-950 text-rose-300 border border-rose-700'
                    }`}
                  >
                    {examReadiness.isOnTrack ? '✓ On Track' : '⚡ Intensive Pace Required'}
                  </span>
                </div>
              </div>

              {/* Progress bar of cards introduced */}
              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                  <span>Curriculum Introduction Progress</span>
                  <span>{examReadiness.progressPercent}% of deck started</span>
                </div>
                <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${examReadiness.progressPercent}%` }}
                    className="h-full bg-amber-500 rounded-full transition-all duration-300"
                  />
                </div>
              </div>
            </div>
          )}

          {/* PRG-006: Trouble Spots / Difficult Cards List */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Trouble Spots — Difficult Cards
              </h2>
              <span className="text-xs text-slate-400">Top lapsed questions</span>
            </div>

            {difficultCards.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-sm bg-slate-900/40 rounded-xl">
                🎉 Great recall! No frequently lapsed or trouble cards found in this deck.
              </div>
            ) : (
              <div className="space-y-3">
                {difficultCards.map((card, idx) => {
                  const isRevealed = Boolean(revealedCardAnswers[card.id]);
                  return (
                    <div
                      key={card.id}
                      className="p-4 bg-slate-900/60 border border-slate-700/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-600 transition-colors"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-950 text-rose-300 border border-rose-800">
                            #{idx + 1} · {card.lapse_count || 0} Lapses
                          </span>
                          <span className="text-xs text-slate-400">
                            {card.review_count || 0} reviews ({card.incorrect_count || 0} missed)
                          </span>
                        </div>
                        <p className="text-sm font-medium text-slate-100 mb-1">{card.question_text}</p>
                        {isRevealed ? (
                          <p className="text-xs text-emerald-400 pt-1 border-t border-slate-800 mt-1">
                            <span className="font-semibold text-slate-400">Answer: </span>
                            {card.answer_text}
                          </p>
                        ) : (
                          <button
                            onClick={() => toggleRevealAnswer(card.id)}
                            className="text-xs text-blue-400 hover:text-blue-300 underline mt-0.5"
                          >
                            Show answer
                          </button>
                        )}
                      </div>

                      {activeDeck && onStudyDeck && (
                        <button
                          onClick={() => onStudyDeck(activeDeck)}
                          className="w-full sm:w-auto px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 min-h-[40px] shrink-0"
                          aria-label={`Practice deck ${activeDeck.name}`}
                        >
                          <Play className="w-3 h-3 text-emerald-400" /> Practice
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
