#!/usr/bin/env node
/**
 * Master Verification Orchestration Script (TST-002, TST-003, TST-014)
 * 
 * Non-interactive execution of the release verification pipeline:
 * 1. Frozen lockfile verification (CIC-001)
 * 2. TypeScript strict typecheck (ARC-002)
 * 3. ESLint zero-warning linting
 * 4. Vitest unit/component/domain coverage (TST-012, TST-013) + JUnit report
 * 5. Traceability matrix checker (TST-016..TST-018)
 * 6. Production build (ARC-001, ARC-003) + SHA-256 asset manifest
 * 7. Secret scanner (SEC-004)
 * 8. Production dependency vulnerability audit
 * 9. pgTAP database tests (DAT-001..015, SEC-001..003) via `supabase test db`
 * 10. Playwright E2E and accessibility audits (ACC-006, ACC-007)
 * 
 * Summarizes run in reports/verify/summary.json and enforces exit code rules.
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const reportsDir = path.join(repoRoot, 'reports');
const verifyReportsDir = path.join(reportsDir, 'verify');
const vitestReportsDir = path.join(reportsDir, 'vitest');
const buildReportsDir = path.join(reportsDir, 'build');

fs.mkdirSync(verifyReportsDir, { recursive: true });
fs.mkdirSync(vitestReportsDir, { recursive: true });
fs.mkdirSync(buildReportsDir, { recursive: true });

console.log('═══════════════════════════════════════════════════════════════');
console.log(' Master Verification Pipeline — FCA-SRS-001 / FCA-VVP-001');
console.log('═══════════════════════════════════════════════════════════════\n');

const startTime = new Date();
const stepResults = [];

function checkSupabaseStack() {
  try {
    const whichRes = spawnSync('which', ['supabase'], { encoding: 'utf8' });
    if (whichRes.status !== 0) return { available: false, reason: 'supabase CLI not found in PATH' };
    const statusRes = spawnSync('supabase', ['status'], { encoding: 'utf8', timeout: 5000 });
    if (statusRes.status !== 0) return { available: false, reason: 'local supabase stack is not running' };
    return { available: true };
  } catch (err) {
    return { available: false, reason: err.message };
  }
}

function runStep({ id, name, command, fn }) {
  console.log(`▶ Running: ${name} (${command || 'internal'})...`);
  const stepStart = Date.now();
  const logBase = path.join(verifyReportsDir, `${id}`);
  const stdoutPath = `${logBase}.stdout.log`;
  const stderrPath = `${logBase}.stderr.log`;

  if (fn) {
    try {
      const result = fn();
      const durationMs = Date.now() - stepStart;
      stepResults.push({
        id,
        name,
        command: command || 'custom',
        status: result.status || 'passed',
        exitCode: result.exitCode ?? 0,
        durationMs,
        notes: result.notes || '',
        stdoutPath: null,
        stderrPath: null
      });
      console.log(`  ✓ ${name} completed (${(durationMs / 1000).toFixed(2)}s)\n`);
      return result.status === 'passed';
    } catch (err) {
      const durationMs = Date.now() - stepStart;
      stepResults.push({
        id,
        name,
        command: command || 'custom',
        status: 'failed',
        exitCode: 1,
        durationMs,
        notes: err.message,
        stdoutPath: null,
        stderrPath: null
      });
      console.error(`  ✗ ${name} FAILED: ${err.message}\n`);
      return false;
    }
  }

  try {
    const res = spawnSync(command, {
      shell: true,
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...process.env, CI: 'true' }
    });

    const durationMs = Date.now() - stepStart;
    fs.writeFileSync(stdoutPath, res.stdout || '', 'utf8');
    fs.writeFileSync(stderrPath, res.stderr || '', 'utf8');

    const passed = res.status === 0;
    stepResults.push({
      id,
      name,
      command,
      status: passed ? 'passed' : 'failed',
      exitCode: res.status ?? 1,
      durationMs,
      stdoutPath: path.relative(repoRoot, stdoutPath),
      stderrPath: path.relative(repoRoot, stderrPath)
    });

    if (passed) {
      console.log(`  ✓ ${name} passed (${(durationMs / 1000).toFixed(2)}s)\n`);
    } else {
      console.error(`  ✗ ${name} failed with exit code ${res.status} (${(durationMs / 1000).toFixed(2)}s)`);
      if (res.stderr) console.error(`    ${res.stderr.trim().slice(0, 500)}`);
      console.log('');
    }
    return passed;
  } catch (err) {
    const durationMs = Date.now() - stepStart;
    stepResults.push({
      id,
      name,
      command,
      status: 'failed',
      exitCode: 1,
      durationMs,
      notes: err.message,
      stdoutPath: null,
      stderrPath: null
    });
    console.error(`  ✗ ${name} threw error: ${err.message}\n`);
    return false;
  }
}

// 1. Frozen Lockfile Check
runStep({
  id: '01_frozen_lockfile',
  name: 'Frozen Lockfile Integrity (CIC-001)',
  command: 'npm ci --dry-run'
});

// 2. TypeScript strict compilation
runStep({
  id: '02_typecheck',
  name: 'TypeScript Strict Typecheck (ARC-002)',
  command: 'npx tsc -b'
});

// 3. ESLint zero-warning
runStep({
  id: '03_eslint',
  name: 'ESLint Code Quality (0 warnings)',
  command: 'npx eslint . --ext ts,tsx --max-warnings 0'
});

// 4. Test suite & Coverage
runStep({
  id: '04_vitest_coverage',
  name: 'Unit, Component, Domain & PGlite Tests with Coverage (TST-012, TST-013)',
  command: 'npx vitest run --coverage --reporter=default --reporter=junit --outputFile.junit=reports/vitest/junit.xml'
});

// 5. Production Build & Checksum Manifest
runStep({
  id: '05_build_and_manifest',
  name: 'Production Build & Asset Checksum Manifest (ARC-001, ARC-003)',
  command: 'npx vite build',
  fn: () => {
    // Run build
    execSync('npx vite build', { cwd: repoRoot, stdio: 'pipe' });
    const distDir = path.join(repoRoot, 'dist');
    if (!fs.existsSync(distDir)) throw new Error('dist directory does not exist after build');

    const manifestFiles = [];
    function scanDir(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else {
          const content = fs.readFileSync(full);
          const hash = crypto.createHash('sha256').update(content).digest('hex');
          manifestFiles.push({
            path: path.relative(distDir, full),
            sizeBytes: content.length,
            sha256: hash
          });
        }
      }
    }
    scanDir(distDir);

    const manifestPayload = {
      generatedAt: new Date().toISOString(),
      fileCount: manifestFiles.length,
      files: manifestFiles
    };

    fs.writeFileSync(
      path.join(buildReportsDir, 'manifest.json'),
      JSON.stringify(manifestPayload, null, 2),
      'utf8'
    );
    return { status: 'passed', exitCode: 0, notes: `${manifestFiles.length} files hashed` };
  }
});

// 6. Secret Scan
runStep({
  id: '06_secret_scan',
  name: 'Secret & Credential Scan (SEC-004)',
  command: 'node scripts/secret-scan.mjs'
});

// 7. Production Dependency Audit
runStep({
  id: '07_dependency_audit',
  name: 'Production Dependency Vulnerability Audit',
  command: 'npm audit --omit=dev --audit-level=high'
});

// 8. Performance Benchmarks
runStep({
  id: '08_performance_benchmarks',
  name: 'Performance Benchmarks (PRF-001, PRF-002)',
  command: 'npm run test:perf'
});

// 9. Database Integration Tests (pgTAP via Supabase CLI)
const supabaseStatus = checkSupabaseStack();
if (supabaseStatus.available) {
  runStep({
    id: '09_database_pgtap',
    name: 'Database Schema, RLS & RPC Tests (pgTAP)',
    command: 'supabase test db',
    fn: () => {
      const pgtapDir = path.join(reportsDir, 'pgtap');
      fs.mkdirSync(pgtapDir, { recursive: true });
      const tapPath = path.join(pgtapDir, 'output.tap');
      try {
        const out = execSync('supabase test db', { cwd: repoRoot, encoding: 'utf8' });
        fs.writeFileSync(tapPath, out, 'utf8');
        return { status: 'passed', exitCode: 0, notes: 'All pgTAP assertions passed' };
      } catch (err) {
        fs.writeFileSync(tapPath, (err.stdout || '') + '\n' + (err.stderr || ''), 'utf8');
        throw err;
      }
    }
  });
} else {
  console.log(`▶ Skipping (Blocked): Database Tests (pgTAP via Supabase CLI)`);
  console.log(`  ⚠ Reason: ${supabaseStatus.reason} (DEC-003)\n`);
  stepResults.push({
    id: '09_database_pgtap',
    name: 'Database Schema, RLS & RPC Tests (pgTAP)',
    command: 'supabase test db',
    status: 'blocked',
    exitCode: 1,
    durationMs: 0,
    notes: `Blocked by environment: ${supabaseStatus.reason} (DEC-003)`
  });
}

// 10. Playwright E2E & Accessibility Tests
if (supabaseStatus.available) {
  runStep({
    id: '10_playwright_e2e',
    name: 'Playwright E2E & Accessibility Tests (ACC-006, ACC-007)',
    command: 'npx playwright test'
  });
} else {
  console.log(`▶ Skipping (Blocked): Playwright E2E & Accessibility Tests`);
  console.log(`  ⚠ Reason: Local Supabase authentication service not running (DEC-003)\n`);
  stepResults.push({
    id: '10_playwright_e2e',
    name: 'Playwright E2E & Accessibility Tests (ACC-006, ACC-007)',
    command: 'npx playwright test',
    status: 'blocked',
    exitCode: 1,
    durationMs: 0,
    notes: `Blocked by environment: Local Supabase authentication stack not running (DEC-003)`
  });
}

// 11. Traceability Matrix Synchronization
runStep({
  id: '11_traceability_sync',
  name: 'Traceability Matrix Synchronization (TST-016..TST-018)',
  command: 'node scripts/sync-traceability.mjs'
});

// 12. Traceability Matrix Validation
runStep({
  id: '12_traceability_check',
  name: 'Requirements Traceability Checker (TST-016..TST-018)',
  command: 'node scripts/check-traceability.mjs'
});

// Write verification summary
const endTime = new Date();
const totalDurationMs = endTime.getTime() - startTime.getTime();
const passedCount = stepResults.filter(s => s.status === 'passed').length;
const failedCount = stepResults.filter(s => s.status === 'failed').length;
const blockedCount = stepResults.filter(s => s.status === 'blocked').length;
const overallPassed = failedCount === 0 && blockedCount === 0;

const summary = {
  startedAt: startTime.toISOString(),
  completedAt: endTime.toISOString(),
  totalDurationMs,
  overallPassed,
  counts: {
    total: stepResults.length,
    passed: passedCount,
    failed: failedCount,
    blocked: blockedCount
  },
  steps: stepResults
};

fs.writeFileSync(
  path.join(verifyReportsDir, 'summary.json'),
  JSON.stringify(summary, null, 2),
  'utf8'
);

console.log('═══════════════════════════════════════════════════════════════');
console.log(' Verification Pipeline Summary');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Total Steps:   ${stepResults.length}`);
console.log(`Passed:        ${passedCount}`);
console.log(`Failed:        ${failedCount}`);
console.log(`Blocked:       ${blockedCount}`);
console.log(`Overall:       ${overallPassed ? 'PASS' : 'FAILED / BLOCKED'}`);
console.log(`Summary JSON:  reports/verify/summary.json`);
console.log('═══════════════════════════════════════════════════════════════\n');

if (!overallPassed) {
  console.error('Master verification pipeline did not pass all required gates.');
  process.exit(1);
} else {
  console.log('All verification gates successfully PASSED.');
  process.exit(0);
}
