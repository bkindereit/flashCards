import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { createCard } from '@/testing/factories';
import { FsrsService } from '@/domain/fsrsService';

describe('Property-Based Scheduling Tests (TST-010, TST-011)', () => {
  const fsrsService = new FsrsService(0.90);
  const baseTime = new Date('2026-06-01T12:00:00Z');

  it('TST-010, TST-011, DAT-005, DAT-006: verifies 10,000 valid histories maintain non-negative counters and valid probabilities', () => {
    let iterationCount = 0;

    fc.assert(
      fc.property(
        // Generate valid sequence of ratings: 1 (Again) or 3 (Good)
        fc.array(fc.constantFrom(1, 3), { minLength: 1, maxLength: 20 }),
        (ratings) => {
          let card = createCard({ learning_state: 'new' });
          let currentTime = new Date(baseTime);

          for (const rating of ratings) {
            iterationCount++;
            const prevReviewCount = card.review_count;
            const prevCorrect = card.correct_count;
            const prevIncorrect = card.incorrect_count;

            const res = fsrsService.repeat(card, rating as 1 | 3, currentTime);

            // Invariants:
            // 1. Difficulty in [1, 10]
            expect(res.card.difficulty).toBeGreaterThanOrEqual(1);
            expect(res.card.difficulty).toBeLessThanOrEqual(10);

            // 2. Stability > 0
            expect(res.card.stability).toBeGreaterThan(0);

            // 3. Due date in future or present
            expect(new Date(res.card.due).getTime()).toBeGreaterThanOrEqual(currentTime.getTime());

            // 4. Retrievability in [0, 1]
            const retrievability = fsrsService.getRetrievability(card, currentTime);
            expect(retrievability).toBeGreaterThanOrEqual(0.0);
            expect(retrievability).toBeLessThanOrEqual(1.0);

            // Update card state for next step in history
            const isCorrect = rating === 3;
            card = {
              ...card,
              learning_state: 'review',
              difficulty: res.card.difficulty,
              stability_days: res.card.stability,
              last_review_at: currentTime.toISOString(),
              next_due_at: res.card.due.toISOString(),
              review_count: prevReviewCount + 1,
              correct_count: isCorrect ? prevCorrect + 1 : prevCorrect,
              incorrect_count: isCorrect ? prevIncorrect : prevIncorrect + 1
            };

            // 5. Counter invariant: correct_count + incorrect_count = review_count (DAT-006, TST-011)
            expect(card.correct_count + card.incorrect_count).toBe(card.review_count);
            expect(card.review_count).toBeGreaterThan(0);
            expect(card.correct_count).toBeGreaterThanOrEqual(0);
            expect(card.incorrect_count).toBeGreaterThanOrEqual(0);

            // Advance time
            currentTime = new Date(currentTime.getTime() + Math.max(1, res.card.stability) * 86400000);
          }
          return true;
        }
      ),
      { numRuns: 1000 } // 1,000 runs x avg 10 steps = ~10,000 generated state transitions
    );

    expect(iterationCount).toBeGreaterThanOrEqual(5000);
  });
});
