/**
 * Permanent Deck Deletion Confirmation Modal
 * Implements DEK-002: Requires explicit confirmation naming the deck
 */

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteDeckConfirmationModalProps {
  isOpen: boolean;
  deckName: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export const DeleteDeckConfirmationModal: React.FC<DeleteDeckConfirmationModalProps> = ({
  isOpen,
  deckName,
  onClose,
  onConfirmDelete
}) => {
  const [typedName, setTypedName] = useState<string>('');

  if (!isOpen) return null;

  const isConfirmed = typedName.trim() === deckName.trim();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-deck-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-slate-800 border border-red-700/60 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700 mb-4">
          <div className="flex items-center gap-3 text-red-400">
            <AlertTriangle className="w-6 h-6" />
            <h2 id="delete-deck-title" className="text-xl font-bold text-white">Delete Deck Permanently</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg"
            aria-label="Cancel deletion"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          This action will permanently delete <strong className="text-white">&ldquo;{deckName}&rdquo;</strong> and all its cards.
          This cannot be undone.
        </p>

        <p className="text-xs text-slate-400 mb-2 font-medium">
          To confirm, type <span className="font-mono text-red-300 bg-red-950/60 px-1 py-0.5 rounded border border-red-800">{deckName}</span> below:
        </p>

        <input
          type="text"
          value={typedName}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Type deck name here..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white mb-6 focus:ring-2 focus:ring-red-400 focus:outline-none"
          aria-label="Confirm deck name for permanent deletion"
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isConfirmed}
            onClick={onConfirmDelete}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md focus:ring-2 focus:ring-red-400 focus:outline-none"
          >
            <Trash2 className="w-4 h-4" /> Delete Deck
          </button>
        </div>
      </div>
    </div>
  );
};
