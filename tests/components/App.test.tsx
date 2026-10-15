/**
 * App Shell Component Tests
 * Implements ARC-001..ARC-010, AUT-001..AUT-006, DEK-001..DEK-009, DIA-001, REL-005
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { App } from '@/App';
import { AuthProvider } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { createDeck } from '@/testing/factories';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } }
      }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    })),
    rpc: vi.fn(() => Promise.resolve({ data: true, error: null }))
  }
}));

describe('App Shell (ARC-001..ARC-010, AUT-002, ARC-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AUT-002: Shows sign-in screen when user is unauthenticated', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    expect(screen.getByText('Adaptive Flashcards')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
  });

  it('ARC-006: Shows offline indicator banner when browser loses network connection', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    // Fire offline event
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByText(/you are currently offline/i)).toBeInTheDocument();

    // Fire online event
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.queryByText(/you are currently offline/i)).not.toBeInTheDocument();
  });

  it('AUT-001, DEK-001: Shows deck dashboard when user is authenticated', async () => {
    const deck1 = createDeck({ name: 'Biochemistry Deck' });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'student@example.com' }
        }
      },
      error: null
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [deck1], error: null })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    expect(await screen.findByText(/your flashcard decks/i)).toBeInTheDocument();
    expect(await screen.findByText('Biochemistry Deck')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create deck/i })).toBeInTheDocument();
  });

  it('DIA-001: Navigates to diagnostics view when Diagnostics button is clicked', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'student@example.com' }
        }
      },
      error: null
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    const diagBtn = screen.getByRole('button', { name: /diagnostics/i });
    act(() => {
      fireEvent.click(diagBtn);
    });

    expect(screen.getByText(/system diagnostics/i)).toBeInTheDocument();
  });

  it('AUT-002: Submits login form and displays confirmation message', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    const emailInput = screen.getByPlaceholderText('Enter your email address');
    fireEvent.change(emailInput, { target: { value: 'learner@example.com' } });

    const submitBtn = screen.getByRole('button', { name: /send magic sign-in link/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'learner@example.com'
    }));
    expect(screen.getByText(/check your email for the magic sign-in link/i)).toBeInTheDocument();
  });

  it('AUT-008: Submits password login form and calls signInWithPassword', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    const emailInput = screen.getByPlaceholderText('Enter your email address');
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    fireEvent.change(emailInput, { target: { value: 'learner@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });

    const submitBtn = screen.getByRole('button', { name: /sign in with password/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'learner@example.com',
      password: 'mypassword123'
    });
  });

  it('AUT-007: Switches to Create Account view, submits sign up form and calls signUp', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);
    vi.mocked(supabase.auth.signUp).mockResolvedValue({ data: { user: { id: 'new-u' }, session: null }, error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    // Click "Create an account" toggle
    const toggleToSignUp = screen.getByRole('button', { name: /create an account/i });
    fireEvent.click(toggleToSignUp);

    expect(screen.getByRole('heading', { name: 'Create an Account' })).toBeInTheDocument();

    const emailInput = screen.getByPlaceholderText('Enter your email address');
    const passwordInput = screen.getByPlaceholderText('Create a password (min. 6 characters)');
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'securePass123' } });

    const submitBtn = screen.getByRole('button', { name: 'Create Account' });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'newuser@example.com',
      password: 'securePass123'
    });
    expect(screen.getByText(/account created!/i)).toBeInTheDocument();

    // Click "Sign In" toggle to return to sign in
    const toggleToSignIn = screen.getByRole('button', { name: 'Sign In' });
    fireEvent.click(toggleToSignIn);
    expect(screen.getByRole('heading', { name: 'Adaptive Flashcards' })).toBeInTheDocument();
  });

  it('DEK-004..008: Supports deck actions (manage cards, archive, study empty)', async () => {
    const deck1 = createDeck({ name: 'Cell Biology', description: 'Bio notes', is_archived: false });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'u1', email: 'user@example.com' } } },
      error: null
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [deck1], error: null })),
        eq: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    expect(await screen.findByText('Cell Biology')).toBeInTheDocument();

    // Toggle archive
    const archiveBtn = screen.getByLabelText(/archive or restore deck/i);
    await act(async () => {
      fireEvent.click(archiveBtn);
    });
    expect(supabase.from).toHaveBeenCalledWith('decks');

    // Click study with 0 cards -> opens import modal
    const studyBtn = screen.getByLabelText('Study Cell Biology');
    await act(async () => {
      fireEvent.click(studyBtn);
    });
    expect(screen.getByRole('heading', { name: /import csv flashcards/i })).toBeInTheDocument();

    // Close modal
    const closeBtn = screen.getByLabelText(/close import dialog/i);
    fireEvent.click(closeBtn);

    // Manage cards action
    const manageBtn = screen.getByLabelText(/manage cards/i);
    await act(async () => {
      fireEvent.click(manageBtn);
    });
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('DEK-001, DEK-002: Deletes a deck permanently with explicit name confirmation', async () => {
    const deck = createDeck({ id: 'deck-del-1', name: 'Delete Me Deck' });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'test@example.com' }
        }
      },
      error: null
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [deck], error: null })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    } as any);

    vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    expect(await screen.findByText('Delete Me Deck')).toBeInTheDocument();

    // Click Delete Deck button
    const deleteBtn = screen.getByLabelText(/delete deck/i);
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    // Confirmation modal should appear
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: /delete deck permanently/i })).toBeInTheDocument();
    const modalDeleteBtn = within(dialog).getByRole('button', { name: /delete deck/i });
    expect(modalDeleteBtn).toBeDisabled();

    // Type the deck name to confirm
    const input = within(dialog).getByLabelText(/confirm deck name for permanent deletion/i);
    fireEvent.change(input, { target: { value: 'Delete Me Deck' } });
    expect(modalDeleteBtn).not.toBeDisabled();

    // Confirm deletion
    await act(async () => {
      fireEvent.click(modalDeleteBtn);
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_delete_deck', { p_deck_id: 'deck-del-1' });
    expect(screen.queryByText('Delete Me Deck')).not.toBeInTheDocument();
  });

  it('PRG-001..PRG-006: Navigates to learning progress dashboard from top navbar and deck card', async () => {
    const deck1 = createDeck({ id: 'deck-1', name: 'Pharmacology' });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'student@example.com' }
        }
      },
      error: null
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [deck1], error: null })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    // Check navbar progress button
    const progressNavBtn = screen.getByRole('button', { name: /view learning progress dashboard/i });
    await act(async () => {
      fireEvent.click(progressNavBtn);
    });

    expect(await screen.findByRole('region', { name: /learning progress dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/learning progress & mastery/i)).toBeInTheDocument();

    // Back to decks
    const backBtn = screen.getByRole('button', { name: /back to decks/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(await screen.findByText('Pharmacology')).toBeInTheDocument();

    // Check deck card progress button
    const deckProgressBtn = screen.getByLabelText('View progress for Pharmacology');
    await act(async () => {
      fireEvent.click(deckProgressBtn);
    });

    expect(await screen.findByRole('region', { name: /learning progress dashboard/i })).toBeInTheDocument();
  });

  it('AUT-001, DEL-002: Opens and navigates user manual from unauthenticated sign-in screen', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    const manualBtn = screen.getByRole('button', { name: /open user manual/i });
    expect(manualBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(manualBtn);
    });

    // Check manual view is displayed
    expect(await screen.findByRole('region', { name: /user manual/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Adaptive Flashcards — User Manual' })).toBeInTheDocument();

    // Navigate back to sign in
    const backBtn = screen.getByRole('button', { name: /back to application/i });
    await act(async () => {
      fireEvent.click(backBtn);
    });

    expect(await screen.findByText('Adaptive Flashcards')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
  });

  it('UI-001, DEL-002: Opens user manual from top navbar, performs topic search, and returns to decks view', async () => {
    const deck1 = createDeck({ id: 'deck-1', name: 'Biochemistry' });
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'student@example.com' }
        }
      },
      error: null
    } as any);

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [deck1], error: null })),
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <App />
        </AuthProvider>
      );
    });

    // Top navbar manual button
    const navManualBtn = screen.getByRole('button', { name: /open user manual/i });
    expect(navManualBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(navManualBtn);
    });

    expect(await screen.findByRole('region', { name: /user manual/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Adaptive Flashcards — User Manual' })).toBeInTheDocument();

    // Test search functionality
    const searchInput = screen.getByLabelText(/search user manual/i);
    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'password' } });
    });

    // Search query matches
    expect(screen.getAllByText(/password/i).length).toBeGreaterThan(0);

    // Click "Done" / Back button
    const doneBtn = screen.getByRole('button', { name: /^done$/i });
    await act(async () => {
      fireEvent.click(doneBtn);
    });

    // Returned to decks view
    expect(await screen.findByText('Biochemistry')).toBeInTheDocument();
  });
});

