import { describe, expect, it } from 'vitest';
import { computeMomentum, momentumSentence } from '../src/momentum';

describe('computeMomentum — spec §166', () => {
  it('excludes what it cannot measure instead of scoring it zero', () => {
    const m = computeMomentum({ tasksCompleted: 8, tasksOpened: 10 });
    expect(m.components).toHaveLength(1);
    expect(m.missing).toContain('REVENUE_ACTIVITY');
    expect(m.missing).toContain('CONTENT_CADENCE');
    expect(m.score).toBe(80);
  });

  it('returns null rather than a number when nothing is measurable', () => {
    const m = computeMomentum({});
    expect(m.score).toBeNull();
    expect(momentumSentence(m)).toBeNull();
  });

  it('scores approval latency on the oldest item, not the average', () => {
    const oneStale = computeMomentum({ approvalAgeHours: [1, 1, 1, 1, 160] });
    const allFresh = computeMomentum({ approvalAgeHours: [1, 1, 1, 1, 1] });
    expect(oneStale.score).toBeLessThan(20);
    expect(allFresh.score).toBe(100);
  });

  it('treats no pending approvals as healthy, not as missing data', () => {
    const m = computeMomentum({ approvalAgeHours: [] });
    expect(m.score).toBe(100);
    expect(m.components[0]?.note).toContain('대기 중인 결재 없음');
  });

  it('does not punish a company for opening no tasks', () => {
    expect(computeMomentum({ tasksOpened: 0, tasksCompleted: 0 }).score).toBe(100);
  });

  it('labels the score without gamifying it', () => {
    expect(computeMomentum({ goalProgress: 0.95 }).label).toBe('고속');
    expect(computeMomentum({ goalProgress: 0.75 }).label).toBe('활발');
    expect(computeMomentum({ goalProgress: 0.55 }).label).toBe('보통');
    expect(computeMomentum({ goalProgress: 0.35 }).label).toBe('느림');
    expect(computeMomentum({ goalProgress: 0.05 }).label).toBe('정체');
  });

  it('never reports outside 0..100', () => {
    const wild = computeMomentum({
      goalProgress: 4,
      tasksCompleted: 900,
      tasksOpened: 1,
      daysSinceDataReview: 400,
    });
    expect(wild.score).toBeGreaterThanOrEqual(0);
    expect(wild.score).toBeLessThanOrEqual(100);
    for (const c of wild.components) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });

  it('names the weakest component when something is dragging', () => {
    const m = computeMomentum({ goalProgress: 0.9, approvalAgeHours: [200] });
    expect(momentumSentence(m)).toContain('가장 처진 항목');
  });

  it('stays quiet about weak points when nothing is weak', () => {
    const m = computeMomentum({ goalProgress: 0.9, approvalAgeHours: [1] });
    expect(momentumSentence(m)).not.toContain('가장 처진');
  });
});
