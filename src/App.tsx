/**
 * Main Application Shell
 * Implements ARC-001..ARC-010, AUT-001..AUT-006, DEK-001..DEK-009, DIA-001..DIA-006, REL-005
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Deck, Card } from '@/domain/types';
import { supabase } from '@/lib/supabase';
import { exportAllUserData, triggerJsonDownload } from '@/domain/exportService';
import { StudyView } from '@/components/StudyView';
import { SessionDurationModal } from '@/components/SessionDurationModal';
import { CsvImportModal } from '@/components/CsvImportModal';
import { CardManagementView } from '@/components/CardManagementView';
import { DiagnosticsView } from '@/components/DiagnosticsView';
import { DeckModal } from '@/components/DeckModal';
import { DeleteDeckConfirmationModal } from '@/components/DeleteDeckConfirmationModal';
import {
  Layers, Plus, Play, Settings, Upload, Activity,
  Download, LogOut, WifiOff, Archive, Trash2, BookOpen
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading, signInWithOtp, signOut } = useAuth();

  // Navigation state
  const [currentView, setCurrentView] = useState<'decks' | 'study' | 'cards' | 'diagnostics'>('decks');
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeDeckCards, setActiveDeckCards] = useState<Card[]>([]);

  // Modals state
  const [isDurationModalOpen, setIsDurationModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState<Deck | null>(null);
  const [deckToDelete, setDeckToDelete] = useState<Deck | null>(null);

  // Session state
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);

  // Network offline state (ARC-006)
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Auth form
  const [emailInput, setEmailInput] = useState('');
  const [authMsg, setAuthMsg] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch decks on user login
  const loadDecks = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase.from('decks').select('*').order('created_at', { ascending: false });
    if (!error && data) {
      setDecks(data);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDecks();
    }
  }, [user, loadDecks]);

  // Load cards for active deck
  const loadCardsForDeck = async (deckId: string) => {
    const { data, error } = await supabase.from('cards').select('*').eq('deck_id', deckId);
    if (!error && data) {
      setActiveDeckCards(data);
      return data;
    }
    return [];
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    const { error } = await signInWithOtp(emailInput.trim());
    if (error) {
      setAuthMsg({ text: error.message, error: true });
    } else {
      setAuthMsg({ text: 'Check your email for the magic sign-in link or OTP code!', error: false });
    }
  };

  const handleStartStudy = async (deck: Deck) => {
    setActiveDeck(deck);
    const loadedCards = await loadCardsForDeck(deck.id);
    if (loadedCards.length === 0) {
      setIsImportModalOpen(true);
      return;
    }
    setIsDurationModalOpen(true);
  };

  const handleLaunchStudySession = (durationMinutes: number) => {
    setSessionDurationMinutes(durationMinutes);
    setIsDurationModalOpen(false);
    setCurrentView('study');
  };

  const handleOpenCardManagement = async (deck: Deck) => {
    setActiveDeck(deck);
    await loadCardsForDeck(deck.id);
    setCurrentView('cards');
  };

  const handleToggleArchive = async (deck: Deck) => {
    const { error } = await supabase.from('decks').update({ is_archived: !deck.is_archived }).eq('id', deck.id);
    if (!error) {
      setDecks(prev => prev.map(d => d.id === deck.id ? { ...d, is_archived: !d.is_archived } : d));
    }
  };

  const handleConfirmDeleteDeck = async () => {
    if (!deckToDelete) return;
    const { error } = await supabase.from('decks').delete().eq('id', deckToDelete.id);
    if (!error) {
      setDecks(prev => prev.filter(d => d.id !== deckToDelete.id));
      setDeckToDelete(null);
    }
  };

  const handleExportAll = async () => {
    try {
      const data = await exportAllUserData();
      triggerJsonDownload(data, `flashcards_export_${Date.now()}.json`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Export failed');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading Flashcards...</span>
        </div>
      </div>
    );
  }

  // Unauthenticated Sign-in View (AUT-001)
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative">
        {!isOnline && (
          <div role="alert" className="absolute top-0 left-0 right-0 bg-amber-600 text-slate-950 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline. Study actions require an active connection.</span>
          </div>
        )}
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Adaptive Flashcards</h1>
          <p className="text-sm text-slate-400 mb-6">
            Sign in with your email to access your synchronized study decks and FSRS memory model.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="email"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="Enter your email address"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-400 focus:outline-none"
              required
            />
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none"
            >
              Send Magic Sign-In Link
            </button>
          </form>

          {authMsg && (
            <div
              role="alert"
              className={`mt-4 p-3 rounded-lg text-xs font-medium ${authMsg.error ? 'bg-red-950/80 text-red-300 border border-red-700' : 'bg-green-950/80 text-green-300 border border-green-700'}`}
            >
              {authMsg.text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Network offline warning (ARC-006) */}
      {!isOnline && (
        <div role="alert" className="bg-amber-600 text-slate-950 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" />
          <span>You are currently offline. Study actions require an active connection.</span>
        </div>
      )}

      {/* Top Navbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('decks')}>
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">FlashCards</h1>
            <span className="text-[11px] text-slate-400">FSRS Adaptive Memory</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentView('diagnostics')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            aria-label="Run diagnostics"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400" /> Diagnostics
          </button>

          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
            aria-label="Export all data in JSON"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" /> Export JSON
          </button>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors border border-slate-700"
            aria-label="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {/* Main View Router */}
      <main className="flex-1 p-6">
        {currentView === 'diagnostics' && (
          <DiagnosticsView onBack={() => setCurrentView('decks')} />
        )}

        {currentView === 'cards' && activeDeck && (
          <CardManagementView
            deck={activeDeck}
            cards={activeDeckCards}
            onCardsChange={updated => setActiveDeckCards(updated)}
            onBackToDeck={() => setCurrentView('decks')}
          />
        )}

        {currentView === 'study' && activeDeck && (
          <StudyView
            deck={activeDeck}
            cards={activeDeckCards}
            durationMinutes={sessionDurationMinutes}
            onFinish={() => {
              loadDecks();
              setCurrentView('decks');
            }}
            onExit={() => {
              loadDecks();
              setCurrentView('decks');
            }}
          />
        )}

        {currentView === 'decks' && (
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white">Your Flashcard Decks</h2>
                <p className="text-sm text-slate-400">Select a deck to begin your timed adaptive recall session.</p>
              </div>

              <button
                onClick={() => {
                  setDeckToEdit(null);
                  setIsDeckModalOpen(true);
                }}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none"
              >
                <Plus className="w-4 h-4" /> Create Deck
              </button>
            </div>

            {decks.length === 0 ? (
              <div className="p-12 text-center bg-slate-800/50 border border-slate-700 rounded-2xl max-w-lg mx-auto">
                <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No Decks Found</h3>
                <p className="text-sm text-slate-400 mb-6">Create your first deck to start importing questions and answers.</p>
                <button
                  onClick={() => setIsDeckModalOpen(true)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl"
                >
                  Create Deck
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {decks.map(deck => (
                  <div
                    key={deck.id}
                    className={`bg-slate-800 border rounded-2xl p-6 flex flex-col justify-between shadow-xl transition-all ${deck.is_archived ? 'border-slate-700/40 opacity-70' : 'border-slate-700 hover:border-slate-600'}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white leading-snug">{deck.name}</h3>
                        {deck.is_archived && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-700 text-slate-400 rounded">
                            Archived
                          </span>
                        )}
                      </div>
                      {deck.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-4">{deck.description}</p>
                      )}
                      {deck.exam_date && (
                        <div className="text-xs text-amber-400 font-medium mb-4">
                          Exam: {new Date(deck.exam_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleStartStudy(deck)}
                          className="flex items-center gap-1 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md transition-colors"
                          aria-label={`Study ${deck.name}`}
                        >
                          <Play className="w-3.5 h-3.5" /> Study
                        </button>
                        <button
                          onClick={() => {
                            setActiveDeck(deck);
                            setIsImportModalOpen(true);
                          }}
                          className="p-2 bg-slate-700 hover:bg-slate-650 text-slate-300 rounded-lg text-xs"
                          title="Import CSV"
                          aria-label="Import CSV"
                        >
                          <Upload className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenCardManagement(deck)}
                          className="p-2 bg-slate-700 hover:bg-slate-650 text-slate-300 rounded-lg text-xs"
                          title="Manage Cards"
                          aria-label="Manage cards"
                        >
                          <Layers className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setDeckToEdit(deck);
                            setIsDeckModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-white rounded-lg"
                          title="Deck Settings"
                          aria-label="Deck settings"
                        >
                          <Settings className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleArchive(deck)}
                          className="p-2 text-slate-400 hover:text-white rounded-lg"
                          title={deck.is_archived ? 'Restore Deck' : 'Archive Deck'}
                          aria-label="Archive or restore deck"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeckToDelete(deck)}
                          className="p-2 text-red-400 hover:text-red-300 rounded-lg"
                          title="Delete Deck"
                          aria-label="Delete deck"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modals */}
      <SessionDurationModal
        isOpen={isDurationModalOpen}
        onClose={() => setIsDurationModalOpen(false)}
        onStartSession={handleLaunchStudySession}
      />

      {activeDeck && (
        <CsvImportModal
          isOpen={isImportModalOpen}
          deckId={activeDeck.id}
          onClose={() => setIsImportModalOpen(false)}
          onImportSuccess={async () => {
            await loadDecks();
            if (activeDeck) {
              await loadCardsForDeck(activeDeck.id);
            }
          }}
        />
      )}

      <DeckModal
        isOpen={isDeckModalOpen}
        deckToEdit={deckToEdit}
        onClose={() => {
          setIsDeckModalOpen(false);
          setDeckToEdit(null);
        }}
        onSaved={loadDecks}
      />

      {deckToDelete && (
        <DeleteDeckConfirmationModal
          isOpen={true}
          deckName={deckToDelete.name}
          onClose={() => setDeckToDelete(null)}
          onConfirmDelete={handleConfirmDeleteDeck}
        />
      )}
    </div>
  );
};
