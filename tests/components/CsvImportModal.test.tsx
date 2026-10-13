/**
 * CSV Import Modal Component Tests
 * Implements IMP-001..IMP-016
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { CsvImportModal } from '@/components/CsvImportModal';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

describe('CsvImportModal Component (IMP-001..IMP-016)', () => {
  const onClose = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { inserted: 2, skipped: 0, rejected: 0 },
      error: null
    } as any);
  });

  it('IMP-001: Renders file upload dropzone when opened', () => {
    render(
      <CsvImportModal
        isOpen={true}
        deckId="deck-1"
        onClose={onClose}
        onImportSuccess={onSuccess}
      />
    );

    expect(screen.getByRole('heading', { name: /import csv flashcards/i })).toBeInTheDocument();
    expect(screen.getByText(/choose a utf-8 \.csv file/i)).toBeInTheDocument();
  });

  it('IMP-003, IMP-007: Parses CSV and displays preview with counts and first rows', async () => {
    render(
      <CsvImportModal
        isOpen={true}
        deckId="deck-1"
        onClose={onClose}
        onImportSuccess={onSuccess}
      />
    );

    const csvContent = 'question,answer\nWhat is TypeScript?,Typed JavaScript\nWhat is React?,UI library';
    const file = new File([csvContent], 'cards.csv', { type: 'text/csv' });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText('Valid Inserts')).toBeInTheDocument();
    expect(screen.getByText('What is TypeScript?')).toBeInTheDocument();
    expect(screen.getByText('Typed JavaScript')).toBeInTheDocument();
  });

  it('IMP-009: Commits valid preview rows to database', async () => {
    render(
      <CsvImportModal
        isOpen={true}
        deckId="deck-1"
        onClose={onClose}
        onImportSuccess={onSuccess}
      />
    );

    const csvContent = 'question,answer\nQ1,A1\nQ2,A2';
    const file = new File([csvContent], 'cards.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText('Valid Inserts')).toBeInTheDocument();

    const commitBtn = screen.getByRole('button', { name: /commit import/i });
    expect(commitBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(commitBtn);
    });

    expect(supabase.rpc).toHaveBeenCalledWith('rpc_commit_import', expect.objectContaining({
      p_deck_id: 'deck-1'
    }));
    expect(onSuccess).toHaveBeenCalled();
  });

  it('IMP-003: Prompts for column mapping when exact headers question/answer are absent', async () => {
    render(
      <CsvImportModal
        isOpen={true}
        deckId="deck-1"
        onClose={onClose}
        onImportSuccess={onSuccess}
      />
    );

    const csvContent = 'prompt,solution\nWhat is ATP?,Energy currency';
    const file = new File([csvContent], 'custom_headers.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText('Column Mapping Required')).toBeInTheDocument();

    const applyBtn = screen.getByRole('button', { name: /apply mapping/i });
    await act(async () => {
      fireEvent.click(applyBtn);
    });

    expect(await screen.findByText('Valid Inserts')).toBeInTheDocument();
  });

  it('IMP-015: Displays rejected rows download action when blank cards exist', async () => {
    // Mock URL methods for download
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    });

    render(
      <CsvImportModal
        isOpen={true}
        deckId="deck-1"
        onClose={onClose}
        onImportSuccess={onSuccess}
      />
    );

    const csvContent = 'question,answer\nValid Q,Valid A\n,Blank Question';
    const file = new File([csvContent], 'with_rejected.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(await screen.findByText(/download rejected rows/i)).toBeInTheDocument();
    const downloadBtn = screen.getByRole('button', { name: /download rejected rows/i });

    await act(async () => {
      fireEvent.click(downloadBtn);
    });

    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('Renders null when isOpen is false', () => {
    const { container } = render(
      <CsvImportModal isOpen={false} deckId="d1" onClose={onClose} onImportSuccess={onSuccess} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('Supports delimiter selection and auto-detects semicolon-delimited CSVs', async () => {
    render(
      <CsvImportModal
        isOpen={true}
        deckId="deck-1"
        onClose={onClose}
        onImportSuccess={onSuccess}
      />
    );

    const delimSelect = screen.getByLabelText(/csv delimiter/i) as HTMLSelectElement;
    expect(delimSelect).toBeInTheDocument();
    expect(delimSelect.value).toBe(',');

    // Upload a semicolon CSV
    const csvContent = 'question;answer\nFrage 1;Antwort 1\nFrage 2;Antwort 2';
    const file = new File([csvContent], 'german.csv', { type: 'text/csv' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    // Wait for async parsing to finish
    expect(await screen.findByText('Frage 1')).toBeInTheDocument();
    expect(screen.getByText('Antwort 1')).toBeInTheDocument();

    // Delimiter should auto-switch to semicolon
    expect(delimSelect.value).toBe(';');

    // User can manually change delimiter
    await act(async () => {
      fireEvent.change(delimSelect, { target: { value: ',' } });
    });
    expect(delimSelect.value).toBe(',');
  });
});
