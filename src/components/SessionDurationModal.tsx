/**
 * Session Duration Selector Modal
 * Implements SES-001, SES-002
 */

import React, { useState } from 'react';
import { Clock } from 'lucide-react';

interface SessionDurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartSession: (durationMinutes: number) => void;
}

export const SessionDurationModal: React.FC<SessionDurationModalProps> = ({
  isOpen,
  onClose,
  onStartSession
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number>(15);
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const presets = [5, 10, 15, 20, 30];

  const handleStart = () => {
    let finalDuration = selectedPreset;
    if (isCustom) {
      const parsed = parseInt(customMinutes, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 240) {
        setError('Please enter a whole number of minutes between 1 and 240.');
        return;
      }
      finalDuration = parsed;
    }

    setError(null);
    onStartSession(finalDuration);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="duration-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full p-6 text-slate-100">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-blue-400" />
          <h2 id="duration-modal-title" className="text-xl font-bold">Select Session Duration</h2>
        </div>

        <p className="text-sm text-slate-400 mb-6">
          Choose a timed study duration. You can end early or finish your active card when time expires.
        </p>

        {/* Presets (SES-002) */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          {presets.map(minutes => (
            <button
              key={minutes}
              type="button"
              onClick={() => {
                setSelectedPreset(minutes);
                setIsCustom(false);
                setError(null);
              }}
              className={`py-3 rounded-xl font-bold text-sm transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none ${
                !isCustom && selectedPreset === minutes
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {minutes}m
            </button>
          ))}
        </div>

        {/* Custom duration option (SES-002: 1..240) */}
        <div className="mb-6">
          <label className="flex items-center gap-2 cursor-pointer mb-2">
            <input
              type="radio"
              name="duration-type"
              checked={isCustom}
              onChange={() => setIsCustom(true)}
              className="text-blue-600 focus:ring-blue-500 rounded"
            />
            <span className="text-sm font-medium text-slate-300">Custom Duration (1 - 240 min)</span>
          </label>

          {isCustom && (
            <div className="mt-2">
              <input
                type="number"
                min="1"
                max="240"
                value={customMinutes}
                onChange={e => {
                  setCustomMinutes(e.target.value);
                  setError(null);
                }}
                placeholder="Minutes (e.g. 25)"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-blue-400 focus:outline-none"
                aria-label="Custom duration in minutes"
              />
            </div>
          )}
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-400 mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            Start Session
          </button>
        </div>
      </div>
    </div>
  );
};
