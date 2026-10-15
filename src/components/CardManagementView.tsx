/**
 * Card Management View
 * Implements MGT-001..MGT-009
 */

import React, { useState } from 'react';
import { Card, Deck, LearningState } from '@/domain/types';
import { canonicalNormalize, computeContentHash } from '@/domain/normalization';
import { Search, Edit2, PauseCircle, PlayCircle, Download, Check, X, AlertCircle, Plus } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CardManagementViewProps {
  deck: Deck;
  cards: Card[];
  onCardsChange: (updatedCards: Card[]) => void;
  onBackToDeck: () => void;
  initialAddMode?: boolean;
}

export const CardManagementView: React.FC<CardManagementViewProps> = ({
  deck,
  cards,
  onCardsChange,
  onBackToDeck,
  initialAddMode = false
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Manual Card Creation State (MGT-010)
  const [isAddingCard, setIsAddingCard] = useState<boolean>(initialAddMode);
  const [newQuestion, setNewQuestion] = useState<string>('');
  const [newAnswer, setNewAnswer] = useState<string>('');
  const [isSavingCard, setIsSavingCard] = useState<boolean>(false);

  // MGT-010: Manually create and concatenate new card onto deck
  const handleAddCard = async () => {
    try {
      setIsSavingCard(true);
      setError(null);
      const normQ = canonicalNormalize(newQuestion);
      const normA = canonicalNormalize(newAnswer);

      if (!normQ || !normA) {
        setError('Question and answer cannot be blank.');
        setIsSavingCard(false);
        return;
      }

      const newHash = await computeContentHash(normQ, normA);

      // Check duplicates against active cards in deck (MGT-005, MGT-010)
      const isDuplicate = cards.some(
        c => !c.archived_at && c.content_hash === newHash
      );

      if (isDuplicate) {
        setError('A card with this exact question and answer already exists in the deck.');
        setIsSavingCard(false);
        return;
      }

      // Next source order: concatenated onto the end of the deck (MGT-010, SCH-010)
      const maxOrder = cards.length > 0 ? Math.max(...cards.map(c => c.source_order || 0)) : 0;
      const newSourceOrder = maxOrder + 1;
      const cohortSize = deck.cohort_size || 10;
      const cohortNumber = Math.floor((newSourceOrder - 1) / cohortSize) + 1;

      const cardToInsert = {
        user_id: deck.user_id,
        deck_id: deck.id,
        question_text: newQuestion.trim(),
        answer_text: newAnswer.trim(),
        normalized_question: normQ,
        normalized_answer: normA,
        content_hash: newHash,
        source_order: newSourceOrder,
        cohort_number: cohortNumber,
        learning_state: 'new' as LearningState,
        importance_weight: 1.0,
        algorithm_version: 'fsrs-v4',
        review_count: 0,
        correct_count: 0,
        incorrect_count: 0,
        lapse_count: 0,
        successful_relearning_sessions: 0
      };

      const { data, error: dbError } = await supabase
        .from('cards')
        .insert(cardToInsert)
        .select()
        .single();

      if (dbError) throw dbError;

      const createdCard: Card = data || {
        ...cardToInsert,
        id: crypto.randomUUID(),
        first_imported_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        difficulty: 0,
        stability_days: 0,
        percent_correct: 0
      };

      // Concatenate onto the end
      onCardsChange([...cards, createdCard]);
      setNewQuestion('');
      setNewAnswer('');
      setIsAddingCard(false);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Database error creating card');
    } finally {
      setIsSavingCard(false);
    }
  };

  // MGT-001: Search cards by question or answer text
  const filteredCards = cards.filter(c => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.question_text.toLowerCase().includes(term) ||
      c.answer_text.toLowerCase().includes(term)
    );
  });

  const startEdit = (card: Card) => {
    setEditingCardId(card.id);
    setEditQuestion(card.question_text);
    setEditAnswer(card.answer_text);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingCardId(null);
    setError(null);
  };

  // MGT-003..MGT-006: Save edited content with normalization & duplicate check
  const saveEdit = async (card: Card) => {
    try {
      const normQ = canonicalNormalize(editQuestion);
      const normA = canonicalNormalize(editAnswer);

      if (!normQ || !normA) {
        setError('Question and answer cannot be blank.');
        return;
      }

      const newHash = await computeContentHash(normQ, normA);

      // MGT-005: Reject edit that duplicates another active card in deck
      const isDuplicate = cards.some(
        c => c.id !== card.id && !c.archived_at && c.content_hash === newHash
      );

      if (isDuplicate) {
        setError('A card with this exact question and answer already exists in the deck.');
        return;
      }

      const { error: dbError } = await supabase
        .from('cards')
        .update({
          question_text: editQuestion,
          answer_text: editAnswer,
          normalized_question: normQ,
          normalized_answer: normA,
          content_hash: newHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (dbError) throw dbError;

      // Update local state preserving ID, review history, counters, memory state (MGT-006)
      const updated = cards.map(c =>
        c.id === card.id
          ? {
              ...c,
              question_text: editQuestion,
              answer_text: editAnswer,
              normalized_question: normQ,
              normalized_answer: normA,
              content_hash: newHash,
              updated_at: new Date().toISOString()
            }
          : c
      );

      onCardsChange(updated);
      setEditingCardId(null);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Database error updating card');
    }
  };

  // MGT-007, MGT-008: Suspend and restore card
  const toggleSuspend = async (card: Card) => {
    const newSuspendedAt = card.suspended_at ? null : new Date().toISOString();
    const newLearningState: LearningState = newSuspendedAt ? 'suspended' : (card.review_count > 0 ? 'review' : 'new');

    try {
      const { error: dbError } = await supabase
        .from('cards')
        .update({
          suspended_at: newSuspendedAt,
          learning_state: newLearningState,
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id);

      if (dbError) throw dbError;

      const updated = cards.map(c =>
        c.id === card.id
          ? {
              ...c,
              suspended_at: newSuspendedAt,
              learning_state: newLearningState,
              updated_at: new Date().toISOString()
            }
          : c
      );

      onCardsChange(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to toggle card status');
    }
  };

  // MGT-009: Export deck as UTF-8 CSV
  const exportCardsCsv = () => {
    const headers = ['question', 'answer'];
    const rows = cards.map(c => [
      `"${c.question_text.replace(/"/g, '""')}"`,
      `"${c.answer_text.replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${deck.name.replace(/\s+/g, '_')}_cards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6" role="region" aria-label="Card Management">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <button
            onClick={onBackToDeck}
            className="text-sm text-blue-400 hover:text-blue-300 font-medium mb-1 block min-h-[36px] flex items-center"
          >
            ← Back to Deck
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-white break-words">Card Management — {deck.name}</h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* MGT-010 Manual Card Add Button */}
          <button
            onClick={() => setIsAddingCard(prev => !prev)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-lg shadow-sm min-h-[44px]"
            aria-label="Add card"
          >
            <Plus className="w-4 h-4" /> Add Card
          </button>

          {/* MGT-009 Export */}
          <button
            onClick={exportCardsCsv}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold rounded-lg shadow-sm min-h-[44px]"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Manual Card Entry Panel (MGT-010) */}
      {isAddingCard && (
        <div className="bg-slate-800/90 border border-blue-500/50 rounded-xl p-5 mb-6 shadow-xl animate-in fade-in duration-150" aria-label="Add card panel">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-400" />
              Add Question & Answer Pair (Concatenated to Deck)
            </h2>
            <button
              onClick={() => {
                setIsAddingCard(false);
                setNewQuestion('');
                setNewAnswer('');
                setError(null);
              }}
              className="text-slate-400 hover:text-slate-200 p-1 min-h-[36px] min-w-[36px] flex items-center justify-center"
              aria-label="Close add card form"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="new-card-question" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Question
              </label>
              <textarea
                id="new-card-question"
                value={newQuestion}
                onChange={e => setNewQuestion(e.target.value)}
                placeholder="Type the question prompt here..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-base sm:text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-slate-500"
                aria-label="Card question"
              />
            </div>

            <div>
              <label htmlFor="new-card-answer" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Answer
              </label>
              <textarea
                id="new-card-answer"
                value={newAnswer}
                onChange={e => setNewAnswer(e.target.value)}
                placeholder="Type the answer here..."
                rows={3}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white text-base sm:text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-slate-500"
                aria-label="Card answer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAddingCard(false);
                setNewQuestion('');
                setNewAnswer('');
                setError(null);
              }}
              className="px-4 py-2 text-slate-400 hover:text-slate-200 text-sm font-semibold min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddCard}
              disabled={isSavingCard}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shadow-md min-h-[44px] flex items-center gap-2"
              aria-label="Save card"
            >
              <Check className="w-4 h-4" /> Save Card
            </button>
          </div>
        </div>
      )}

      {/* Search Bar (MGT-001) */}
      <div className="relative mb-6">
        <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search cards by question or answer..."
          className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 min-h-[44px] text-base sm:text-sm text-white placeholder-slate-400 focus:ring-2 focus:ring-blue-400 focus:outline-none"
          aria-label="Search cards"
        />
      </div>

      {error && (
        <div role="alert" className="p-4 bg-red-950/80 border border-red-600 rounded-xl flex items-center gap-3 text-red-200 mb-6">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Cards Table (MGT-002) */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900 border-b border-slate-700 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3 w-1/4">Question</th>
                <th className="p-3 w-1/4">Answer</th>
                <th className="p-3">State</th>
                <th className="p-3">First Import</th>
                <th className="p-3">Reviews</th>
                <th className="p-3">Correct</th>
                <th className="p-3">Missed</th>
                <th className="p-3">% Correct</th>
                <th className="p-3">Next Due</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 font-mono text-xs">
              {filteredCards.map(card => {
                const isEditing = editingCardId === card.id;
                const percentCorrect = card.review_count > 0
                  ? `${Math.round((card.correct_count / card.review_count) * 100)}%`
                  : '0%';

                return (
                  <tr key={card.id} className="hover:bg-slate-750 transition-colors">
                    {/* Question Column */}
                    <td className="p-3 font-sans text-sm">
                      {isEditing ? (
                        <textarea
                          value={editQuestion}
                          onChange={e => setEditQuestion(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-sans text-sm"
                          rows={2}
                        />
                      ) : (
                        <div className="line-clamp-2 text-slate-100">{card.question_text}</div>
                      )}
                    </td>

                    {/* Answer Column */}
                    <td className="p-3 font-sans text-sm">
                      {isEditing ? (
                        <textarea
                          value={editAnswer}
                          onChange={e => setEditAnswer(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white font-sans text-sm"
                          rows={2}
                        />
                      ) : (
                        <div className="line-clamp-2 text-slate-300">{card.answer_text}</div>
                      )}
                    </td>

                    {/* State Column */}
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        card.suspended_at
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : card.learning_state === 'review'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : card.learning_state === 'relearning'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-700 text-slate-300'
                      }`}>
                        {card.suspended_at ? 'suspended' : card.learning_state}
                      </span>
                    </td>

                    {/* First Import Date */}
                    <td className="p-3 text-slate-400">
                      {new Date(card.first_imported_at).toLocaleDateString()}
                    </td>

                    {/* Reviews */}
                    <td className="p-3 text-slate-300">{card.review_count}</td>

                    {/* Correct */}
                    <td className="p-3 text-green-400">{card.correct_count}</td>

                    {/* Missed */}
                    <td className="p-3 text-red-400">{card.incorrect_count}</td>

                    {/* % Correct (DAT-012, DAT-013, MGT-002) */}
                    <td className="p-3 text-cyan-400 font-bold">{percentCorrect}</td>

                    {/* Next Due Date */}
                    <td className="p-3 text-slate-400">
                      {card.next_due_at ? new Date(card.next_due_at).toLocaleDateString() : '—'}
                    </td>

                    {/* Actions */}
                    <td className="p-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => saveEdit(card)}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-green-600 hover:bg-green-500 text-white rounded"
                            aria-label="Save changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
                            aria-label="Cancel editing"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          {/* Edit button */}
                          <button
                            onClick={() => startEdit(card)}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded"
                            aria-label="Edit card"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {/* Suspend / Restore button */}
                          <button
                            onClick={() => toggleSuspend(card)}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white rounded"
                            aria-label={card.suspended_at ? 'Restore card' : 'Suspend card'}
                          >
                            {card.suspended_at ? (
                              <PlayCircle className="w-4 h-4 text-green-400" />
                            ) : (
                              <PauseCircle className="w-4 h-4 text-amber-400" />
                            )}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredCards.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 font-sans text-sm">
                    {cards.length === 0
                      ? 'No cards in this deck yet. Click "+ Add Card" above to type your first question and answer!'
                      : 'No cards match your search.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
