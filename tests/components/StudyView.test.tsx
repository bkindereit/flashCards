/**
 * StudyView Accessible Interface Tests
 * Implements UI-001..UI-016, ACC-001..ACC-007
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { StudyView } from '@/components/StudyView';
import { createDeck, createCard } from '@/testing/factories';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    }))
  }
}));

describe('StudyView Component (UI-001..UI-016, ACC-002)', () => {
  const deck = createDeck();
  const card1 = createCard({
    deck_id: deck.id,
    question_text: 'What is the capital of Japan?',
    answer_text: 'Tokyo',
    learning_state: 'new'
  });
  const onFinish = vi.fn();
  const onExit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null } as any);
  });

  it('UI-001: Shows question and Reveal Answer button; answer is hidden initially', () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    expect(screen.getByText('What is the capital of Japan?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /give me the answer/i })).toBeInTheDocument();
    expect(screen.queryByText('Tokyo')).not.toBeInTheDocument();
  });

  it('UI-002, UI-003: Clicking Reveal reveals the answer and displays binary grade buttons', async () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    const revealBtn = screen.getByRole('button', { name: /give me the answer/i });
    fireEvent.click(revealBtn);

    expect(screen.getByText('Tokyo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i got it!/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dang, i missed it!/i })).toBeInTheDocument();
  });

  it('UI-011..013: Keyboard Space reveals answer, and 1 grades I got it!', async () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    // Press Space to reveal
    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText('Tokyo')).toBeInTheDocument();

    // Press '1' to grade 'I got it!'
    await act(async () => {
      fireEvent.keyDown(window, { key: '1' });
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_submit_grade', expect.objectContaining({
      p_result: 'correct'
    }));
  });

  it('UI-011..013: Keyboard 2 grades Dang, I missed it!', async () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByText('Tokyo')).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(window, { key: '2' });
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_submit_grade', expect.objectContaining({
      p_result: 'incorrect'
    }));
  });

  it('UI-014: Pause and Resume toggle pauses timer and shows banner', () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    const pauseBtn = screen.getByRole('button', { name: /pause study session/i });
    fireEvent.click(pauseBtn);

    expect(screen.getByText(/session paused/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /resume study/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('UI-007: Undo button triggers undo grade RPC', async () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /give me the answer/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /i got it!/i }));
    });

    const undoBtn = screen.getByRole('button', { name: /undo last grade/i });
    expect(undoBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(undoBtn);
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_undo_grade', expect.anything());
  });

  it('SES-006: End Early button finishes session and calls onFinish', () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    const endBtn = screen.getByRole('button', { name: /end session early/i });
    fireEvent.click(endBtn);

    expect(onFinish).toHaveBeenCalled();
  });

  it('UI-009: Renders recoverable error banner with Retry button when RPC fails', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'Network connection timeout' }
    } as any);

    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /give me the answer/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /i got it!/i }));
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/network error/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { card_id: card1.id },
      error: null
    } as any);

    await act(async () => {
      fireEvent.click(retryBtn);
    });

    expect(supabase.rpc).toHaveBeenCalled();
  });

  it('UI-015: Resume study button in paused overlay resumes study state', () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    const pauseBtn = screen.getByRole('button', { name: /pause study session/i });
    fireEvent.click(pauseBtn);

    const resumeBtns = screen.getAllByRole('button', { name: /resume study/i });
    fireEvent.click(resumeBtns[0]!);

    expect(screen.queryByText(/session paused/i)).not.toBeInTheDocument();
    expect(screen.getByText('What is the capital of Japan?')).toBeInTheDocument();
  });

  it('UI-002: Space key reveals card answer', () => {
    render(
      <StudyView
        deck={deck}
        cards={[card1]}
        durationMinutes={15}
        onFinish={onFinish}
        onExit={onExit}
      />
    );

    fireEvent.keyDown(window, { key: ' ' });
    expect(screen.getByText('Tokyo')).toBeInTheDocument();
  });
});
