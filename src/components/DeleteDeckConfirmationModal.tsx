/**
 * Permanent Deck Deletion Confirmation Modal
 * Implements DEK-002: Requires explicit confirmation naming the deck
 */

import React, { useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteDeckConfirmationModalProps {
  isOpen: boolean;
  deckName: string;
  isDeleting?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirmDelete: () => void;
}

export const DeleteDeckConfirmationModal: React.FC<DeleteDeckConfirmationModalProps> = ({
  isOpen,
  deckName,
  isDeleting = false,
  error = null,
  onClose,
  onConfirmDelete
}) => {
  const [typedName, setTypedName] = useState<string>('');

  React.useEffect(() => {
    if (isOpen) {
      setTypedName('');
    }
  }, [isOpen, deckName]);

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
            disabled={isDeleting}
            className="text-slate-400 hover:text-white p-1 rounded-lg disabled:opacity-50"
            aria-label="Cancel deletion"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 mb-4">
          This action will permanently delete <strong className="text-white">&ldquo;{deckName}&rdquo;</strong> and all its cards.
          This cannot be undone.
        </p>

        {error && (
          <div role="alert" className="mb-4 p-3 bg-red-950/90 border border-red-700 text-red-200 text-xs rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs text-slate-400 mb-2 font-medium">
          To confirm, type <span className="font-mono text-red-300 bg-red-950/60 px-1 py-0.5 rounded border border-red-800">{deckName}</span> below:
        </p>

        <input
          type="text"
          value={typedName}
          disabled={isDeleting}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Type deck name here..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white mb-6 focus:ring-2 focus:ring-red-400 focus:outline-none disabled:opacity-50"
          aria-label="Confirm deck name for permanent deletion"
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 font-medium rounded-lg min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!isConfirmed || isDeleting}
            onClick={onConfirmDelete}
            className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-md focus:ring-2 focus:ring-red-400 focus:outline-none min-h-[44px]"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" /> <span>Delete Deck</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
