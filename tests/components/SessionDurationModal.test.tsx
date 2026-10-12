/**
 * SessionDurationModal Component Tests
 * Implements SES-001, SES-002
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionDurationModal } from '@/components/SessionDurationModal';

describe('SessionDurationModal (SES-001, SES-002)', () => {
  const onClose = vi.fn();
  const onStart = vi.fn();

  it('SES-001: Renders presets (5, 10, 15, 20, 30m) with 15m default', () => {
    render(
      <SessionDurationModal
        isOpen={true}
        onClose={onClose}
        onStartSession={onStart}
      />
    );

    expect(screen.getByRole('heading', { name: /select session duration/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '10m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '15m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '20m' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30m' })).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /start session/i });
    fireEvent.click(startBtn);

    expect(onStart).toHaveBeenCalledWith(15);
  });

  it('SES-002: Allows custom duration between 1 and 240 minutes', () => {
    render(
      <SessionDurationModal
        isOpen={true}
        onClose={onClose}
        onStartSession={onStart}
      />
    );

    const customRadio = screen.getByLabelText(/custom duration/i);
    fireEvent.click(customRadio);

    const input = screen.getByLabelText(/custom duration in minutes/i);
    fireEvent.change(input, { target: { value: '45' } });

    const startBtn = screen.getByRole('button', { name: /start session/i });
    fireEvent.click(startBtn);

    expect(onStart).toHaveBeenCalledWith(45);
  });

  it('SES-002: Validates out-of-range custom duration', () => {
    render(
      <SessionDurationModal
        isOpen={true}
        onClose={onClose}
        onStartSession={onStart}
      />
    );

    const customRadio = screen.getByLabelText(/custom duration/i);
    fireEvent.click(customRadio);

    const input = screen.getByLabelText(/custom duration in minutes/i);

    // Invalid (> 240)
    fireEvent.change(input, { target: { value: '300' } });
    fireEvent.click(screen.getByRole('button', { name: /start session/i }));

    expect(screen.getByText(/whole number of minutes between 1 and 240/i)).toBeInTheDocument();
  });
});
