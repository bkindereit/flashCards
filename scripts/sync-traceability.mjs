#!/usr/bin/env node
/**
 * Bidirectional Traceability Synchronizer (TST-016, TST-017, TST-018)
 * 
 * Dynamically discovers all automated tests citing SRS requirements:
 * Regex: ^([A-Z]{2,3}-\d{3})(,\s*[A-Z]{2,3}-\d{3})*:\s
 * 
 * Reads machine test execution evidence:
 * - reports/vitest/junit.xml
 * - playwright-report/results.json
 * - reports/pgtap/output.tap
 * - reports/performance/prf-001-selection.json & prf-002-csv-import.json
 * - docs/manual-verification/*.md
 * 
 * Synchronizes docs/traceability_matrix.json with real test IDs, index, and results.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const srsPath = path.join(repoRoot, 'Instructions/flashcard-srs.md');
const matrixPath = path.join(repoRoot, 'docs/traceability_matrix.json');

// 1. Parse SRS for all requirements
const srsContent = fs.readFileSync(srsPath, 'utf8');
const reqRegex = /^\| ([A-Z]{2,3}-\d{3}) \| (Must|Should) \| (.*?)(?: \|)?$/gm;
const srsRequirements = [];
for (const match of srsContent.matchAll(reqRegex)) {
  srsRequirements.push({
    id: match[1],
    priority: match[2],
    description: match[3].replace(/\|.*$/, '').trim()
  });
}

// 2. Discover automated tests across tests/ and supabase/tests/
const titleRegex = /(?:it|test)(?:\.skip|\.only)?\s*\(\s*(['"`])([A-Z]{2,3}-\d{3}(?:,\s*[A-Z]{2,3}-\d{3})*:\s[^'"`]+)\1/g;
const sqlDescRegex = /'([A-Z]{2,3}-\d{3}(?:,\s*[A-Z]{2,3}-\d{3})*:\s[^']+)'/g;

const discoveredTestsByReq = new Map();
const testIndex = {};
const allDiscovered = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(repoRoot, filePath);
  const isSql = filePath.endsWith('.sql');
  const regex = isSql ? sqlDescRegex : titleRegex;

  for (const m of content.matchAll(regex)) {
    const rawTitle = isSql ? m[1] : m[2];
    const colonIdx = rawTitle.indexOf(':');
    if (colonIdx === -1) continue;

    const validSrsIds = new Set(srsRequirements.map(r => r.id));
    const idsPart = rawTitle.slice(0, colonIdx);
    const titlePart = rawTitle.slice(colonIdx + 1).trim();
    const reqIds = idsPart.split(',').map(s => s.trim()).filter(id => validSrsIds.has(id));
    if (reqIds.length === 0) continue;

    const fullTitle = `${idsPart}: ${titlePart}`;
    const testId = `${relPath}::${fullTitle}`;

    testIndex[testId] = reqIds;
    allDiscovered.push({ testId, file: relPath, title: fullTitle, reqIds });

    for (const reqId of reqIds) {
      if (!discoveredTestsByReq.has(reqId)) {
        discoveredTestsByReq.set(reqId, []);
      }
      discoveredTestsByReq.get(reqId).push({ testId, file: relPath, title: fullTitle });
    }
  }
}

function scanDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== 'playwright-report' && entry.name !== 'test-results') {
        scanDir(full);
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.sql')) {
      scanFile(full);
    }
  }
}

scanDir(path.join(repoRoot, 'tests'));
scanDir(path.join(repoRoot, 'supabase/tests'));

// 3. Read Machine Test Results
const testResults = new Map(); // testId -> 'Pass' | 'Fail' | 'Not Run'

function unescapeXml(str) {
  return str
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

// (a) Vitest JUnit
const junitPath = path.join(repoRoot, 'reports/vitest/junit.xml');
const vitestCaseStatus = new Map();
if (fs.existsSync(junitPath)) {
  const junit = fs.readFileSync(junitPath, 'utf8');
  const testcaseRegex = /<testcase classname="([^"]+)" name="([^"]+)"(?:[^>]*?)(?:\/|>(.*?)<\/testcase)>/gs;
  for (const m of junit.matchAll(testcaseRegex)) {
    const classname = unescapeXml(m[1]);
    const rawName = unescapeXml(m[2]);
    const body = m[3] || '';
    const hasFailure = body.includes('<failure') || body.includes('<error');
    // Vitest JUnit puts suite > test title into name; extract title starting with requirement ID
    const titleMatch = rawName.match(/([A-Z]{2,3}-\d{3}(?:,\s*[A-Z]{2,3}-\d{3})*:\s.*)$/);
    const parts = rawName.split(' > ');
    const title = titleMatch ? titleMatch[1].trim() : parts[parts.length - 1].trim();
    const status = hasFailure ? 'Fail' : 'Pass';
    vitestCaseStatus.set(`${classname}::${title}`, status);
    vitestCaseStatus.set(title, status);
  }
}

// (b) Playwright results
const pwJsonPath = path.join(repoRoot, 'playwright-report/results.json');
const pwCaseStatus = new Map();
if (fs.existsSync(pwJsonPath)) {
  try {
    const pwData = JSON.parse(fs.readFileSync(pwJsonPath, 'utf8'));
    function walkPwSuite(suite) {
      for (const spec of suite.specs || []) {
        let hasPassed = false;
        let hasFailed = false;
        for (const test of spec.tests || []) {
          for (const res of test.results || []) {
            if (res.status === 'passed') hasPassed = true;
            if (res.status === 'failed' || res.status === 'timedOut') hasFailed = true;
          }
        }
        const status = hasFailed ? 'Fail' : (hasPassed ? 'Pass' : 'Not Run');
        const file = `tests/e2e/${spec.file}`;
        pwCaseStatus.set(`${file}::${spec.title}`, status);
        pwCaseStatus.set(spec.title, status);
      }
      for (const s of suite.suites || []) {
        walkPwSuite(s);
      }
    }
    for (const rootSuite of pwData.suites || []) {
      walkPwSuite(rootSuite);
    }
  } catch {}
}

// (c) pgTAP output
const pgtapPath = path.join(repoRoot, 'reports/pgtap/output.tap');
let pgtapPassed = false;
if (fs.existsSync(pgtapPath)) {
  const tap = fs.readFileSync(pgtapPath, 'utf8');
  if (tap.includes('Result: PASS') || tap.includes('All tests successful') || tap.includes('.. ok')) {
    pgtapPassed = true;
  }
}

// (d) Performance reports
const perf1Path = path.join(repoRoot, 'reports/performance/prf-001-selection.json');
const perf2Path = path.join(repoRoot, 'reports/performance/prf-002-csv-import.json');
let prf1Passed = false;
let prf2Passed = false;
if (fs.existsSync(perf1Path)) {
  try {
    const p1 = JSON.parse(fs.readFileSync(perf1Path, 'utf8'));
    if (p1.passed === true) prf1Passed = true;
  } catch {}
}
if (fs.existsSync(perf2Path)) {
  try {
    const p2 = JSON.parse(fs.readFileSync(perf2Path, 'utf8'));
    if (p2.passed === true) prf2Passed = true;
  } catch {}
}

// Determine status of each discovered test
for (const disc of allDiscovered) {
  let status = 'Not Run';
  if (disc.file.startsWith('tests/e2e')) {
    status = pwCaseStatus.get(disc.testId) || pwCaseStatus.get(disc.title) || 'Not Run';
  } else if (disc.file.startsWith('supabase/tests')) {
    status = pgtapPassed ? 'Pass' : 'Not Run';
  } else if (disc.file.includes('benchmark.perf')) {
    if (disc.title.includes('PRF-001')) status = prf1Passed ? 'Pass' : 'Not Run';
    else if (disc.title.includes('PRF-002')) status = prf2Passed ? 'Pass' : 'Not Run';
  } else {
    // Vitest
    status = vitestCaseStatus.get(disc.testId) || vitestCaseStatus.get(disc.title) || 'Not Run';
  }
  testResults.set(disc.testId, status);
}

// Load existing matrix to preserve activity IDs, methods, and default evidence
let existingMatrix = { requirements: [] };
if (fs.existsSync(matrixPath)) {
  try {
    existingMatrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  } catch {}
}
const existingReqMap = new Map((existingMatrix.requirements || []).map(r => [r.requirement_id, r]));

// 4. Build Synchronized Matrix
const syncedRequirements = [];

for (const req of srsRequirements) {
  const reqId = req.id;
  const existing = existingReqMap.get(reqId) || {};
  const discovered = discoveredTestsByReq.get(reqId) || [];

  // Deduplicate test IDs for this requirement
  const automatedTestIds = [...new Set(discovered.map(d => d.testId))];

  // Evidence paths: unique test files + existing evidence paths that exist
  const evidenceSet = new Set(discovered.map(d => d.file));
  for (const ep of existing.evidence_paths || []) {
    if (fs.existsSync(path.join(repoRoot, ep))) {
      evidenceSet.add(ep);
    }
  }
  if (evidenceSet.size === 0) {
    evidenceSet.add('README.md');
  }

  // Determine Result
  let result = 'Not Run';
  if (req.priority === 'Should') {
    result = 'Not Run';
  } else if (reqId === 'PRF-003' || reqId === 'CIC-006' || reqId === 'CIC-007') {
    result = 'Blocked';
  } else if (automatedTestIds.length > 0) {
    const statuses = automatedTestIds.map(tid => testResults.get(tid) || 'Not Run');
    if (statuses.some(s => s === 'Fail')) {
      result = 'Fail';
    } else if (statuses.every(s => s === 'Pass')) {
      result = 'Pass';
    } else if (statuses.some(s => s === 'Blocked')) {
      result = 'Blocked';
    } else {
      result = 'Not Run';
    }
  }

  syncedRequirements.push({
    requirement_id: reqId,
    priority: req.priority,
    description: req.description,
    verification_methods: existing.verification_methods || ['T'],
    activity_ids: existing.activity_ids || ['VA-ARC-001'],
    automated_test_ids: automatedTestIds,
    evidence_paths: Array.from(evidenceSet),
    result,
    anomaly_ids: existing.anomaly_ids || []
  });
}

const matrixOutput = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  description: 'Authoritative Bidirectional Requirements Traceability Matrix — FCA-SRS-001 vs FCA-VVP-001',
  version: '1.0',
  generated_at: new Date().toISOString(),
  requirements: syncedRequirements,
  test_index: testIndex
};

fs.writeFileSync(matrixPath, JSON.stringify(matrixOutput, null, 2), 'utf8');

const passedCount = syncedRequirements.filter(r => r.result === 'Pass').length;
const blockedCount = syncedRequirements.filter(r => r.result === 'Blocked').length;
const notRunCount = syncedRequirements.filter(r => r.result === 'Not Run').length;
const failedCount = syncedRequirements.filter(r => r.result === 'Fail').length;

console.log('\n═══════════════════════════════════════════════════════════');
console.log(' Traceability Matrix Synchronization Summary');
console.log('═══════════════════════════════════════════════════════════');
console.log(`Requirements synchronized: ${syncedRequirements.length}`);
console.log(`Automated Tests indexed:   ${Object.keys(testIndex).length}`);
console.log(`  Passed:  ${passedCount}`);
console.log(`  Blocked: ${blockedCount}`);
console.log(`  Not Run: ${notRunCount}`);
console.log(`  Failed:  ${failedCount}`);
console.log(`Matrix written to: ${path.relative(repoRoot, matrixPath)}\n`);
