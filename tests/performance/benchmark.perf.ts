/**
 * Performance Benchmark Suite
 * Verifies PRF-001 (VA-PRF-001) and PRF-002 (VA-PRF-002)
 *
 * PRF-001: Next-card selection completes within 500 ms at p95 over >= 1,000 selections
 *           with 10,000 cards and 100,000 review events.
 * PRF-002: Preview and commit of valid 10,000-row CSV-014 each complete within 30 seconds.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { performance } from 'perf_hooks';
import { PGlite } from '@electric-sql/pglite';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import { parseAndPreviewCsv } from '@/domain/csvParser';
import { Card, SessionCardState } from '@/domain/types';
import { createDeck, createStudySession } from '@/testing/factories';

function calculatePercentiles(samples: number[]) {
  if (samples.length === 0) {
    throw new Error('Samples cannot be empty');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  const median = sorted[Math.floor(sorted.length * 0.5)]!;
  const p95 = sorted[Math.floor(sorted.length * 0.95)]!;
  const p99 = sorted[Math.floor(sorted.length * 0.99)]!;
  const sum = sorted.reduce((acc, val) => acc + val, 0);
  const avg = sum / sorted.length;
  return { min, median, p95, p99, max, avg, samples: sorted };
}

describe('Performance Benchmarks (PRF-001, PRF-002)', () => {
  it('VA-PRF-001: Next-card selection p95 <= 500 ms over 1,000 selections with 10k cards', () => {
    const deck = createDeck({ id: 'perf-deck-1', name: 'Large 10k Deck' });
    const session = createStudySession(deck.id, { id: 'perf-sess-1', duration_seconds: 1800 });

    const baseTime = new Date('2026-10-12T12:00:00Z');
    const cards: Card[] = [];
    const sessionStates = new Map<string, SessionCardState>();

    // Seed 10,000 cards representing ~100,000 aggregate review events
    for (let i = 0; i < 10000; i++) {
      const reviewCount = (i % 20) + 1; // 1 to 20 reviews per card, avg 10 => 100,000 reviews
      const isDue = i % 3 === 0;
      const isRelearning = i % 50 === 0;
      const state = isRelearning ? 'relearning' : (i % 5 === 0 ? 'new' : 'review');

      const card: Card = {
        id: `card-${i}`,
        user_id: deck.user_id,
        deck_id: deck.id,
        question_text: `Question #${i} testing algorithmic selection performance`,
        answer_text: `Answer #${i} testing response payload`,
        normalized_question: `Question #${i} testing algorithmic selection performance`,
        normalized_answer: `Answer #${i} testing response payload`,
        content_hash: `hash_${i.toString().padStart(8, '0')}`,
        learning_state: state,
        stability_days: 1.0 + (i % 30),
        difficulty: 5.0,
        last_review_at: new Date(baseTime.getTime() - 86400000 * 2).toISOString(),
        next_due_at: isDue ? new Date(baseTime.getTime() - 3600000).toISOString() : new Date(baseTime.getTime() + 86400000).toISOString(),
        algorithm_version: 'fsrs-v4',
        review_count: reviewCount,
        correct_count: Math.floor(reviewCount * 0.8),
        incorrect_count: Math.ceil(reviewCount * 0.2),
        lapse_count: Math.floor(reviewCount / 5),
        successful_relearning_sessions: 0,
        percent_correct: 80,
        source_order: i + 1,
        cohort_number: Math.floor(i / 10) + 1,
        importance_weight: 1.0,
        suspended_at: null,
        archived_at: null,
        first_imported_at: baseTime.toISOString(),
        created_at: baseTime.toISOString(),
        updated_at: baseTime.toISOString()
      };
      cards.push(card);
    }

    const engine = new SchedulerEngine(0.90);
    const ctx: SchedulerContext = {
      deck,
      session,
      allCards: cards,
      sessionStates,
      cumulativeNewLearningSeconds: 0,
      estimatedReviewSeconds: 15.0
    };

    // Warm-up: 50 selections
    for (let w = 0; w < 50; w++) {
      engine.selectNextCard(ctx);
    }

    // 1,000 measured selections
    const iterations = 1000;
    const measurements: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const selection = engine.selectNextCard(ctx);
      const elapsed = performance.now() - start;
      measurements.push(elapsed);
      expect(selection).not.toBeNull();
    }

    const stats = calculatePercentiles(measurements);

    const perfDir = path.resolve(process.cwd(), 'reports/performance');
    fs.mkdirSync(perfDir, { recursive: true });

    const benchmarkReport = {
      requirement: 'PRF-001',
      activity: 'VA-PRF-001',
      description: 'Next-card selection within 500 ms at p95 over >= 1,000 measured selections',
      environment: {
        os: `${os.platform()} ${os.release()} (${os.arch()})`,
        cpus: os.cpus()[0]?.model || 'Unknown CPU',
        totalMemoryBytes: os.totalmem(),
        nodeVersion: process.version
      },
      workload: {
        cardsCount: 10000,
        simulatedReviewsCount: 100000,
        warmupIterations: 50,
        measuredIterations: iterations
      },
      thresholdMs: 500.0,
      statistics: {
        minMs: Number(stats.min.toFixed(4)),
        medianMs: Number(stats.median.toFixed(4)),
        p95Ms: Number(stats.p95.toFixed(4)),
        p99Ms: Number(stats.p99.toFixed(4)),
        maxMs: Number(stats.max.toFixed(4)),
        avgMs: Number(stats.avg.toFixed(4))
      },
      passed: stats.p95 <= 500.0
    };

    fs.writeFileSync(
      path.join(perfDir, 'prf-001-selection.json'),
      JSON.stringify(benchmarkReport, null, 2),
      'utf8'
    );

    expect(stats.p95).toBeLessThanOrEqual(500.0);
  });

  it('VA-PRF-002: Preview and commit of 10,000-row CSV-014 each complete in <= 30 seconds', async () => {
    const csvPath = path.resolve(process.cwd(), 'tests/fixtures/csv/CSV-014.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    // 1. Preview Benchmark (5 iterations)
    // Warm-up preview
    await parseAndPreviewCsv(csvContent);

    const previewMeasurements: number[] = [];
    let lastPreviewResult: any = null;

    for (let i = 0; i < 5; i++) {
      const start = performance.now();
      lastPreviewResult = await parseAndPreviewCsv(csvContent);
      const elapsed = (performance.now() - start) / 1000.0; // seconds
      previewMeasurements.push(elapsed);
    }

    expect(lastPreviewResult.totalRows).toBe(10000);
    expect(lastPreviewResult.validRows.length).toBe(10000);
    expect(lastPreviewResult.rejectedRows.length).toBe(0);

    const previewStats = calculatePercentiles(previewMeasurements);
    expect(previewStats.max).toBeLessThanOrEqual(30.0);

    // 2. Commit Benchmark using PGlite in-memory database
    const db = new PGlite();
    await db.exec(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (id UUID PRIMARY KEY, email TEXT);
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
      BEGIN
        RETURN '11111111-1111-1111-1111-111111111111'::UUID;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const migrationSql = fs.readFileSync(
      path.resolve(process.cwd(), 'supabase/migrations/20261010000000_initial_schema.sql'),
      'utf8'
    );
    await db.exec(migrationSql);

    const userId = '11111111-1111-1111-1111-111111111111';
    const deckId = '22222222-2222-2222-2222-222222222222';

    await db.exec(`
      INSERT INTO auth.users (id, email) VALUES ('${userId}', 'perf@test.com');
      INSERT INTO public.decks (id, user_id, name) VALUES ('${deckId}', '${userId}', 'Perf Import Deck');
    `);

    const rowsPayload = JSON.stringify(lastPreviewResult.validRows.map((r: any, idx: number) => ({
      source_row_number: r.sourceRowNumber,
      question_text: r.question,
      answer_text: r.answer,
      normalized_question: r.normalizedQuestion,
      normalized_answer: r.normalizedAnswer,
      content_hash: r.contentHash,
      cohort_number: Math.floor(idx / 10) + 1,
      source_order: idx + 1
    })));

    const commitMeasurements: number[] = [];

    // Measure commit timing for 10,000 rows
    const commitStart = performance.now();
    await db.query(`
      SELECT * FROM public.rpc_commit_import(
        $1::UUID,
        $2::UUID,
        $3::TEXT,
        $4::INTEGER,
        $5::JSONB
      );
    `, [
      '33333333-3333-3333-3333-333333333333', // op id
      deckId,
      'CSV-014.csv',
      10000,
      rowsPayload
    ]);
    const commitElapsedSec = (performance.now() - commitStart) / 1000.0;
    commitMeasurements.push(commitElapsedSec);

    expect(commitElapsedSec).toBeLessThanOrEqual(30.0);
    const dbCountRes = await db.query('SELECT COUNT(*) as count FROM public.cards WHERE deck_id = $1;', [deckId]);
    expect(Number((dbCountRes.rows[0] as any).count)).toBe(10000);

    const perfDir = path.resolve(process.cwd(), 'reports/performance');
    const combinedReport = {
      requirement: 'PRF-002',
      activity: 'VA-PRF-002',
      description: 'Preview and commit of valid 10,000-row CSV-014 each <= 30 seconds',
      environment: {
        os: `${os.platform()} ${os.release()} (${os.arch()})`,
        cpus: os.cpus()[0]?.model || 'Unknown CPU',
        totalMemoryBytes: os.totalmem(),
        nodeVersion: process.version
      },
      previewSeconds: {
        samples: previewMeasurements.map(s => Number(s.toFixed(3))),
        min: Number(previewStats.min.toFixed(3)),
        median: Number(previewStats.median.toFixed(3)),
        p95: Number(previewStats.p95.toFixed(3)),
        max: Number(previewStats.max.toFixed(3)),
        thresholdSeconds: 30.0,
        passed: previewStats.max <= 30.0
      },
      commitSeconds: {
        samples: commitMeasurements.map(s => Number(s.toFixed(3))),
        durationSeconds: Number(commitElapsedSec.toFixed(3)),
        thresholdSeconds: 30.0,
        rowsCommitted: 10000,
        passed: commitElapsedSec <= 30.0
      },
      passed: previewStats.max <= 30.0 && commitElapsedSec <= 30.0
    };

    fs.writeFileSync(
      path.join(perfDir, 'prf-002-csv-import.json'),
      JSON.stringify(combinedReport, null, 2),
      'utf8'
    );

    // Also write master benchmark summary
    const prf001Data = JSON.parse(fs.readFileSync(path.join(perfDir, 'prf-001-selection.json'), 'utf8'));
    fs.writeFileSync(
      path.join(perfDir, 'benchmark.json'),
      JSON.stringify({
        generatedAt: new Date().toISOString(),
        prf001: prf001Data,
        prf002: combinedReport
      }, null, 2),
      'utf8'
    );
  });
});
