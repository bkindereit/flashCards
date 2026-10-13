import { describe, it, expect } from 'vitest';
import { parseAndPreviewCsv, parseRfc4180Csv, detectDelimiter } from '@/domain/csvParser';

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

  it('Rejects rows that have fewer columns than mapped', async () => {
    const csv = `question,answer,notes\nQ1,A1,N1\nOnlyOneColumn`;
    const preview = await parseAndPreviewCsv(csv, {
      questionColumnIndex: 0,
      answerColumnIndex: 1
    });
    expect(preview.validRows).toHaveLength(1);
    expect(preview.rejectedRows).toHaveLength(1);
    expect(preview.rejectedRows[0]?.reason).toContain('Row contains 1 columns, but expected at least 2');
  });

  it('Identifies whether question, answer, or both are blank', async () => {
    const csv = `question,answer\nQ1,\n,A2\n,\nQ3,A3`;
    const preview = await parseAndPreviewCsv(csv);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.rejectedRows).toHaveLength(3);
    expect(preview.rejectedRows[0]?.reason).toBe('Normalized answer is blank');
    expect(preview.rejectedRows[1]?.reason).toBe('Normalized question is blank');
    expect(preview.rejectedRows[2]?.reason).toBe('Both normalized question and answer are blank');
  });

  it('IMP-017: detectDelimiter correctly identifies comma, semicolon, tab, and pipe', () => {
    expect(detectDelimiter('question,answer\nQ,A')).toBe(',');
    expect(detectDelimiter('question;answer\nQ;A')).toBe(';');
    expect(detectDelimiter('question\tanswer\nQ\tA')).toBe('\t');
    expect(detectDelimiter('question|answer\nQ|A')).toBe('|');
    // Ignores delimiters inside quotes on the first line
    expect(detectDelimiter('"question;1";"answer;2"\nQ;A')).toBe(';');
  });

  it('IMP-017: Parses semicolon-delimited CSVs automatically and with explicit options', async () => {
    const csv = `question;answer
Was ist 2+2?;4
Was ist die Hauptstadt von Deutschland?;Berlin`;

    // Auto-detects semicolon
    const autoPreview = await parseAndPreviewCsv(csv);
    expect(autoPreview.detectedDelimiter).toBe(';');
    expect(autoPreview.validRows).toHaveLength(2);
    expect(autoPreview.validRows[0]?.normalizedQuestion).toBe('Was ist 2+2?');
    expect(autoPreview.validRows[0]?.normalizedAnswer).toBe('4');
    expect(autoPreview.validRows[1]?.normalizedQuestion).toBe('Was ist die Hauptstadt von Deutschland?');
    expect(autoPreview.validRows[1]?.normalizedAnswer).toBe('Berlin');

    // Explicit options
    const explicitPreview = await parseAndPreviewCsv(csv, { delimiter: ';' });
    expect(explicitPreview.validRows).toHaveLength(2);
  });
});
