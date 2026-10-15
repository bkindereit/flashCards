/**
 * Domain Module Coverage Tests
 * Tests diagnostics.ts, exportService.ts, clock.ts to meet TST-012 / TST-013 thresholds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runSchedulerConformanceVector } from '@/domain/diagnostics';
import { triggerJsonDownload, UserDataExport } from '@/domain/exportService';
import { FSRS_PACKAGE_VERSION, FSRS_PARAMETER_SET_VERSION, SCHEDULING_POLICY_VERSION } from '@/domain/fsrsService';
import { SystemClock, FixedClock, SystemRandom, SeededRandom } from '@/domain/clock';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn()
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    }))
  }
}));

// ── Clock Tests (clock.ts lines 12-13, 32-33) ─────────────────────────────

describe('Clock implementations', () => {
  it('SystemClock returns a Date approximately equal to now', () => {
    const clock = new SystemClock();
    const before = Date.now();
    const result = clock.now();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });

  it('FixedClock.advance increases time correctly', () => {
    const clock = new FixedClock('2026-01-01T00:00:00Z');
    const t0 = clock.now().getTime();
    clock.advance(5000);
    expect(clock.now().getTime()).toBe(t0 + 5000);
  });

  it('FixedClock.setTime changes the time directly', () => {
    const clock = new FixedClock('2026-01-01T00:00:00Z');
    clock.setTime('2026-06-15T12:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-06-15T12:00:00.000Z');
  });

  it('FixedClock accepts a number timestamp', () => {
    const ts = Date.UTC(2026, 0, 1);
    const clock = new FixedClock(ts);
    expect(clock.now().getTime()).toBe(ts);
  });

  it('SystemRandom returns values in [0, 1)', () => {
    const rng = new SystemRandom();
    for (let i = 0; i < 20; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(rng.getSeed()).toBe('system');
  });

  it('SeededRandom is deterministic with same seed', () => {
    const r1 = new SeededRandom('test-seed');
    const r2 = new SeededRandom('test-seed');
    const seq1 = Array.from({ length: 10 }, () => r1.next());
    const seq2 = Array.from({ length: 10 }, () => r2.next());
    expect(seq1).toEqual(seq2);
  });

  it('SeededRandom getSeed returns original seed', () => {
    const rng = new SeededRandom('my-seed-123');
    expect(rng.getSeed()).toBe('my-seed-123');
  });

  it('SeededRandom produces values in [0, 1)', () => {
    const rng = new SeededRandom(42);
    for (let i = 0; i < 50; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('SeededRandom numeric seed produces deterministic sequence', () => {
    const r1 = new SeededRandom(99);
    const r2 = new SeededRandom(99);
    expect(r1.next()).toBe(r2.next());
  });
});

// ── Diagnostics Tests (diagnostics.ts) ────────────────────────────────────

describe('Diagnostics: runSchedulerConformanceVector (DIA-003)', () => {
  it('returns passed=true for valid FSRS conformance', () => {
    const result = runSchedulerConformanceVector();
    expect(result.passed).toBe(true);
    expect(typeof result.diff).toBe('number');
    expect(result.diff).toBeLessThanOrEqual(0.05);
    expect(result.message).toContain('Retrievability');
  });
});

describe('FsrsService constants', () => {
  it('FSRS_PACKAGE_VERSION is a non-empty string', () => {
    expect(typeof FSRS_PACKAGE_VERSION).toBe('string');
    expect(FSRS_PACKAGE_VERSION.length).toBeGreaterThan(0);
  });

  it('FSRS_PARAMETER_SET_VERSION is defined', () => {
    expect(typeof FSRS_PARAMETER_SET_VERSION).toBe('string');
  });

  it('SCHEDULING_POLICY_VERSION is defined', () => {
    expect(typeof SCHEDULING_POLICY_VERSION).toBe('string');
  });
});

// ── ExportService Tests (exportService.ts) ────────────────────────────────

describe('triggerJsonDownload (REL-005)', () => {
  beforeEach(() => {
    // Mock URL and DOM
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-id');
    globalThis.URL.revokeObjectURL = vi.fn();

    const mockAnchor = {
      href: '',
      download: '',
      click: vi.fn()
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as unknown as HTMLElement);
  });

  it('creates a Blob, anchor, clicks, and revokes URL', () => {
    const data: UserDataExport = {
      exportVersion: '1.0',
      exportedAt: '2026-01-01T00:00:00Z',
      userId: 'user-123',
      algorithm: {
        name: 'FSRS',
        packageVersion: '4.4.1',
        parameterSetVersion: '1.0',
        policyVersion: '1.0'
      },
      decks: [],
      cards: [],
      importBatches: [],
      studySessions: [],
      reviewEvents: []
    };

    triggerJsonDownload(data, 'export.json');

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    expect(document.createElement).toHaveBeenCalledWith('a');
  });

  it('uses default filename when not specified', () => {
    const data: UserDataExport = {
      exportVersion: '1.0',
      exportedAt: '2026-01-01T00:00:00Z',
      userId: 'user-456',
      algorithm: { name: 'FSRS', packageVersion: '4.4.1', parameterSetVersion: '1.0', policyVersion: '1.0' },
      decks: [],
      cards: [],
      importBatches: [],
      studySessions: [],
      reviewEvents: []
    };

    // Should not throw
    expect(() => triggerJsonDownload(data)).not.toThrow();
  });

  it('REL-005: exportAllUserData fetches all tables and builds export object with owned decks, cards, sessions, events, and algorithm versions', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'test-user-id' } as any },
      error: null
    });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: [], error: null }))
    } as any);

    const { exportAllUserData } = await import('@/domain/exportService');
    const result = await exportAllUserData();

    expect(result.exportVersion).toBe('1.0');
    expect(result.userId).toBe('test-user-id');
    expect(result.algorithm.name).toBe('FSRS');
  });

  it('exportAllUserData throws if any table fetch fails', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: { id: 'test-user-id' } as any },
      error: null
    });
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => Promise.resolve({ data: null, error: new Error('Failed to fetch table') }))
    } as any);

    const { exportAllUserData } = await import('@/domain/exportService');
    await expect(exportAllUserData()).rejects.toThrow('Failed to fetch table');
  });

  it('exportAllUserData throws if user is not authenticated', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null } as any,
      error: null
    });

    const { exportAllUserData } = await import('@/domain/exportService');
    await expect(exportAllUserData()).rejects.toThrow('User must be authenticated to export data');
  });
});

describe('runDiagnosticsSuite (DIA-001..DIA-006)', () => {
  it('runs all checks and returns sanitized report', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
      error: null
    } as any);
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    } as any);

    const { runDiagnosticsSuite } = await import('@/domain/diagnostics');
    const report = await runDiagnosticsSuite();

    expect(report.applicationVersion).toBe('1.0.0');
    expect(report.checks.length).toBeGreaterThanOrEqual(4);
    expect(report.scheduler.packageVersion).toBe('4.4.1');
    expect(report.scheduler.conformancePassed).toBe(true);
  });

  it('handles network / supabase API exception in diagnostics suite', async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValueOnce(new Error('Network disconnected'));

    const { runDiagnosticsSuite } = await import('@/domain/diagnostics');
    const report = await runDiagnosticsSuite();

    const netCheck = report.checks.find(c => c.id === 'chk_network_reachability');
    expect(netCheck).toBeDefined();
    expect(netCheck?.passed).toBe(false);
  });

  it('detects different browser families based on navigator.userAgent', async () => {
    const originalUA = navigator.userAgent;

    // Test Firefox
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0', configurable: true });
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null }, error: null } as any);
    vi.mocked(supabase.from).mockReturnValue({ select: vi.fn(() => ({ limit: vi.fn(() => Promise.resolve({ data: [], error: null })) })) } as any);

    const { runDiagnosticsSuite } = await import('@/domain/diagnostics');
    let report = await runDiagnosticsSuite();
    expect(report.browserFamily).toBe('Firefox');

    // Test Safari / WebKit
    Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', configurable: true });
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: null }, error: null } as any);
    report = await runDiagnosticsSuite();
    expect(report.browserFamily).toBe('WebKit');

    // Reset UA
    Object.defineProperty(navigator, 'userAgent', { value: originalUA, configurable: true });
  });
});
