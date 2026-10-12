/**
 * Targeted FsrsService branch coverage tests
 * Covers: toFsrsCard branches, toFsrsState, safeGetR !last_review path
 */

import { describe, it, expect } from 'vitest';
import { toFsrsCard, toFsrsState, FsrsService } from '@/domain/fsrsService';
import { createCard } from '@/testing/factories';

const baseTime = new Date('2026-06-01T12:00:00Z');

describe('toFsrsState', () => {
  it('maps new', () => { expect(toFsrsState('new')).toBe(0); });
  it('maps learning', () => { expect(toFsrsState('learning')).toBe(1); });
  it('maps review', () => { expect(toFsrsState('review')).toBe(2); });
  it('maps relearning', () => { expect(toFsrsState('relearning')).toBe(3); });
  it('maps unknown to New (0)', () => { expect(toFsrsState('suspended')).toBe(0); });
});

describe('toFsrsCard branches', () => {
  it('returns empty card for new card with zero reviews', () => {
    const card = createCard({ learning_state: 'new', review_count: 0 });
    const result = toFsrsCard(card, baseTime);
    expect(result.reps).toBe(0);
  });

  it('uses derived lastReview when last_review_at is absent but review_count > 0', () => {
    const card = createCard({
      learning_state: 'review',
      review_count: 3,
      stability_days: 7.0,
      last_review_at: undefined,
      next_due_at: baseTime.toISOString()
    });
    const result = toFsrsCard(card, baseTime);
    // last_review derived = due - stability_days = 7 days before baseTime
    // so elapsed_days ≈ 7
    expect(result.elapsed_days).toBeCloseTo(7, 0);
  });

  it('uses now when next_due_at is absent', () => {
    const card = createCard({
      learning_state: 'review',
      review_count: 1,
      stability_days: 3.0,
      last_review_at: new Date(baseTime.getTime() - 3 * 86400000).toISOString(),
      next_due_at: undefined
    });
    const result = toFsrsCard(card, baseTime);
    expect(result.due.getTime()).toBe(baseTime.getTime());
  });

  it('sets elapsed_days=0 when lastReview is undefined', () => {
    // new card with review_count 0 goes through createEmptyCard path
    const card = createCard({ learning_state: 'new', review_count: 0 });
    const result = toFsrsCard(card, baseTime);
    expect(result.elapsed_days).toBe(0);
  });
});

describe('FsrsService: safeGetR !last_review branch', () => {
  it('calculateUtility returns finite result for new card with no history', () => {
    const svc = new FsrsService(0.90);
    const card = createCard({ learning_state: 'new' });
    const result = svc.calculateUtility(card, baseTime, null, 15);
    expect(isFinite(result.base_utility)).toBe(true);
    expect(result.r_now).toBe(1.0);
  });

  it('calculateUtility with past exam date uses 1-year horizon', () => {
    const svc = new FsrsService(0.90);
    const pastExam = new Date(baseTime.getTime() - 86400000); // yesterday
    const card = createCard({
      learning_state: 'review',
      stability_days: 5.0,
      last_review_at: new Date(baseTime.getTime() - 5 * 86400000).toISOString(),
      next_due_at: baseTime.toISOString()
    });
    const result = svc.calculateUtility(card, baseTime, pastExam, 15);
    // Should use 1-year horizon since exam is in the past
    const oneYear = new Date(baseTime.getTime() + 365 * 86400000);
    expect(result.horizon.getTime()).toBeCloseTo(oneYear.getTime(), -5);
  });
});
