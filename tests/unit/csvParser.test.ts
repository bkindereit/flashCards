import { describe, it, expect } from 'vitest';
import { parseAndPreviewCsv, parseRfc4180Csv } from '@/domain/csvParser';

describe('CSV Parsing & Preview (IMP-001..IMP-012)', () => {
  it('CSV-001: Rejects empty CSV', async () => {
    await expect(parseAndPreviewCsv('')).rejects.toThrow('CSV input is empty');
  });

  it('CSV-002: Header only returns zero data rows', async () => {
    const csv = 'question,answer';
    const preview = await parseAndPreviewCsv(csv);
    expect(preview.totalRows).toBe(0);
    expect(preview.validRows).toHaveLength(0);
    expect(preview.rejectedRows).toHaveLength(0);
  });

  it('CSV-003: Parses valid unique rows with exact counts', async () => {
    const csv = `question,answer
What is 2+2?,4
What is the capital of Japan?,Tokyo
Who wrote Hamlet?,Shakespeare`;

    const preview = await parseAndPreviewCsv(csv);
    expect(preview.totalRows).toBe(3);
    expect(preview.validRows).toHaveLength(3);
    expect(preview.rejectedRows).toHaveLength(0);
    expect(preview.first20Rows).toHaveLength(3);
    expect(preview.validRows[0]?.normalizedQuestion).toBe('What is 2+2?');
    expect(preview.validRows[0]?.normalizedAnswer).toBe('4');
  });

  it('CSV-004: Recognizes reversed exact headers (answer, question)', async () => {
    const csv = `answer,question
Paris,Capital of France?
Berlin,Capital of Germany?`;

    const preview = await parseAndPreviewCsv(csv);
    expect(preview.hasExactHeaders).toBe(true);
    expect(preview.validRows).toHaveLength(2);
    expect(preview.validRows[0]?.normalizedQuestion).toBe('Capital of France?');
    expect(preview.validRows[0]?.normalizedAnswer).toBe('Paris');
  });

  it('CSV-005 & CSV-006: Parses RFC 4180 quotes, escaped quotes, and embedded line breaks', async () => {
    const csv = `question,answer
"Quotes, commas, and ""escaped"" quotes","Here is line 1\nand line 2"`;

    const preview = await parseAndPreviewCsv(csv);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.validRows[0]?.normalizedQuestion).toBe('Quotes, commas, and "escaped" quotes');
    expect(preview.validRows[0]?.normalizedAnswer).toBe('Here is line 1\nand line 2');
  });

  it('CSV-009: Rejects blank questions or answers with row number and reason', async () => {
    const csv = `question,answer
Valid Q,Valid A
   ,Blank Q
Blank A,   
   ,   `;

    const preview = await parseAndPreviewCsv(csv);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.rejectedRows).toHaveLength(3);
    expect(preview.rejectedRows[0]?.sourceRowNumber).toBe(3);
    expect(preview.rejectedRows[0]?.reason).toContain('Normalized question is blank');
    expect(preview.rejectedRows[1]?.sourceRowNumber).toBe(4);
    expect(preview.rejectedRows[1]?.reason).toContain('Normalized answer is blank');
    expect(preview.rejectedRows[2]?.sourceRowNumber).toBe(5);
    expect(preview.rejectedRows[2]?.reason).toContain('Both normalized question and answer are blank');
  });

  it('CSV-010: Rejects structurally malformed CSV (unterminated quote)', async () => {
    const csv = `question,answer\n"Unterminated quote,test`;
    await expect(parseAndPreviewCsv(csv)).rejects.toThrow(/CSV structure error/);
  });

  it('CSV-011: Detects in-file duplicates and counts them properly', async () => {
    const csv = `question,answer
Duplicate Question,Same Answer
Unique Question,Different Answer
Duplicate Question,Same Answer`;

    const preview = await parseAndPreviewCsv(csv);
    expect(preview.validRows).toHaveLength(2);
    expect(preview.inFileInputDuplicates).toBe(1);
    expect(preview.potentialInserts).toBe(2);
  });

  it('Handles custom column mapping when exact headers absent', async () => {
    const csv = `front,back,notes
Hello,Bonjour,greeting
Goodbye,Au revoir,farewell`;

    // Without mapping, requiresMapping is true
    const unmapped = await parseAndPreviewCsv(csv);
    expect(unmapped.requiresMapping).toBe(true);
    expect(unmapped.detectedHeaders).toEqual(['front', 'back', 'notes']);

    // With mapping: col 0 -> question, col 1 -> answer
    const mapped = await parseAndPreviewCsv(csv, {
      questionColumnIndex: 0,
      answerColumnIndex: 1
    });
    expect(mapped.requiresMapping).toBe(false);
    expect(mapped.validRows).toHaveLength(2);
    expect(mapped.validRows[0]?.normalizedQuestion).toBe('Hello');
    expect(mapped.validRows[0]?.normalizedAnswer).toBe('Bonjour');
  });

  it('Parses RFC 4180 lines with escaped quotes and commas', () => {
    const raw = 'a,"b,c","d ""e"" f"\r\n1,2,3';
    const grid = parseRfc4180Csv(raw);
    expect(grid).toEqual([
      ['a', 'b,c', 'd "e" f'],
      ['1', '2', '3']
    ]);
  });
});
