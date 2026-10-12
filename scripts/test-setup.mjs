#!/usr/bin/env node
/**
 * Local Test Environment Setup Orchestrator (TST-001, VA-TST-001)
 * 
 * Verifies local prerequisites, guards against production environments,
 * starts local Supabase stack, resets database with migrations and seed,
 * and prints schema checksum to guarantee repeatability.
 */

import { execSync } from 'child_process';
import crypto from 'crypto';

console.log('═══════════════════════════════════════════════════════════');
console.log(' Local Test Setup Orchestrator — FCA-VVP-001 / TST-001');
console.log('═══════════════════════════════════════════════════════════\n');

// 1. Canary guard: refuse to run if production project or URL detected (SEC-008, SEC-009)
const sensitiveEnvs = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
for (const envName of sensitiveEnvs) {
  const val = process.env[envName] || '';
  if (val && !val.includes('localhost') && !val.includes('127.0.0.1')) {
    console.error(`[SECURITY ERROR] Production-like URL or key detected in ${envName}: "${val}"`);
    console.error('test-setup is strictly prohibited from executing against non-local environments.');
    process.exit(1);
  }
}

// 2. Check for container runtime (Docker, Colima, or Podman)
let containerRuntime = null;
for (const runtime of ['docker', 'colima', 'podman']) {
  try {
    execSync(`which ${runtime}`, { stdio: 'ignore' });
    containerRuntime = runtime;
    break;
  } catch {
    // continue
  }
}

if (!containerRuntime) {
  console.error('✗ [PREREQUISITE BLOCKED] No container runtime found (Docker Desktop, Colima, or Podman).');
  console.error('  Please install a container runtime to start the local Supabase stack:');
  console.error('    macOS (Colima): brew install colima docker && colima start');
  console.error('    or Docker Desktop: https://www.docker.com/products/docker-desktop/');
  process.exit(2);
}

// Check if docker daemon is running
try {
  execSync('docker info', { stdio: 'ignore' });
} catch {
  console.error('✗ [PREREQUISITE BLOCKED] Container runtime daemon is not running.');
  console.error('  Please start Docker Desktop or run: colima start');
  process.exit(2);
}

// 3. Check for Supabase CLI
try {
  execSync('which supabase', { stdio: 'ignore' });
} catch {
  console.error('✗ [PREREQUISITE BLOCKED] Supabase CLI is not installed.');
  console.error('  Please install Supabase CLI:');
  console.error('    brew install supabase/tap/supabase');
  console.error('    or npm install -g supabase');
  process.exit(2);
}

console.log('✓ Container runtime and Supabase CLI found.');

// 4. Start local Supabase stack & reset database
try {
  console.log('→ Starting Supabase local stack (supabase start)...');
  execSync('supabase start', { stdio: 'inherit' });

  console.log('→ Applying migrations and seed fixtures (supabase db reset)...');
  execSync('supabase db reset', { stdio: 'inherit' });

  // 5. Compute schema checksum to verify idempotency (VA-TST-001)
  console.log('→ Verifying schema repeatability...');
  const schemaDump = execSync('supabase db dump --local --schema-only', { encoding: 'utf8' });
  const schemaHash = crypto.createHash('sha256').update(schemaDump).digest('hex');

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✓ Local test environment successfully created!');
  console.log(`  Schema SHA-256 Checksum: ${schemaHash}`);
  console.log('═══════════════════════════════════════════════════════════\n');
} catch (err) {
  console.error(`✗ Error setting up Supabase test environment: ${err.message}`);
  process.exit(1);
}
