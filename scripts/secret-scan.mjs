#!/usr/bin/env node
/**
 * Secret and Canary Pattern Scanner (SEC-004)
 * Scans git-tracked files and dist/ build artifacts for leaked credentials,
 * production API keys, and service_role tokens.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SECRET_PATTERNS = [
  { name: 'Private Key', regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/ },
  { name: 'Stripe Secret Key', regex: /sk_live_[0-9a-zA-Z]{24}/ },
  { name: 'Generic Secret Token', regex: /(?:api_key|secret_key|private_key|auth_token)\s*[:=]\s*['"][A-Za-z0-9_\-]{32,}['"]/i },
  { name: 'Supabase Service Role JWT', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/ }
];

const IGNORE_PATTERNS = [
  /\.env\.example$/,
  /node_modules/,
  /\.git\//,
  /scripts\/secret-scan\.mjs$/,
  /docs\/decisions\.md$/,
  /Instructions\//
];

function getTrackedFiles() {
  try {
    const gitOutput = execSync('git ls-files', { encoding: 'utf8' });
    return gitOutput.split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function getDistFiles() {
  const distDir = path.resolve(process.cwd(), 'dist');
  if (!fs.existsSync(distDir)) return [];
  
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(path.relative(process.cwd(), fullPath));
      }
    }
  }
  walk(distDir);
  return files;
}

const allFiles = Array.from(new Set([...getTrackedFiles(), ...getDistFiles()]));
let findingsCount = 0;

console.log(`Scanning ${allFiles.length} files for secrets and canary credentials...`);

for (const relPath of allFiles) {
  if (IGNORE_PATTERNS.some(pat => pat.test(relPath))) continue;

  const fullPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(fullPath)) continue;

  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    continue; // binary files
  }

  const lines = content.split('\n');
  lines.forEach((line, lineIdx) => {
    for (const pat of SECRET_PATTERNS) {
      if (pat.regex.test(line)) {
        // Special check for Supabase JWT: allow if role is anon
        if (pat.name === 'Supabase Service Role JWT') {
          try {
            const parts = line.match(pat.regex)[0].split('.');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.role !== 'service_role') continue;
          } catch {
            // If cannot decode, treat as suspect
          }
        }
        console.error(`[CRITICAL] Leaked ${pat.name} detected in ${relPath}:${lineIdx + 1}`);
        findingsCount++;
      }
    }
  });
}

if (findingsCount > 0) {
  console.error(`\nSecret scan failed: ${findingsCount} suspect credential(s) detected.`);
  process.exit(1);
} else {
  console.log('✓ Secret scan passed: Zero credentials or private tokens detected.');
  process.exit(0);
}
