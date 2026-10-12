/**
 * Deck Create & Edit Modal
 * Implements DEK-001..DEK-009
 */

import React, { useState } from 'react';
import { Deck } from '@/domain/types';
import { Layers, Calendar, Sliders, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface DeckModalProps {
  isOpen: boolean;
  deckToEdit?: Deck | null;
  onClose: () => void;
  onSaved: (deck: Deck) => void;
}

export const DeckModal: React.FC<DeckModalProps> = ({
  isOpen,
  deckToEdit,
  onClose,
  onSaved
}) => {
  const [name, setName] = useState<string>(deckToEdit?.name ?? '');
  const [description, setDescription] = useState<string>(deckToEdit?.description ?? '');
  const [examDate, setExamDate] = useState<string>(
    deckToEdit?.exam_date ? new Date(deckToEdit.exam_date).toISOString().split('T')[0] ?? '' : ''
  );
  const [desiredRetention, setDesiredRetention] = useState<number>(deckToEdit?.desired_retention ?? 0.90);
  const [cohortSize, setCohortSize] = useState<number>(deckToEdit?.cohort_size ?? 10);
  const [newLearningFraction, setNewLearningFraction] = useState<number>(deckToEdit?.new_learning_fraction ?? 0.30);
  const [minRetryDelay, setMinRetryDelay] = useState<number>(deckToEdit?.min_failed_retry_delay_seconds ?? 60);
  const [minIntervening, setMinIntervening] = useState<number>(deckToEdit?.min_intervening_cards ?? 3);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Deck name is required.');
      return;
    }

    // Boundary validations (DEK-004..DEK-008)
    if (desiredRetention < 0.70 || desiredRetention > 0.97) {
      setError('Desired retention must be between 0.70 and 0.97.');
      return;
    }
    if (cohortSize < 5 || cohortSize > 20) {
      setError('Cohort size must be between 5 and 20.');
      return;
    }
    if (newLearningFraction < 0.0 || newLearningFraction > 0.50) {
      setError('New learning fraction must be between 0.00 and 0.50.');
      return;
    }

    setIsSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      exam_date: examDate ? new Date(examDate).toISOString() : null,
      desired_retention: desiredRetention,
      cohort_size: cohortSize,
      new_learning_fraction: newLearningFraction,
      min_failed_retry_delay_seconds: minRetryDelay,
      min_intervening_cards: minIntervening,
      updated_at: new Date().toISOString()
    };

    try {
      if (deckToEdit) {
        // Edit deck (DEK-009)
        const { data, error: dbError } = await supabase
          .from('decks')
          .update(payload)
          .eq('id', deckToEdit.id)
          .select()
          .single();

        if (dbError) throw dbError;
        onSaved(data);
      } else {
        // Create deck (DEK-001)
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Unauthenticated');

        const { data, error: dbError } = await supabase
          .from('decks')
          .insert({
            ...payload,
            user_id: user.id
          })
          .select()
          .single();

        if (dbError) throw dbError;
        onSaved(data);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Database error saving deck');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-xl w-full p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-6">
          <div className="flex items-center gap-3">
            <Layers className="w-6 h-6 text-blue-400" />
            <h2 id="deck-modal-title" className="text-xl font-bold">
              {deckToEdit ? 'Deck Settings' : 'Create New Deck'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label htmlFor="deck-name" className="block text-xs uppercase font-bold text-slate-300 mb-1">Deck Name</label>
            <input
              id="deck-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Molecular Biology or JLPT N3"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="deck-description" className="block text-xs uppercase font-bold text-slate-300 mb-1">Description (Optional)</label>
            <textarea
              id="deck-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Topic summary or study notes..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="deck-exam-date" className="block text-xs uppercase font-bold text-slate-300 mb-1 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" /> Optional Exam Date (DEK-003)
            </label>
            <input
              id="deck-exam-date"
              type="date"
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
          </div>

          <div className="pt-2 border-t border-slate-700/60">
            <h3 className="text-xs uppercase tracking-wider font-bold text-blue-400 mb-3 flex items-center gap-1.5">
              <Sliders className="w-4 h-4" /> Adaptive Scheduler Parameters
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label htmlFor="deck-retention" className="block font-semibold text-slate-300 mb-1">
                  Desired Retention (0.70 - 0.97): {desiredRetention}
                </label>
                <input
                  id="deck-retention"
                  type="range"
                  min="0.70"
                  max="0.97"
                  step="0.01"
                  value={desiredRetention}
                  onChange={e => setDesiredRetention(parseFloat(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div>
                <label htmlFor="deck-cohort-size" className="block font-semibold text-slate-300 mb-1">
                  Cohort Size (5 - 20): {cohortSize}
                </label>
                <input
                  id="deck-cohort-size"
                  type="number"
                  min="5"
                  max="20"
                  value={cohortSize}
                  onChange={e => setCohortSize(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                />
              </div>

              <div>
                <label htmlFor="deck-new-learning-fraction" className="block font-semibold text-slate-300 mb-1">
                  New-Learning Fraction (0.0 - 0.5): {newLearningFraction}
                </label>
                <input
                  id="deck-new-learning-fraction"
                  type="range"
                  min="0.0"
                  max="0.50"
                  step="0.05"
                  value={newLearningFraction}
                  onChange={e => setNewLearningFraction(parseFloat(e.target.value))}
                  className="w-full accent-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Retry Delay (Seconds): {minRetryDelay}
                </label>
                <input
                  type="number"
                  min="10"
                  value={minRetryDelay}
                  onChange={e => setMinRetryDelay(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-300 mb-1">
                  Min Intervening Cards Before Retry: {minIntervening}
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={minIntervening}
                  onChange={e => setMinIntervening(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white"
                />
              </div>
            </div>
          </div>

          {error && (
            <div role="alert" className="text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              {isSaving ? 'Saving...' : 'Save Deck'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
