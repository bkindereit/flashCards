/**
 * Accessible CSV Import & Preview Modal
 * Implements IMP-001..IMP-016
 */

import React, { useState } from 'react';
import { Upload, FileText, AlertCircle, Download, X } from 'lucide-react';
import { parseAndPreviewCsv, CsvPreviewResult, ColumnMapping } from '@/domain/csvParser';
import { supabase } from '@/lib/supabase';

interface CsvImportModalProps {
  isOpen: boolean;
  deckId: string;
  onClose: () => void;
  onImportSuccess: (counts: { inserted: number; skipped: number; rejected: number }) => void;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  deckId,
  onClose,
  onImportSuccess
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>('');
  const [preview, setPreview] = useState<CsvPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    questionColumnIndex: 0,
    answerColumnIndex: 1
  });

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    setError(null);

    try {
      const text = await selected.text();
      setCsvContent(text);
      const res = await parseAndPreviewCsv(text);
      setPreview(res);
      if (res.requiresMapping && res.detectedHeaders.length >= 2) {
        setColumnMapping({
          questionColumnIndex: 0,
          answerColumnIndex: 1
        });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to read CSV');
      setPreview(null);
    }
  };

  const handleApplyMapping = async () => {
    if (!csvContent) return;
    try {
      const res = await parseAndPreviewCsv(csvContent, columnMapping);
      setPreview(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Mapping validation error');
    }
  };

  const handleCommit = async () => {
    if (!preview || preview.validRows.length === 0) return;

    setIsCommitting(true);
    setError(null);

    const operationId = crypto.randomUUID();
    const payload = preview.validRows.map((r, idx) => ({
      source_row_number: r.sourceRowNumber,
      question_text: r.question,
      answer_text: r.answer,
      normalized_question: r.normalizedQuestion,
      normalized_answer: r.normalizedAnswer,
      content_hash: r.contentHash,
      cohort_number: Math.floor(idx / 10) + 1,
      source_order: idx + 1
    }));

    try {
      const { data, error: rpcError } = await supabase.rpc('rpc_commit_import', {
        p_operation_id: operationId,
        p_deck_id: deckId,
        p_file_name: file?.name ?? 'upload.csv',
        p_total_rows: preview.totalRows,
        p_cards: payload
      });

      if (rpcError) throw rpcError;

      setIsCommitting(false);
      onImportSuccess({
        inserted: data.inserted_count,
        skipped: data.skipped_duplicate_count + preview.inFileInputDuplicates,
        rejected: preview.rejectedRows.length
      });
      onClose();
    } catch (err: unknown) {
      setIsCommitting(false);
      setError(err instanceof Error ? err.message : 'Database error committing import');
    }
  };

  const downloadRejectedRows = () => {
    if (!preview || preview.rejectedRows.length === 0) return;

    const headers = ['source_row_number', 'reason', 'raw_row'];
    const rows = preview.rejectedRows.map(r => [
      r.sourceRowNumber,
      `"${r.reason.replace(/"/g, '""')}"`,
      `"${r.rawRow.join(',').replace(/"/g, '""')}"`
    ]);

    const csvOutput = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rejected_rows_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
    >
      <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl max-w-3xl w-full p-6 text-slate-100 my-8">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Upload className="w-6 h-6 text-blue-400" />
            <h2 id="import-modal-title" className="text-xl font-bold">Import CSV Flashcards</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
            aria-label="Close import dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* File upload area */}
        <div className="my-6">
          <label className="block p-6 border-2 border-dashed border-slate-600 hover:border-blue-400 rounded-xl cursor-pointer bg-slate-900/40 text-center transition-colors">
            <FileText className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <span className="text-sm font-medium text-slate-200 block mb-1">
              {file ? file.name : 'Choose a UTF-8 .csv file'}
            </span>
            <span className="text-xs text-slate-400 block">
              Supports RFC 4180 quotes, multiline cards, and automatic duplicate detection
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {error && (
          <div role="alert" className="p-4 bg-red-950/80 border border-red-600 rounded-xl flex items-center gap-3 text-red-200 mb-6">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Column mapping when exact headers absent (IMP-003) */}
        {preview?.requiresMapping && (
          <div className="p-4 bg-slate-900 rounded-xl border border-amber-600/50 mb-6">
            <h3 className="text-sm font-bold text-amber-300 mb-2">Column Mapping Required</h3>
            <p className="text-xs text-slate-400 mb-4">
              Headers &apos;question&apos; and &apos;answer&apos; were not found. Select which columns to use:
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Question Column</label>
                <select
                  value={columnMapping.questionColumnIndex}
                  onChange={e => setColumnMapping(prev => ({ ...prev, questionColumnIndex: parseInt(e.target.value, 10) }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                >
                  {preview.detectedHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>{header || `Column ${idx + 1}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Answer Column</label>
                <select
                  value={columnMapping.answerColumnIndex}
                  onChange={e => setColumnMapping(prev => ({ ...prev, answerColumnIndex: parseInt(e.target.value, 10) }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white"
                >
                  {preview.detectedHeaders.map((header, idx) => (
                    <option key={idx} value={idx}>{header || `Column ${idx + 1}`}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleApplyMapping}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg"
            >
              Apply Mapping
            </button>
          </div>
        )}

        {/* Preview Summary (IMP-007) */}
        {preview && !preview.requiresMapping && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-slate-900 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">Total Data Rows</span>
                <span className="text-lg font-bold text-slate-200">{preview.totalRows}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">Valid Inserts</span>
                <span className="text-lg font-bold text-green-400">{preview.potentialInserts}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">File Duplicates</span>
                <span className="text-lg font-bold text-amber-400">{preview.inFileInputDuplicates}</span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-center">
                <span className="text-xs text-slate-400 block">Rejected</span>
                <span className="text-lg font-bold text-red-400">{preview.rejectedRows.length}</span>
              </div>
            </div>

            {/* Rejection download (IMP-015) */}
            {preview.rejectedRows.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-red-950/40 border border-red-800 rounded-lg text-sm">
                <span className="text-red-300">
                  {preview.rejectedRows.length} rows will be skipped due to empty fields or formatting issues.
                </span>
                <button
                  onClick={downloadRejectedRows}
                  className="flex items-center gap-1.5 px-3 py-1 bg-red-800 hover:bg-red-700 text-white rounded text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" /> Download Rejected Rows
                </button>
              </div>
            )}

            {/* First 20 rows table (IMP-007) */}
            <div>
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                Preview First {preview.first20Rows.length} Parsed Rows
              </h3>
              <div className="max-h-60 overflow-y-auto border border-slate-700 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 sticky top-0 border-b border-slate-700">
                    <tr>
                      <th className="p-2.5 text-slate-400 font-semibold w-12">#</th>
                      <th className="p-2.5 text-slate-400 font-semibold w-1/2">Question</th>
                      <th className="p-2.5 text-slate-400 font-semibold w-1/2">Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/60 font-mono">
                    {preview.first20Rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-750">
                        <td className="p-2.5 text-slate-500">{row.sourceRowNumber}</td>
                        <td className="p-2.5 text-slate-200 truncate max-w-xs">{row.normalizedQuestion}</td>
                        <td className="p-2.5 text-slate-300 truncate max-w-xs">{row.normalizedAnswer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Action footer */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-slate-700 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium rounded-lg focus:ring-2 focus:ring-slate-400 focus:outline-none"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCommit}
            disabled={!preview || preview.validRows.length === 0 || isCommitting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-md focus:ring-2 focus:ring-blue-400 focus:outline-none"
          >
            {isCommitting ? 'Importing...' : 'Commit Import'}
          </button>
        </div>
      </div>
    </div>
  );
};
