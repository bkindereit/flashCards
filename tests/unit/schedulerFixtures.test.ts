/**
 * Scheduler Canonical Fixtures Tests
 * Implements VA-SCH-002, VA-SCH-003, VA-SCH-004 using SCHF-001..SCHF-012
 */

import { describe, it, expect } from 'vitest';
import { createSchedulerFixture } from '@/testing/fixtures/scheduler';
import { SchedulerEngine, SchedulerContext } from '@/domain/scheduler';
import { SeededRandom } from '@/domain/clock';

describe('Scheduler Canonical Fixtures (FCA-VVP §10.2, SCHF-001..SCHF-012)', () => {
  it('SCHF-001: Ten unseen cards, selects from active cohort', () => {
    const fix = createSchedulerFixture('SCHF-001');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('active_cohort');
    expect(sel?.selectedCard.cohort_number).toBe(1);
    expect(sel?.selectedCard.learning_state).toBe('new');
  });

  it('SCHF-002: Failed learning card excluded because delay not met', () => {
    const fix = createSchedulerFixture('SCHF-002');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    // Failed learning card delay not met, and new cards blocked until active cohort graduates -> returns null
    expect(sel).toBeNull();
  });

  it('SCHF-003: Failed learning card selected when delay and intervening met', () => {
    const fix = createSchedulerFixture('SCHF-003');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.selectedCard.id).toBe(fix.allCards[0]?.id);
  });

  it('SCHF-004: Acquisition ceiling reached blocks new cohort cards', () => {
    const fix = createSchedulerFixture('SCHF-004');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    // Locked cohort 2 cannot be introduced; if review cards exist from cohort 1, they may be early reviewed
    if (sel) {
      expect(sel.selectedCard.cohort_number).toBe(1);
      expect(sel.selectedCard.cohort_number).not.toBe(2);
    }
  });

  it('SCHF-005: Manageable due pool prioritizes due review card', () => {
    const fix = createSchedulerFixture('SCHF-005');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('due_review');
    expect(sel?.selectedCard.id).toBe(fix.allCards[0]?.id);
  });

  it('SCHF-006: Due workload equal to remaining session selects due cards', () => {
    const fix = createSchedulerFixture('SCHF-006');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('due_review');
  });

  it('SCHF-007: Due workload suppresses new cards introduction', () => {
    const fix = createSchedulerFixture('SCHF-007');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('due_review');
    expect(sel?.selectedCard.learning_state).toBe('review');
  });

  it('SCHF-008: Mandatory overdue card takes priority over regular due card', () => {
    const fix = createSchedulerFixture('SCHF-008');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('mandatory_overdue');
    expect(sel?.selectedCard.id).toBe(fix.allCards[0]?.id);
  });

  it('SCHF-009: Equal utility tie candidates resolved deterministically with seed', () => {
    const fix = createSchedulerFixture('SCHF-009');
    const rng1 = new SeededRandom('fixed-seed-42');
    const engine1 = new SchedulerEngine(fix.deck.desired_retention, fix.clock, rng1);
    const sel1 = engine1.selectNextCard({ ...fix, random: rng1 });

    const rng2 = new SeededRandom('fixed-seed-42');
    const engine2 = new SchedulerEngine(fix.deck.desired_retention, fix.clock, rng2);
    const sel2 = engine2.selectNextCard({ ...fix, random: rng2 });

    expect(sel1).not.toBeNull();
    expect(sel2).not.toBeNull();
    expect(sel1?.selectedCard.id).toBe(sel2?.selectedCard.id);
  });

  it('SCHF-010: Exam in seven days selects card with highest retention benefit', () => {
    const fix = createSchedulerFixture('SCHF-010');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    // Weak card due with low stability gives higher expected gain before exam
    expect(sel?.selectedCard.id).toBe(fix.allCards[0]?.id);
  });

  it('SCHF-011: Suspended card excluded despite high utility', () => {
    const fix = createSchedulerFixture('SCHF-011');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    // High-utility card was index 0 and suspended; normal card (index 1) must be selected
    expect(sel?.selectedCard.id).toBe(fix.allCards[1]?.id);
  });

  it('SCHF-012: Relearning card takes highest priority above regular review', () => {
    const fix = createSchedulerFixture('SCHF-012');
    const engine = new SchedulerEngine(fix.deck.desired_retention, fix.clock);
    const ctx: SchedulerContext = { ...fix };
    const sel = engine.selectNextCard(ctx);
    expect(sel).not.toBeNull();
    expect(sel?.queue).toBe('relearning');
    expect(sel?.selectedCard.id).toBe(fix.allCards[0]?.id);
  });
});
