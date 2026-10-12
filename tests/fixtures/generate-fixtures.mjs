#!/usr/bin/env node
/**
 * Canonical Fixture Generator
 * Generates CSV-001 through CSV-014 according to FCA-VVP §10.1
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvDir = path.join(__dirname, 'csv');
mkdirSync(csvDir, { recursive: true });

// CSV-001: Empty file
writeFileSync(path.join(csvDir, 'CSV-001.csv'), '');

// CSV-002: Header only
writeFileSync(path.join(csvDir, 'CSV-002.csv'), 'question,answer\n');

// CSV-003: 100 valid unique rows
let csv003 = 'question,answer\n';
for (let i = 1; i <= 100; i++) {
  csv003 += `Question ${i},Answer ${i}\n`;
}
writeFileSync(path.join(csvDir, 'CSV-003.csv'), csv003);

// CSV-004: Reversed exact headers
let csv004 = 'answer,question\n';
for (let i = 1; i <= 10; i++) {
  csv004 += `Answer ${i},Question ${i}\n`;
}
writeFileSync(path.join(csvDir, 'CSV-004.csv'), csv004);

// CSV-005: Quoted commas and quotes
const csv005 = `question,answer
"What is a comma, really?","A punctuation mark, used to separate elements"
"He said, ""Hello!""","Quoted greeting with escaped ""double quotes"""
"Field with, multiple, commas","Value, with, commas"
`;
writeFileSync(path.join(csvDir, 'CSV-005.csv'), csv005);

// CSV-006: Embedded LF and CRLF
const csv006 = `question,answer\r
"Line 1\r\nLine 2\r\nLine 3","Multiline answer\nwith LF"\r
"Another\nquestion","Another\r\nanswer"\r
`;
writeFileSync(path.join(csvDir, 'CSV-006.csv'), csv006);

// CSV-007: Unicode composed/decomposed forms (NFC duplicate behavior)
// Decomposed: e + combining acute accent (\u0065\u0301)
// Composed: \u00e9 (é)
const csv007 = `question,answer
"caf\u0065\u0301","coffee shop"
"caf\u00e9","coffee shop"
"na\u00efve","innocent"
"na\u0069\u0308ve","innocent"
`;
writeFileSync(path.join(csvDir, 'CSV-007.csv'), csv007);

// CSV-008: Leading BOM
const csv008 = `\uFEFFquestion,answer
"What is BOM?","Byte Order Mark"
"Is BOM stripped?","Yes from first field"
`;
writeFileSync(path.join(csvDir, 'CSV-008.csv'), csv008);

// CSV-009: Blank questions and answers (Row rejection)
const csv009 = `question,answer
Valid Question,Valid Answer
,Missing Question
Missing Answer,
   ,   
Valid Question 2,Valid Answer 2
`;
writeFileSync(path.join(csvDir, 'CSV-009.csv'), csv009);

// CSV-010: Malformed quoting (Structural rejection)
const csv010 = `question,answer
"Unclosed quote question,Valid Answer
Valid Question 2,Valid Answer 2
`;
writeFileSync(path.join(csvDir, 'CSV-010.csv'), csv010);

// CSV-011: Exact and normalization duplicates
const csv011 = `question,answer
Capital of France?,Paris
  Capital of   France?  ,  Paris  
Capital of Germany?,Berlin
Capital of France?,Paris
`;
writeFileSync(path.join(csvDir, 'CSV-011.csv'), csv011);

// CSV-012: Existing-card duplicates with history
const csv012 = `question,answer
Existing Card 1,Existing Answer 1
Existing Card 2,Existing Answer 2
Brand New Card,Brand New Answer
`;
writeFileSync(path.join(csvDir, 'CSV-012.csv'), csv012);

// CSV-013: Case-only content differences (Confirm case preservation)
const csv013 = `question,answer
what is python?,a programming language
What is Python?,A Programming Language
WHAT IS PYTHON?,A PROGRAMMING LANGUAGE
`;
writeFileSync(path.join(csvDir, 'CSV-013.csv'), csv013);

// CSV-014: 10,000 valid rows (Performance and cardinality)
let csv014 = 'question,answer\n';
for (let i = 1; i <= 10000; i++) {
  csv014 += `Benchmark Question ${i},Benchmark Answer ${i} with detailed explanation\n`;
}
writeFileSync(path.join(csvDir, 'CSV-014.csv'), csv014);

// Write expected.json with expected preview metrics
const expected = {
  'CSV-001': { error: 'CSV input is empty', validRows: 0, rejectedRows: 0 },
  'CSV-002': { validRows: 0, rejectedRows: 0, totalInputRows: 0 },
  'CSV-003': { validRows: 100, rejectedRows: 0, inFileInputDuplicates: 0, potentialInserts: 100 },
  'CSV-004': { validRows: 10, rejectedRows: 0, potentialInserts: 10 },
  'CSV-005': { validRows: 3, rejectedRows: 0, potentialInserts: 3 },
  'CSV-006': { validRows: 2, rejectedRows: 0, potentialInserts: 2 },
  'CSV-007': { validRows: 2, rejectedRows: 0, inFileInputDuplicates: 2, potentialInserts: 2 },
  'CSV-008': { validRows: 2, rejectedRows: 0, potentialInserts: 2 },
  'CSV-009': { validRows: 2, rejectedRows: 3, potentialInserts: 2 },
  'CSV-010': { error: 'Malformed CSV quote', validRows: 0 },
  'CSV-011': { validRows: 2, inFileInputDuplicates: 2, potentialInserts: 2 },
  'CSV-012': { validRows: 3, rejectedRows: 0, potentialInserts: 3 },
  'CSV-013': { validRows: 3, inFileInputDuplicates: 0, potentialInserts: 3 },
  'CSV-014': { validRows: 10000, rejectedRows: 0, inFileInputDuplicates: 0, potentialInserts: 10000 }
};

writeFileSync(path.join(csvDir, 'expected.json'), JSON.stringify(expected, null, 2));

console.log('Successfully generated CSV-001 through CSV-014 and expected.json in tests/fixtures/csv/');
