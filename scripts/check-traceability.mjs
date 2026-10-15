#!/usr/bin/env node
/**
 * Bidirectional Requirements Traceability Checker (TST-016, TST-017, TST-018)
 * 
 * Verifies:
 * - Every Must requirement has: verification_method, activity_ids, automated_test_ids, evidence_paths, result
 * - No duplicate requirement IDs
 * - No duplicate test IDs
 * - Tests referencing nonexistent requirement IDs are flagged
 * - Bidirectional linkage is complete
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let matrixPath = path.join(__dirname, '../docs/traceability_matrix.json');
let srsPath = path.join(__dirname, '../Instructions/flashcard-srs.md');

for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--matrix' && process.argv[i + 1]) {
    matrixPath = path.resolve(process.argv[++i]);
  } else if (process.argv[i] === '--srs' && process.argv[i + 1]) {
    srsPath = path.resolve(process.argv[++i]);
  }
}

let exitCode = 0;
const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
  exitCode = 1;
}

function warn(msg) {
  warnings.push(msg);
}

// Load matrix
let matrix;
try {
  matrix = JSON.parse(readFileSync(matrixPath, 'utf8'));
} catch (e) {
  fail(`Cannot read traceability matrix at ${matrixPath}: ${e.message}`);
  process.exit(1);
}

const requirements = matrix.requirements || [];
const testIndex = matrix.test_index || {};

// ── TST-018: Check duplicate requirement IDs ────────────────────────────────
const reqIds = requirements.map(r => r.requirement_id);
const seenReqIds = new Set();
for (const id of reqIds) {
  if (seenReqIds.has(id)) {
    fail(`TST-018: Duplicate requirement_id: "${id}"`);
  }
  seenReqIds.add(id);
}

// ── TST-018: Check duplicate test IDs ───────────────────────────────────────
const allTestIds = [];
for (const req of requirements) {
  for (const tid of req.automated_test_ids || []) {
    allTestIds.push({ tid, reqId: req.requirement_id });
  }
}
const seenTestIds = new Set();
for (const { tid } of allTestIds) {
  if (seenTestIds.has(tid)) {
    fail(`TST-018: Duplicate test_id: "${tid}"`);
  }
  seenTestIds.add(tid);
}

// ── TST-017: Every Must requirement must have complete verification fields ───
for (const req of requirements) {
  if (req.priority !== 'Must') continue;

  const id = req.requirement_id;

  if (!req.verification_methods || req.verification_methods.length === 0) {
    fail(`TST-017: Must requirement "${id}" has no verification_methods`);
  }

  if (!req.activity_ids || req.activity_ids.length === 0) {
    fail(`TST-017: Must requirement "${id}" has no activity_ids`);
  }

  if (!req.automated_test_ids || req.automated_test_ids.length === 0) {
    fail(`TST-017: Must requirement "${id}" has no automated_test_ids`);
  }

  if (!req.evidence_paths || req.evidence_paths.length === 0) {
    fail(`TST-017: Must requirement "${id}" has no evidence_paths`);
  }

  if (!req.result) {
    fail(`TST-017: Must requirement "${id}" has no result field`);
  }

  const validResults = ['Pass', 'Fail', 'Blocked', 'Waived', 'Not Run'];
  if (req.result && !validResults.includes(req.result)) {
    fail(`TST-017: Must requirement "${id}" has invalid result "${req.result}" (must be one of: ${validResults.join(', ')})`);
  }
}

// ── TST-018: Tests referencing nonexistent requirement IDs ──────────────────
// The test_index maps test_id -> requirement_id list
for (const [testId, reqIdList] of Object.entries(testIndex)) {
  for (const reqId of reqIdList) {
    if (!seenReqIds.has(reqId)) {
      fail(`TST-018: Test "${testId}" references nonexistent requirement_id "${reqId}"`);
    }
  }
}

// ── TST-017: Every Must requirement in the authoritative SRS must be in the matrix ──
try {
  const srs = readFileSync(srsPath, 'utf8');
  const srsReqs = new Map();
  for (const m of srs.matchAll(/^\| ([A-Z]{2,3}-\d{3}) \| (Must|Should) \|/gm)) {
    srsReqs.set(m[1], m[2]);
  }
  for (const [id, prio] of srsReqs) {
    if (prio === 'Must' && !seenReqIds.has(id)) {
      fail(`TST-017: Must requirement "${id}" from FCA-SRS-001 is missing from the matrix`);
    }
  }
  for (const req of requirements) {
    const srsPrio = srsReqs.get(req.requirement_id);
    if (!srsPrio) {
      fail(`TST-018: Matrix requirement "${req.requirement_id}" does not exist in FCA-SRS-001`);
    } else if (srsPrio !== req.priority) {
      fail(`Requirement "${req.requirement_id}" priority "${req.priority}" differs from SRS "${srsPrio}"`);
    }
  }
} catch (e) {
  fail(`Cannot read authoritative SRS at ${srsPath}: ${e.message}`);
}

// ── Evidence integrity: a Pass result must point at evidence that exists ─────
const repoRoot = path.join(__dirname, '..');
for (const req of requirements) {
  if (req.result !== 'Pass') continue;
  for (const ev of req.evidence_paths || []) {
    if (/^https?:\/\//.test(ev)) continue;
    const candidate = path.join(repoRoot, ev.replace(/\*.*$/, ''));
    if (!existsSync(candidate)) {
      fail(`Evidence: "${req.requirement_id}" is marked Pass but evidence "${ev}" does not exist`);
    }
  }
}

// ── Bidirectional check: all activity_ids appear in both directions ──────────
const validActivityIds = new Set([
  'VA-ARC-001', 'VA-ARC-002', 'VA-TST-001', 'VA-COV-001',
  'VA-AUT-001', 'VA-AUT-002', 'VA-AUT-003',
  'VA-DEK-001', 'VA-DAT-001', 'VA-DAT-002',
  'VA-IMP-001', 'VA-IMP-002', 'VA-IMP-003', 'VA-IMP-004',
  'VA-MGT-001', 'VA-MGT-002',
  'VA-UI-001', 'VA-UI-002', 'VA-SES-001',
  'VA-SCH-001', 'VA-SCH-002', 'VA-SCH-003', 'VA-SCH-004', 'VA-SCH-005', 'VA-SCH-006',
  'VA-REV-001', 'VA-REV-002', 'VA-REV-003', 'VA-REV-004',
  'VA-SEC-001', 'VA-SEC-002', 'VA-SEC-003', 'VA-SEC-004',
  'VA-ACC-001', 'VA-ACC-002', 'VA-ACC-003', 'VA-ACC-004', 'VA-ACC-005',
  'VA-PRF-001', 'VA-PRF-002', 'VA-PRF-003', 'VA-REL-001', 'VA-REL-002',
  'VA-DIA-001', 'VA-DIA-002',
  'VA-CIC-001', 'VA-CIC-002', 'VA-TRC-001',
  'VA-PRG-001', 'VA-PRG-002'
]);

for (const req of requirements) {
  for (const actId of req.activity_ids || []) {
    if (!validActivityIds.has(actId)) {
      warn(`Unknown activity_id "${actId}" in requirement "${req.requirement_id}"`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
const mustReqs = requirements.filter(r => r.priority === 'Must');
const passedMust = mustReqs.filter(r => r.result === 'Pass').length;
const failedMust = mustReqs.filter(r => r.result === 'Fail').length;
const blockedMust = mustReqs.filter(r => r.result === 'Blocked').length;
const notRunMust = mustReqs.filter(r => r.result === 'Not Run').length;

console.log('\n═══════════════════════════════════════════════════════════');
console.log(' Requirements Traceability Checker — FCA-VVP-001 / TST-016..018');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(`Requirements checked:  ${requirements.length}`);
console.log(`Must requirements:     ${mustReqs.length}`);
console.log(`  Passed:  ${passedMust}`);
console.log(`  Failed:  ${failedMust}`);
console.log(`  Blocked: ${blockedMust}`);
console.log(`  Not Run: ${notRunMust}`);
console.log(`Test IDs indexed:      ${allTestIds.length}`);

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ⚠  ${w}`);
}

if (errors.length > 0) {
  console.log(`\nErrors (${errors.length}):`);
  for (const e of errors) console.log(`  ✗  ${e}`);
  console.log('\n✗ Traceability check FAILED\n');
} else {
  console.log('\n✓ Traceability check PASSED\n');
}

process.exit(exitCode);
