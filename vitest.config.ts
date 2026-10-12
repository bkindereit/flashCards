import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * Coverage gates implement FCA-SRS-001 exactly as written:
 * - TST-013: all first-party production code >= 85% statements / >= 80% branches.
 * - TST-012: scheduling, normalization, duplicate (CSV) and review-transaction modules
 *   each >= 95% statements / >= 90% branches.
 * - TST-014: any shortfall fails the run (and therefore `npm run verify`).
 * Only non-executable or bootstrap files are excluded; no production logic is excluded.
 */
const CORE = { statements: 95, branches: 90 };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testing/setupTests.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx', // bootstrap only
        'src/vite-env.d.ts',
        'src/testing/**', // test support code, not production
        '**/*.d.ts',
        'src/domain/types.ts', // type declarations only, no executable statements
        '**/*.test.{ts,tsx}'
      ],
      thresholds: {
        statements: 85,
        branches: 80,
        'src/domain/scheduler.ts': CORE,
        'src/domain/fsrsService.ts': CORE,
        'src/domain/normalization.ts': CORE,
        'src/domain/csvParser.ts': CORE,
        'src/hooks/useStudySession.ts': CORE
      }
    }
  }
});
