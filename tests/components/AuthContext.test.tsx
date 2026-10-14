/**
 * Auth Context Component Tests
 * Implements AUT-001..AUT-006
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn()
    }
  }
}));

const TestConsumer: React.FC = () => {
  const { user, isLoading, signInWithOtp, verifyOtp, signInWithPassword, signOut } = useAuth();
  if (isLoading) return <div>Loading...</div>;
  if (!user) return (
    <div>
      <span>Signed Out</span>
      <button onClick={() => signInWithOtp('test@example.com')}>Sign In</button>
      <button onClick={() => verifyOtp('test@example.com', '123456')}>Verify OTP</button>
      <button onClick={() => signInWithPassword('test@example.com', 'secret123')}>Sign In With Password</button>
    </div>
  );
  return (
    <div>
      <span>User: {user.email}</span>
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
};

describe('AuthContext (AUT-001..AUT-006)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    } as any);
  });

  it('AUT-002: Starts in signed-out state when no session exists', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByText('Signed Out')).toBeInTheDocument();
  });

  it('AUT-006: Restores session when existing session is found', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'learner@example.com' }
        }
      },
      error: null
    } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    expect(screen.getByText('User: learner@example.com')).toBeInTheDocument();
  });

  it('AUT-001: signInWithOtp calls supabase auth with email', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.mocked(supabase.auth.signInWithOtp).mockResolvedValue({ data: {}, error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const btn = screen.getByText('Sign In');
    await act(async () => {
      btn.click();
    });

    expect(supabase.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { emailRedirectTo: window.location.origin }
    });
  });

  it('AUT-001: verifyOtp calls supabase.auth.verifyOtp with email and token', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.mocked(supabase.auth.verifyOtp).mockResolvedValue({ data: { user: null, session: null }, error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const btn = screen.getByText('Verify OTP');
    await act(async () => {
      btn.click();
    });

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      token: '123456',
      type: 'email'
    });
  });

  it('AUT-001: signInWithPassword calls supabase.auth.signInWithPassword with email and password', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as any);
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({ data: { user: null, session: null }, error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const btn = screen.getByText('Sign In With Password');
    await act(async () => {
      btn.click();
    });

    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'secret123'
    });
  });

  it('AUT-005: signOut calls supabase.auth.signOut', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          user: { id: 'u1', email: 'learner@example.com' }
        }
      },
      error: null
    } as any);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as any);

    await act(async () => {
      render(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
    });

    const btn = screen.getByText('Sign Out');
    await act(async () => {
      btn.click();
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
  });
});
