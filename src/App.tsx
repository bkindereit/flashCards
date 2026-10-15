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
import { ProgressDashboardView } from '@/components/ProgressDashboardView';
import { DeckModal } from '@/components/DeckModal';
import { DeleteDeckConfirmationModal } from '@/components/DeleteDeckConfirmationModal';
import { UserManualView } from '@/components/UserManualView';
import {
  Layers, Plus, Play, Settings, Upload, Activity,
  Download, LogOut, WifiOff, Archive, Trash2, BookOpen, UserPlus, TrendingUp, HelpCircle
} from 'lucide-react';

export const App: React.FC = () => {
  const { user, isLoading, signInWithOtp, verifyOtp, signInWithPassword, signUp, signOut } = useAuth();

  // Navigation state
  const [currentView, setCurrentView] = useState<'decks' | 'study' | 'cards' | 'diagnostics' | 'progress' | 'manual'>('decks');
  const [selectedProgressDeckId, setSelectedProgressDeckId] = useState<string | null>(null);
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
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [otpCodeInput, setOtpCodeInput] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
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

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) return;
    const { error } = await signInWithPassword(emailInput.trim(), passwordInput);
    if (error) {
      setAuthMsg({ text: error.message, error: true });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !passwordInput) return;
    if (passwordInput.length < 6) {
      setAuthMsg({ text: 'Password must be at least 6 characters long.', error: true });
      return;
    }
    const { error, data } = await signUp(emailInput.trim(), passwordInput);
    if (error) {
      setAuthMsg({ text: error.message, error: true });
    } else if (data?.user && !data?.session) {
      setAuthMsg({
        text: 'Account created! Please check your email inbox to confirm your email before signing in.',
        error: false
      });
    } else {
      setAuthMsg({ text: 'Account created successfully!', error: false });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      setAuthMsg({ text: 'Please enter your email address above first.', error: true });
      return;
    }
    const { error } = await signInWithOtp(emailInput.trim());
    if (error) {
      setAuthMsg({ text: error.message, error: true });
    } else {
      setShowOtpInput(true);
      setAuthMsg({ text: 'Check your email for the magic sign-in link or 6-digit code!', error: false });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !otpCodeInput.trim()) return;
    const { error } = await verifyOtp(emailInput.trim(), otpCodeInput.trim());
    if (error) {
      setAuthMsg({ text: error.message, error: true });
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

  // Card creation trigger state
  const [initialAddCardMode, setInitialAddCardMode] = useState<boolean>(false);

  const handleOpenCardManagement = async (deck: Deck, openAddMode: boolean = false) => {
    setActiveDeck(deck);
    setInitialAddCardMode(openAddMode);
    await loadCardsForDeck(deck.id);
    setCurrentView('cards');
  };

  const handleToggleArchive = async (deck: Deck) => {
    const { error } = await supabase.from('decks').update({ is_archived: !deck.is_archived }).eq('id', deck.id);
    if (!error) {
      setDecks(prev => prev.map(d => d.id === deck.id ? { ...d, is_archived: !d.is_archived } : d));
    }
  };

  const [isDeletingDeck, setIsDeletingDeck] = useState<boolean>(false);
  const [deleteDeckError, setDeleteDeckError] = useState<string | null>(null);

  const handleConfirmDeleteDeck = async () => {
    if (!deckToDelete) return;
    setIsDeletingDeck(true);
    setDeleteDeckError(null);
    try {
      // Attempt deletion via rpc_delete_deck first (handles review_events deletion atomically)
      const { error: rpcError } = await supabase.rpc('rpc_delete_deck', { p_deck_id: deckToDelete.id });
      if (!rpcError) {
        setDecks(prev => prev.filter(d => d.id !== deckToDelete.id));
        setDeckToDelete(null);
        return;
      }

      // Fallback to direct delete from 'decks'
      const { error: directError } = await supabase.from('decks').delete().eq('id', deckToDelete.id);
      if (directError) {
        setDeleteDeckError(rpcError?.message || directError.message);
      } else {
        setDecks(prev => prev.filter(d => d.id !== deckToDelete.id));
        setDeckToDelete(null);
      }
    } catch (err: unknown) {
      setDeleteDeckError(err instanceof Error ? err.message : 'Failed to delete deck');
    } finally {
      setIsDeletingDeck(false);
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
    if (currentView === 'manual') {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col p-4 sm:p-6">
          <UserManualView onBack={() => setCurrentView('decks')} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative">
        {!isOnline && (
          <div role="alert" className="absolute top-0 left-0 right-0 bg-amber-600 text-slate-950 px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2">
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline. Study actions require an active connection.</span>
          </div>
        )}
        <main className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/30">
            {authMode === 'signup' ? <UserPlus className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {authMode === 'signup' ? 'Create an Account' : 'Adaptive Flashcards'}
          </h1>
          <p className="text-sm text-slate-400 mb-6">
            {authMode === 'signup'
              ? 'Sign up with your email and password to start creating and studying flashcard decks.'
              : 'Sign in with your email to access your synchronized study decks and FSRS memory model.'}
          </p>

          {authMode === 'signup' ? (
            <form onSubmit={handleSignUp} className="space-y-4">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="Enter your email address"
                aria-label="Email address"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
              <input
                type="password"
                value={passwordInput}
                onChange={e => setPasswordInput(e.target.value)}
                placeholder="Create a password (min. 6 characters)"
                aria-label="Password"
                minLength={6}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                required
              />
              <button
                type="submit"
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl shadow-lg transition-colors focus:ring-2 focus:ring-emerald-400 focus:outline-none"
              >
                Create Account
              </button>
            </form>
          ) : (
            <>
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <input
                  type="email"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="Enter your email address"
                  aria-label="Email address"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  required
                />
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => setPasswordInput(e.target.value)}
                  placeholder="Enter your password"
                  aria-label="Password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none"
                >
                  Sign In with Password
                </button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-700"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-800 px-3 text-slate-400 font-semibold tracking-wider">Or</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl border border-slate-600 transition-colors focus:ring-2 focus:ring-blue-400 focus:outline-none text-sm"
                >
                  Send Magic Sign-In Link / Code
                </button>
              </form>

              {/* Direct 6-digit OTP code verification */}
              {(showOtpInput || authMsg) && (
                <div className="mt-6 pt-6 border-t border-slate-700/80">
                  <p className="text-xs text-slate-400 mb-3">
                    Received a 6-digit verification code in your email? Enter it below:
                  </p>
                  <form onSubmit={handleVerifyOtp} className="space-y-3">
                    <input
                      type="text"
                      maxLength={6}
                      value={otpCodeInput}
                      onChange={e => setOtpCodeInput(e.target.value.trim())}
                      placeholder="Enter 6-digit code (e.g. 123456)"
                      aria-label="Verification code"
                      className="w-full text-center tracking-widest font-mono text-lg bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={otpCodeInput.length < 6}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold rounded-xl shadow transition-colors focus:ring-2 focus:ring-emerald-400 focus:outline-none text-sm"
                    >
                      Verify Code & Sign In
                    </button>
                  </form>
                </div>
              )}
            </>
          )}

          {/* Toggle between Sign In and Sign Up */}
          <div className="mt-6 pt-4 border-t border-slate-700/60 text-center">
            {authMode === 'signup' ? (
              <p className="text-xs text-slate-400">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signin'); setAuthMsg(null); }}
                  className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 ml-1"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                New user?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('signup'); setAuthMsg(null); }}
                  className="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2 ml-1"
                >
                  Create an account
                </button>
              </p>
            )}
          </div>

          {/* User Manual Access */}
          <div className="mt-4 pt-3 border-t border-slate-700/40 flex items-center justify-center">
            <button
              type="button"
              onClick={() => setCurrentView('manual')}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors py-2 px-3 rounded-lg hover:bg-slate-700/50 min-h-[44px]"
              aria-label="Open user manual"
            >
              <HelpCircle className="w-4 h-4 text-blue-400" />
              <span>Need help? Read User Manual</span>
            </button>
          </div>

          {authMsg && (
            <div
              role="alert"
              className={`mt-4 p-3 rounded-lg text-xs font-medium ${authMsg.error ? 'bg-red-950/80 text-red-300 border border-red-700' : 'bg-green-950/80 text-green-300 border border-green-700'}`}
            >
              {authMsg.text}
            </div>
          )}
        </main>
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
      <header className="bg-slate-800 border-b border-slate-700 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer shrink-0" onClick={() => setCurrentView('decks')}>
          <div className="w-8 h-8 sm:w-9 sm:h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-md shrink-0">
            <BookOpen className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">FlashCards</h1>
            <span className="hidden sm:inline text-[11px] text-slate-400">FSRS Adaptive Memory</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={() => {
              setSelectedProgressDeckId(null);
              setCurrentView('progress');
            }}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors min-h-[36px] sm:min-h-0"
            aria-label="View learning progress dashboard"
          >
            <TrendingUp className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Progress</span>
          </button>

          <button
            onClick={() => setCurrentView('diagnostics')}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors min-h-[36px] sm:min-h-0"
            aria-label="Run diagnostics"
          >
            <Activity className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Diagnostics</span>
          </button>

          <button
            onClick={() => setCurrentView('manual')}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors min-h-[36px] sm:min-h-0"
            aria-label="Open user manual"
          >
            <HelpCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-blue-400" />
            <span className="hidden sm:inline">Manual</span>
          </button>

          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold rounded-lg transition-colors min-h-[36px] sm:min-h-0"
            aria-label="Export all data in JSON"
          >
            <Download className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export JSON</span>
          </button>

          <button
            onClick={signOut}
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs font-medium rounded-lg transition-colors border border-slate-700 min-h-[36px] sm:min-h-0"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main View Router */}
      <main className="flex-1 p-4 sm:p-6">
        {currentView === 'manual' && (
          <UserManualView onBack={() => setCurrentView('decks')} />
        )}

        {currentView === 'diagnostics' && (
          <DiagnosticsView onBack={() => setCurrentView('decks')} />
        )}

        {currentView === 'progress' && (
          <ProgressDashboardView
            decks={decks}
            initialDeckId={selectedProgressDeckId}
            onBack={() => setCurrentView('decks')}
            onStudyDeck={deck => handleStartStudy(deck)}
          />
        )}

        {currentView === 'cards' && activeDeck && (
          <CardManagementView
            deck={activeDeck}
            cards={activeDeckCards}
            onCardsChange={updated => setActiveDeckCards(updated)}
            onBackToDeck={() => setCurrentView('decks')}
            initialAddMode={initialAddCardMode}
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
            {/* Quick Progress Banner on Front Display */}
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-slate-800 via-slate-800 to-slate-850 border border-slate-700/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">Learning Progress & Mastery</h3>
                  <p className="text-xs text-slate-400">Track recall accuracy, study streaks, upcoming due forecast, and exam readiness.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedProgressDeckId(null);
                  setCurrentView('progress');
                }}
                className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-650 text-emerald-300 hover:text-emerald-200 text-xs font-semibold rounded-xl border border-slate-600 transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
                aria-label="Open learning progress dashboard"
              >
                <span>View Dashboard</span>
                <TrendingUp className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white">Your Flashcard Decks</h2>
                <p className="text-xs sm:text-sm text-slate-400">Select a deck to begin your timed adaptive recall session.</p>
              </div>

              <button
                onClick={() => {
                  setDeckToEdit(null);
                  setIsDeckModalOpen(true);
                }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl shadow-lg transition-all focus:ring-2 focus:ring-blue-400 focus:outline-none min-h-[44px]"
              >
                <Plus className="w-4 h-4" /> Create Deck
              </button>
            </div>

            {decks.length === 0 ? (
              <div className="p-8 sm:p-12 text-center bg-slate-800/50 border border-slate-700 rounded-2xl max-w-lg mx-auto">
                <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-white mb-1">No Decks Found</h3>
                <p className="text-sm text-slate-400 mb-6">Create your first deck to start importing questions and answers.</p>
                <button
                  onClick={() => setIsDeckModalOpen(true)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl min-h-[44px]"
                >
                  Create Deck
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {decks.map(deck => (
                  <div
                    key={deck.id}
                    className={`bg-slate-800 border rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xl transition-all ${deck.is_archived ? 'border-slate-700/40 opacity-70' : 'border-slate-700 hover:border-slate-600'}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg font-bold text-white leading-snug break-words">{deck.name}</h3>
                          {deck.is_archived && (
                            <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-slate-700 text-slate-400 rounded mt-1">
                              Archived
                            </span>
                          )}
                        </div>

                        {/* Top-right Deck Management Controls */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => {
                              setDeckToEdit(deck);
                              setIsDeckModalOpen(true);
                            }}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
                            title="Deck Settings"
                            aria-label="Deck settings"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleToggleArchive(deck)}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/60 transition-colors"
                            title={deck.is_archived ? 'Restore Deck' : 'Archive Deck'}
                            aria-label="Archive or restore deck"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeckToDelete(deck);
                              setDeleteDeckError(null);
                            }}
                            className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center text-red-400 hover:text-red-300 rounded-lg hover:bg-red-950/40 transition-colors"
                            title="Delete Deck"
                            aria-label="Delete deck"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {deck.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 mb-4 break-words">{deck.description}</p>
                      )}
                      {deck.exam_date && (
                        <div className="text-xs text-amber-400 font-medium mb-4">
                          Exam: {new Date(deck.exam_date).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Bottom Primary Learning & Card Actions Bar */}
                    <div className="pt-4 border-t border-slate-700/60 flex items-center justify-between gap-2 flex-wrap">
                      <button
                        onClick={() => handleStartStudy(deck)}
                        className="flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition-colors"
                        aria-label={`Study ${deck.name}`}
                      >
                        <Play className="w-4 h-4 fill-current" /> <span>Study</span>
                      </button>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          onClick={() => {
                            setActiveDeck(deck);
                            setIsImportModalOpen(true);
                          }}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
                          title="Import CSV"
                          aria-label="Import CSV"
                        >
                          <Upload className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenCardManagement(deck, true)}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
                          title="Add Card Manually"
                          aria-label={`Add card to ${deck.name}`}
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenCardManagement(deck, false)}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
                          title="Manage Cards"
                          aria-label="Manage cards"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProgressDeckId(deck.id);
                            setCurrentView('progress');
                          }}
                          className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center bg-slate-700 hover:bg-slate-650 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
                          title="Deck Progress"
                          aria-label={`View progress for ${deck.name}`}
                        >
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
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
          isDeleting={isDeletingDeck}
          error={deleteDeckError}
          onClose={() => {
            setDeckToDelete(null);
            setDeleteDeckError(null);
          }}
          onConfirmDelete={handleConfirmDeleteDeck}
        />
      )}
    </div>
  );
};
