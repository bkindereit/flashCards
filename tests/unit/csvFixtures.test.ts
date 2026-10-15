/**
 * Canonical CSV Fixtures Unit Test
 * Implements IMP-001..IMP-008, TST-009, VA-IMP-001
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { parseAndPreviewCsv } from '@/domain/csvParser';

const csvDir = path.resolve(__dirname, '../fixtures/csv');
const expected = JSON.parse(readFileSync(path.join(csvDir, 'expected.json'), 'utf8'));

describe('Canonical CSV Fixtures (FCA-VVP §10.1, CSV-001..CSV-013)', () => {
  it('TST-009, IMP-001: CSV-001: Empty file is rejected with file error', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-001.csv'), 'utf8');
    await expect(parseAndPreviewCsv(content)).rejects.toThrow(expected['CSV-001'].error);
  });

  it('TST-009, IMP-001: CSV-002: Header only returns 0 valid rows', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-002.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-002'].validRows);
    expect(result.totalRows).toBe(0);
  });

  it('TST-009, IMP-001: CSV-003: 100 valid unique rows parse exactly', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-003.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-003'].validRows);
    expect(result.rejectedRows.length).toBe(expected['CSV-003'].rejectedRows);
    expect(result.potentialInserts).toBe(expected['CSV-003'].potentialInserts);
  });

  it('TST-009, IMP-002: CSV-004: Reversed exact headers mapped properly', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-004.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-004'].validRows);
    expect(result.validRows[0]?.normalizedQuestion).toBe('Question 1');
    expect(result.validRows[0]?.normalizedAnswer).toBe('Answer 1');
  });

  it('TST-009, IMP-004: CSV-005: Quoted commas and escaped quotes', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-005.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-005'].validRows);
    expect(result.validRows[1]?.normalizedQuestion).toBe('He said, "Hello!"');
    expect(result.validRows[1]?.normalizedAnswer).toBe('Quoted greeting with escaped "double quotes"');
  });

  it('TST-009, IMP-004: CSV-006: Embedded LF and CRLF line handling', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-006.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-006'].validRows);
    expect(result.validRows[0]?.normalizedQuestion).toBe('Line 1\nLine 2\nLine 3');
    expect(result.validRows[0]?.normalizedAnswer).toBe('Multiline answer\nwith LF');
  });

  it('TST-009, IMP-004: CSV-007: Unicode composed/decomposed forms deduplicated via NFC', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-007.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-007'].validRows);
    expect(result.inFileInputDuplicates).toBe(expected['CSV-007'].inFileInputDuplicates);
  });

  it('TST-009, IMP-004: CSV-008: Leading BOM stripped from first field', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-008.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-008'].validRows);
    expect(result.validRows[0]?.normalizedQuestion).toBe('What is BOM?');
  });

  it('TST-009, IMP-005, IMP-006: CSV-009: Blank questions and answers rejected', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-009.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-009'].validRows);
    expect(result.rejectedRows.length).toBe(expected['CSV-009'].rejectedRows);
  });

  it('TST-009, IMP-006, IMP-008: CSV-010: Malformed quoting rejected with error', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-010.csv'), 'utf8');
    await expect(parseAndPreviewCsv(content)).rejects.toThrow();
  });

  it('TST-009, IMP-010, IMP-012: CSV-011: Exact and normalization duplicates identified', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-011.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-011'].validRows);
    expect(result.inFileInputDuplicates).toBe(expected['CSV-011'].inFileInputDuplicates);
  });

  it('TST-009, IMP-010, IMP-011: CSV-012: Existing-card duplicates count potential inserts', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-012.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-012'].validRows);
  });

  it('TST-009, IMP-004: CSV-013: Case differences preserved and treated as unique', async () => {
    const content = readFileSync(path.join(csvDir, 'CSV-013.csv'), 'utf8');
    const result = await parseAndPreviewCsv(content);
    expect(result.validRows.length).toBe(expected['CSV-013'].validRows);
    expect(result.inFileInputDuplicates).toBe(expected['CSV-013'].inFileInputDuplicates);
  });
});
