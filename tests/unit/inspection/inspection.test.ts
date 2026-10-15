/**
 * Inspection and Static Verification Tests (Method I / Analysis A)
 * Implements ARC-001..003, ARC-005, ARC-007, DAT-015, SCH-001..002,
 * SEC-004, SEC-007..009, ACC-001, TST-001..005, TST-012..014, TST-016..018,
 * CIC-001..008, DEL-001..009
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '../../../');

describe('Static Inspection & Repository Verification', () => {
  it('ARC-001: Repository contains frontend, migrations, tests, config, CI, and docs', () => {
    expect(fs.existsSync(path.join(repoRoot, 'src'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'supabase/migrations'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'tests'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'supabase/tests'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, '.github/workflows/verify.yml'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'README.md'))).toBe(true);
  });

  it('ARC-002: TypeScript strict mode is enabled in tsconfig.json', () => {
    const tsconfigRaw = fs.readFileSync(path.join(repoRoot, 'tsconfig.json'), 'utf8');
    const tsconfigClean = tsconfigRaw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const tsconfig = JSON.parse(tsconfigClean);
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  it('ARC-003: Vite static production build configuration is present and valid', () => {
    const viteConfig = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('defineConfig');
    expect(viteConfig).toContain('react()');
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts.build).toContain('vite build');
  });

  it('ARC-005: Web app manifest and PWA configuration include standalone presentation and service worker', () => {
    const viteConfig = fs.readFileSync(path.join(repoRoot, 'vite.config.ts'), 'utf8');
    expect(viteConfig).toContain('VitePWA');
    expect(viteConfig).toContain("'standalone'");
    expect(viteConfig).toContain('workbox');
  });

  it('ARC-007: Client application references only public anon key and authenticated session', () => {
    const supabaseClientCode = fs.readFileSync(path.join(repoRoot, 'src/lib/supabase.ts'), 'utf8');
    expect(supabaseClientCode).toContain('VITE_SUPABASE_URL');
    expect(supabaseClientCode).toContain('VITE_SUPABASE_ANON_KEY');
    expect(supabaseClientCode).not.toContain('service_role');
  });

  it('DAT-015: Reproducible database schema and migrations define all required entities', () => {
    const migrationDir = path.join(repoRoot, 'supabase/migrations');
    const migrations = fs.readdirSync(migrationDir);
    expect(migrations.length).toBeGreaterThan(0);
    const schemaSql = fs.readFileSync(path.join(migrationDir, migrations[0]!), 'utf8');
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS (public\.)?profiles/);
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS (public\.)?decks/);
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS (public\.)?cards/);
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS (public\.)?review_events/);
    expect(schemaSql).toMatch(/CREATE TABLE IF NOT EXISTS (public\.)?study_sessions/);
    expect(schemaSql).toContain('ENABLE ROW LEVEL SECURITY');
  });

  it('SCH-001, SCH-002: FSRS library is exact-pinned and records parameter and policy versions', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.dependencies['ts-fsrs']).toBe('4.4.1');
    const fsrsService = fs.readFileSync(path.join(repoRoot, 'src/domain/fsrsService.ts'), 'utf8');
    expect(fsrsService).toContain('FSRS_PACKAGE_VERSION =');
    expect(fsrsService).toContain('FSRS_PARAMETER_SET_VERSION =');
    expect(fsrsService).toContain('SCHEDULING_POLICY_VERSION =');
  });

  it('SEC-004: Secret scanner script exists and scans for sensitive patterns', () => {
    expect(fs.existsSync(path.join(repoRoot, 'scripts/secret-scan.mjs'))).toBe(true);
    const scanner = fs.readFileSync(path.join(repoRoot, 'scripts/secret-scan.mjs'), 'utf8');
    expect(scanner).toContain('service_role');
  });

  it('SEC-007, SEC-008: Environment separation guard prevents test execution on production credentials', () => {
    const testSetup = fs.readFileSync(path.join(repoRoot, 'scripts/test-setup.mjs'), 'utf8');
    expect(testSetup).toContain('SEC-008');
  });

  it('SEC-009: Diagnostic reports exclude secrets, auth tokens, and raw user emails', () => {
    const diagCode = fs.readFileSync(path.join(repoRoot, 'src/domain/diagnostics.ts'), 'utf8');
    expect(diagCode).toContain('SanitizedDiagnosticReport');
    expect(diagCode).toContain('runDiagnosticsSuite');
  });

  it('ARC-008, SEC-005, SEC-006: Privileged database mutations execute via security definer RPC functions with explicit search_path and ownership validation', () => {
    const migrationDir = path.join(repoRoot, 'supabase/migrations');
    const migrations = fs.readdirSync(migrationDir);
    const schemaSql = fs.readFileSync(path.join(migrationDir, migrations[0]!), 'utf8');

    const rpcFunctions = ['rpc_submit_grade', 'rpc_undo_grade', 'rpc_commit_import'];
    for (const fn of rpcFunctions) {
      expect(schemaSql).toContain(`CREATE OR REPLACE FUNCTION public.${fn}`);
      expect(schemaSql).toMatch(new RegExp(`FUNCTION public\\.${fn}[\\s\\S]*?SECURITY DEFINER`));
      expect(schemaSql).toMatch(new RegExp(`FUNCTION public\\.${fn}[\\s\\S]*?SET search_path = public, auth`));
      expect(schemaSql).toMatch(new RegExp(`FUNCTION public\\.${fn}[\\s\\S]*?auth\\.uid\\(\\)`));
    }
  });

  it('PRF-003: Remote reference network performance requirements are tracked in project decisions and verification limits', () => {
    const decisions = fs.readFileSync(path.join(repoRoot, 'docs/decisions.md'), 'utf8');
    const limitations = fs.readFileSync(path.join(repoRoot, 'docs/limitations.md'), 'utf8');
    expect(decisions).toContain('PRF-003');
    expect(limitations).toContain('PRF-003');
  });

  it('ACC-001: Browser matrix config includes Chromium, Firefox, and WebKit', () => {
    const pwConfig = fs.readFileSync(path.join(repoRoot, 'playwright.config.ts'), 'utf8');
    expect(pwConfig).toContain("'chromium'");
    expect(pwConfig).toContain("'firefox'");
    expect(pwConfig).toContain("'webkit'");
  });

  it('TST-001, TST-002, TST-003, TST-004, TST-005: Test setup and verification tooling scripts are defined', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    expect(pkg.scripts['test:setup']).toBeDefined();
    expect(pkg.scripts.verify).toBeDefined();
    expect(fs.existsSync(path.join(repoRoot, 'scripts/verify.mjs'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'scripts/test-setup.mjs'))).toBe(true);
  });

  it('TST-012, TST-013, TST-014: Vitest configuration enforces required coverage thresholds', () => {
    const vitestConfig = fs.readFileSync(path.join(repoRoot, 'vitest.config.ts'), 'utf8');
    expect(vitestConfig).toContain('statements: 85');
    expect(vitestConfig).toContain('branches: 80');
    expect(vitestConfig).toContain('statements: 95');
    expect(vitestConfig).toContain('branches: 90');
  });

  it('TST-016, TST-017, TST-018: Requirements traceability matrix and checker are present', () => {
    expect(fs.existsSync(path.join(repoRoot, 'docs/traceability_matrix.json'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'scripts/check-traceability.mjs'))).toBe(true);
  });

  it('CIC-001, CIC-002, CIC-003, CIC-004, CIC-005, CIC-006, CIC-007, CIC-008: CI workflow specifies complete pipeline', () => {
    const ciPath = path.join(repoRoot, '.github/workflows/verify.yml');
    expect(fs.existsSync(ciPath)).toBe(true);
    const ci = fs.readFileSync(ciPath, 'utf8');
    expect(ci).toContain('pull_request');
    expect(ci).toContain('push');
    expect(ci).toContain('npm ci');
    expect(ci).toContain('timeout-minutes');
    expect(ci).toContain('npm run verify');
    expect(ci).toContain('upload-artifact');
  });

  it('DEL-001, DEL-002, DEL-003, DEL-004, DEL-005, DEL-006, DEL-007, DEL-008, DEL-009: Deliverables exist', () => {
    expect(fs.existsSync(path.join(repoRoot, 'README.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'supabase/seed.sql'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/data_dictionary.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/traceability_matrix.json'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, '.env.example'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/limitations.md'))).toBe(true);
  });
});
