/**
 * Card Management View
 * Implements MGT-001..MGT-009
 */

import React, { useState } from 'react';
import { Card, Deck, LearningState } from '@/domain/types';
import { canonicalNormalize, computeContentHash } from '@/domain/normalization';
import { Search, Edit2, PauseCircle, PlayCircle, Download, Check, X, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface CardManagementViewProps {
  deck: Deck;
  cards: Card[];
  onCardsChange: (updatedCards: Card[]) => void;
  onBackToDeck: () => void;
}

export const CardManagementView: React.FC<CardManagementViewProps> = ({
  deck,
  cards,
  onCardsChange,
  onBackToDeck
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState<string>('');
  const [editAnswer, setEditAnswer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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
          {/* MGT-009 Export */}
          <button
            onClick={exportCardsCsv}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold rounded-lg shadow-sm min-h-[44px]"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
