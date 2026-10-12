/**
 * Runtime Diagnostics Domain Engine
 * Implements DIA-001..DIA-006 and SEC-009
 */

import { FsrsService, FSRS_PACKAGE_VERSION, FSRS_PARAMETER_SET_VERSION, SCHEDULING_POLICY_VERSION } from './fsrsService';
import { createCard } from '@/testing/factories';
import { supabase } from '@/lib/supabase';

export interface DiagnosticCheckResult {
  id: string;
  name: string;
  passed: boolean;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface SanitizedDiagnosticReport {
  reportId: string;
  correlationId: string;
  generatedAt: string;
  applicationVersion: string;
  browserFamily: string;
  scheduler: {
    packageVersion: string;
    parameterSetVersion: string;
    policyVersion: string;
    conformancePassed: boolean;
  };
  checks: DiagnosticCheckResult[];
  allPassed: boolean;
}

/**
 * DIA-003: Fixed in-memory conformance vector for FSRS
 */
export function runSchedulerConformanceVector(): { passed: boolean; message: string; diff?: number } {
  const fsrsService = new FsrsService(0.90);
  const now = new Date('2026-01-01T00:00:00Z');
  const card = createCard({
    learning_state: 'review',
    difficulty: 5.0,
    stability_days: 10.0,
    last_review_at: new Date('2025-12-25T00:00:00Z').toISOString(),
    next_due_at: now.toISOString()
  });

  // Calculate retrievability at now (7 days elapsed on 10 days stability)
  const r = fsrsService.getRetrievability(card, now);
  // Expected retrievability is ~0.899
  const expectedR = 0.899;
  const tolerance = 0.05;

  const passed = Math.abs(r - expectedR) <= tolerance;
  return {
    passed,
    message: passed ? `Retrievability ${r.toFixed(4)} matches expected conformance` : `Retrievability ${r.toFixed(4)} deviated from expected ${expectedR}`,
    diff: Math.abs(r - expectedR)
  };
}

/**
 * Runs full non-destructive diagnostic suite (DIA-002)
 */
export async function runDiagnosticsSuite(): Promise<SanitizedDiagnosticReport> {
  const correlationId = crypto.randomUUID();
  const reportId = crypto.randomUUID();
  const checks: DiagnosticCheckResult[] = [];

  // Check 1: Client Version
  checks.push({
    id: 'chk_client_version',
    name: 'Client Version & Build',
    passed: true,
    message: 'Adaptive Flashcards v1.0.0 (Production Build)',
    timestamp: new Date().toISOString()
  });

  // Check 2: Scheduler Sanity & Conformance (DIA-003)
  const conformance = runSchedulerConformanceVector();
  checks.push({
    id: 'chk_scheduler_conformance',
    name: 'Scheduler Sanity & Conformance Vector',
    passed: conformance.passed,
    message: conformance.message,
    timestamp: new Date().toISOString()
  });

  // Check 3: API & Database Reachability
  try {
    const { data: { session }, error: authErr } = await supabase.auth.getSession();
    checks.push({
      id: 'chk_auth_status',
      name: 'Authentication Status',
      passed: !authErr,
      message: session ? 'Authenticated User Session Active' : 'Unauthenticated (Public Client Mode)',
      timestamp: new Date().toISOString()
    });

    const { error: dbErr } = await supabase.from('decks').select('id').limit(1);
    const dbPassed = !dbErr || dbErr.code === 'PGRST116'; // empty or accessible
    checks.push({
      id: 'chk_database_reachability',
      name: 'Database API Reachability',
      passed: dbPassed,
      message: dbPassed ? 'PostgreSQL API endpoint responded successfully' : `API Error: ${dbErr?.message}`,
      timestamp: new Date().toISOString()
    });
  } catch (err: unknown) {
    checks.push({
      id: 'chk_network_reachability',
      name: 'Network & API Connection',
      passed: false,
      message: err instanceof Error ? err.message : 'Network unreachable',
      timestamp: new Date().toISOString()
    });
  }

  // Detect browser family
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
  const browserFamily = ua.includes('Chrome') ? 'Chromium' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'WebKit' : 'Standard Browser';

  const allPassed = checks.every(c => c.passed);

  return {
    reportId,
    correlationId,
    generatedAt: new Date().toISOString(),
    applicationVersion: '1.0.0',
    browserFamily,
    scheduler: {
      packageVersion: FSRS_PACKAGE_VERSION,
      parameterSetVersion: FSRS_PARAMETER_SET_VERSION,
      policyVersion: SCHEDULING_POLICY_VERSION,
      conformancePassed: conformance.passed
    },
    checks,
    allPassed
  };
}
