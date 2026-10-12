/**
 * RFC 4180 CSV Parser & Importer Domain Logic
 * Implements IMP-001..IMP-016
 */

import { canonicalNormalize, computeContentHash } from './normalization';

export interface ParsedCsvRow {
  sourceRowNumber: number;
  question: string;
  answer: string;
  normalizedQuestion: string;
  normalizedAnswer: string;
  contentHash: string;
}

export interface RejectedRow {
  sourceRowNumber: number;
  rawRow: string[];
  reason: string;
}

export interface CsvPreviewResult {
  totalRows: number;
  validRows: ParsedCsvRow[];
  first20Rows: ParsedCsvRow[];
  rejectedRows: RejectedRow[];
  totalParsed: number;
  potentialInserts: number;
  inFileInputDuplicates: number;
  detectedHeaders: string[];
  hasExactHeaders: boolean;
  requiresMapping: boolean;
}

/**
 * Robust RFC 4180 tokenizer that handles quotes, escaped quotes (""), and embedded linebreaks.
 */
export function parseRfc4180Csv(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let i = 0;
  const len = csvText.length;

  while (i < len) {
    const char = csvText[i];

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < len && csvText[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          i++;
          continue;
        }
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
        i++;
        continue;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < len && csvText[i + 1] === '\n') {
          i++; // skip \r of \r\n
        }
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Push last field and row if any content remains
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  if (insideQuotes) {
    throw new Error('Unterminated quoted field at end of CSV input');
  }

  return rows;
}

export interface ColumnMapping {
  questionColumnIndex: number;
  answerColumnIndex: number;
}

/**
 * Validates, normalizes, detects in-file duplicates and prepares CSV preview.
 */
export async function parseAndPreviewCsv(
  csvText: string,
  mappingOverride?: ColumnMapping
): Promise<CsvPreviewResult> {
  if (!csvText || csvText.trim() === '') {
    throw new Error('CSV input is empty');
  }

  let rawRows: string[][];
  try {
    rawRows = parseRfc4180Csv(csvText);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`CSV structure error: ${message}`);
  }

  const headerRow = rawRows[0] || [];
  // Normalize header names to check for 'question' and 'answer'
  const cleanHeaders = headerRow.map((h, idx) => canonicalNormalize(h, idx === 0).toLowerCase());

  let questionIdx = -1;
  let answerIdx = -1;

  if (mappingOverride) {
    questionIdx = mappingOverride.questionColumnIndex;
    answerIdx = mappingOverride.answerColumnIndex;
  } else {
    questionIdx = cleanHeaders.indexOf('question');
    answerIdx = cleanHeaders.indexOf('answer');
  }

  const hasExactHeaders = questionIdx !== -1 && answerIdx !== -1 && questionIdx !== answerIdx;
  const requiresMapping = !hasExactHeaders;

  if (requiresMapping && !mappingOverride) {
    return {
      totalRows: rawRows.length - 1,
      validRows: [],
      first20Rows: [],
      rejectedRows: [],
      totalParsed: 0,
      potentialInserts: 0,
      inFileInputDuplicates: 0,
      detectedHeaders: headerRow,
      hasExactHeaders: false,
      requiresMapping: true
    };
  }

  const validRows: ParsedCsvRow[] = [];
  const rejectedRows: RejectedRow[] = [];
  const seenHashesInFile = new Set<string>();
  let inFileInputDuplicates = 0;

  // Process data rows starting from row 1 (0-indexed, so row 2 in 1-indexed file)
  for (let r = 1; r < rawRows.length; r++) {
    const sourceRowNumber = r + 1; // 1-indexed line in CSV file
    const row = rawRows[r];
    if (!row) continue;

    // Check row structural integrity
    const maxNeededIdx = Math.max(questionIdx, answerIdx);
    if (row.length <= maxNeededIdx) {
      rejectedRows.push({
        sourceRowNumber,
        rawRow: row,
        reason: `Row contains ${row.length} columns, but expected at least ${maxNeededIdx + 1}`
      });
      continue;
    }

    const rawQ = row[questionIdx] ?? '';
    const rawA = row[answerIdx] ?? '';

    // Step 2-7 Canonical normalization
    const normQ = canonicalNormalize(rawQ, questionIdx === 0);
    const normA = canonicalNormalize(rawA, answerIdx === 0);

    // IMP-005: Reject blank normalized question or answer
    if (normQ === '' || normA === '') {
      rejectedRows.push({
        sourceRowNumber,
        rawRow: row,
        reason: normQ === '' && normA === '' 
          ? 'Both normalized question and answer are blank' 
          : normQ === '' 
            ? 'Normalized question is blank' 
            : 'Normalized answer is blank'
      });
      continue;
    }

    const hash = await computeContentHash(normQ, normA);

    // IMP-012: In-file duplicate check
    if (seenHashesInFile.has(hash)) {
      inFileInputDuplicates++;
      // Counts as skipped duplicate thereafter
      continue;
    }

    seenHashesInFile.add(hash);
    validRows.push({
      sourceRowNumber,
      question: rawQ,
      answer: rawA,
      normalizedQuestion: normQ,
      normalizedAnswer: normA,
      contentHash: hash
    });
  }

  return {
    totalRows: rawRows.length - 1,
    validRows,
    first20Rows: validRows.slice(0, 20),
    rejectedRows,
    totalParsed: validRows.length + rejectedRows.length + inFileInputDuplicates,
    potentialInserts: validRows.length,
    inFileInputDuplicates,
    detectedHeaders: headerRow,
    hasExactHeaders: true,
    requiresMapping: false
  };
}
