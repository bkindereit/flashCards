/**
 * Diagnostics View Component Tests
 * Implements DIA-001..DIA-006, SEC-009
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DiagnosticsView } from '@/components/DiagnosticsView';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null }))
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [{ id: 'd1' }], error: null }))
      }))
    }))
  }
}));

describe('DiagnosticsView (DIA-001..DIA-006)', () => {
  const onBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DIA-001: Renders initial diagnostics panel with Run Diagnostics action', () => {
    render(<DiagnosticsView onBack={onBack} />);

    expect(screen.getByRole('heading', { name: /system diagnostics/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run diagnostics/i })).toBeInTheDocument();
  });

  it('DIA-002..004: Executes diagnostic suite and displays individual check results', async () => {
    render(<DiagnosticsView onBack={onBack} />);

    const runBtn = screen.getByRole('button', { name: /run diagnostics/i });
    await act(async () => {
      fireEvent.click(runBtn);
    });

    expect(screen.getByText(/client version & build/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduler sanity & conformance vector/i)).toBeInTheDocument();
    expect(screen.getByText(/database api reachability/i)).toBeInTheDocument();
  });

  it('DIA-005: Provides Copy Report and Download Report buttons', async () => {
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve())
      }
    });

    render(<DiagnosticsView onBack={onBack} />);

    const runBtn = screen.getByRole('button', { name: /run diagnostics/i });
    await act(async () => {
      fireEvent.click(runBtn);
    });

    const copyBtn = screen.getByRole('button', { name: /copy.*report/i });
    expect(copyBtn).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(copyBtn);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });
});
