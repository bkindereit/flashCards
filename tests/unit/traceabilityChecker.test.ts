/**
 * Traceability Checker Unit Tests
 * Implements VA-TRC-001 (TST-016..TST-018)
 *
 * Verifies that scripts/check-traceability.mjs accurately detects:
 * - Missing Must requirements from FCA-SRS-001
 * - Duplicate requirement IDs
 * - Orphan requirement IDs not in FCA-SRS-001
 * - Orphan test index references
 */

import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Traceability Checker (VA-TRC-001, TST-016..TST-018)', () => {
  const scriptPath = path.resolve(process.cwd(), 'scripts/check-traceability.mjs');
  const srsPath = path.resolve(process.cwd(), 'Instructions/flashcard-srs.md');

  function runChecker(matrixData: any): { stdout: string; stderr: string; exitCode: number } {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trc-test-'));
    const tmpMatrix = path.join(tmpDir, 'matrix.json');
    fs.writeFileSync(tmpMatrix, JSON.stringify(matrixData, null, 2), 'utf8');

    try {
      const output = execFileSync(process.execPath, [
        scriptPath,
        '--matrix', tmpMatrix,
        '--srs', srsPath
      ], {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return { stdout: output, stderr: '', exitCode: 0 };
    } catch (err: any) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || '',
        exitCode: err.status || 1
      };
    }
  }

  it('fails with location when a Must requirement is missing from the matrix (TST-017)', () => {
    // Matrix with only one requirement, missing all other 208 Must requirements
    const testMatrix = {
      version: '1.0',
      requirements: [
        {
          requirement_id: 'ARC-001',
          priority: 'Must',
          description: 'Single-page application',
          verification_methods: ['I', 'T'],
          activity_ids: ['VA-ARC-001'],
          automated_test_ids: ['test-arc-001'],
          evidence_paths: ['package.json'],
          result: 'Pass'
        }
      ],
      test_index: {
        'test-arc-001': ['ARC-001']
      }
    };

    const res = runChecker(testMatrix);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toContain('TST-017: Must requirement');
    expect(res.stdout).toContain('is missing from the matrix');
  });

  it('fails with location when duplicate requirement IDs exist (TST-018)', () => {
    const testMatrix = {
      version: '1.0',
      requirements: [
        {
          requirement_id: 'ARC-001',
          priority: 'Must',
          description: 'Single-page application',
          verification_methods: ['I', 'T'],
          activity_ids: ['VA-ARC-001'],
          automated_test_ids: ['test-arc-001-a'],
          evidence_paths: ['package.json'],
          result: 'Pass'
        },
        {
          requirement_id: 'ARC-001',
          priority: 'Must',
          description: 'Duplicate ARC-001',
          verification_methods: ['I', 'T'],
          activity_ids: ['VA-ARC-001'],
          automated_test_ids: ['test-arc-001-b'],
          evidence_paths: ['package.json'],
          result: 'Pass'
        }
      ],
      test_index: {}
    };

    const res = runChecker(testMatrix);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toContain('TST-018: Duplicate requirement_id: "ARC-001"');
  });

  it('fails with location when an orphan requirement ID is present (TST-018)', () => {
    const testMatrix = {
      version: '1.0',
      requirements: [
        {
          requirement_id: 'XYZ-999',
          priority: 'Must',
          description: 'Nonexistent requirement',
          verification_methods: ['I'],
          activity_ids: ['VA-ARC-001'],
          automated_test_ids: ['test-xyz'],
          evidence_paths: ['package.json'],
          result: 'Pass'
        }
      ],
      test_index: {}
    };

    const res = runChecker(testMatrix);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toContain('TST-018: Matrix requirement "XYZ-999" does not exist in FCA-SRS-001');
  });

  it('fails with location when test index references a nonexistent requirement ID (TST-018)', () => {
    const testMatrix = {
      version: '1.0',
      requirements: [
        {
          requirement_id: 'ARC-001',
          priority: 'Must',
          description: 'Single-page application',
          verification_methods: ['I'],
          activity_ids: ['VA-ARC-001'],
          automated_test_ids: ['test-arc-001'],
          evidence_paths: ['package.json'],
          result: 'Pass'
        }
      ],
      test_index: {
        'test-unknown': ['NON-EXISTENT-001']
      }
    };

    const res = runChecker(testMatrix);
    expect(res.exitCode).toBe(1);
    expect(res.stdout).toContain('TST-018: Test "test-unknown" references nonexistent requirement_id "NON-EXISTENT-001"');
  });
});
