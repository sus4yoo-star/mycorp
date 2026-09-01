import { describe, expect, it } from 'vitest';
import type { Division } from '@mycorp24/agent-types';
import { formatFloor, resolveFloorStack, sortTopDown } from '../src/floors';

const numberOf = (floors: ReturnType<typeof resolveFloorStack>, key: Division) =>
  floors.find((f) => f.divisions.some((d) => d.key === key))?.floor;

const DEFAULT_STACK: Division[] = [
  'EXECUTIVE_STRATEGY',
  'MARKETING',
  'SALES',
  'DATA',
  'OPERATIONS',
  'FINANCE',
  'PEOPLE',
  'CUSTOMER_EXPERIENCE',
  'CREATIVE',
];

const FULL_STACK: Division[] = [
  ...DEFAULT_STACK,
  'LEGAL',
  'INFOSEC',
  'TECHNOLOGY',
  'PRODUCT',
  'GLOBAL',
  'RND',
  'CORPORATE_AFFAIRS',
];

describe('resolveFloorStack — spec §220.3', () => {
  it('reproduces the 12-floor default stack from spec 01', () => {
    const floors = resolveFloorStack(DEFAULT_STACK);
    expect(numberOf(floors, 'CHAIRMAN')).toBe(12);
    expect(numberOf(floors, 'EXECUTIVE_STRATEGY')).toBe(11);
    expect(numberOf(floors, 'EXECUTIVE_BOARD')).toBe(10);
  });

  it('reproduces the 20-floor full enterprise stack', () => {
    const floors = resolveFloorStack(FULL_STACK);
    expect(numberOf(floors, 'CHAIRMAN')).toBe(20);
    expect(numberOf(floors, 'AUDIT_RISK')).toBe(19);
    expect(numberOf(floors, 'EXECUTIVE_STRATEGY')).toBe(18);
    expect(numberOf(floors, 'EXECUTIVE_BOARD')).toBe(17);
    expect(numberOf(floors, 'CORPORATE_AFFAIRS')).toBe(10);
  });

  it('keeps 1F-9F, B1 and B2 numbered identically in both stacks', () => {
    const small = resolveFloorStack(DEFAULT_STACK);
    const big = resolveFloorStack(FULL_STACK);
    for (const key of ['MARKETING', 'SALES', 'DATA', 'OPERATIONS', 'FINANCE', 'PEOPLE', 'CUSTOMER_EXPERIENCE', 'CREATIVE', 'LOBBY', 'AI_INFRASTRUCTURE', 'DATA_VAULT'] as Division[]) {
      expect(numberOf(small, key)).toBe(numberOf(big, key));
    }
    expect(numberOf(big, 'MARKETING')).toBe(9);
    expect(numberOf(big, 'LOBBY')).toBe(1);
    expect(numberOf(big, 'AI_INFRASTRUCTURE')).toBe('B1');
    expect(numberOf(big, 'DATA_VAULT')).toBe('B2');
  });

  it('puts the chairman on the top floor no matter the size', () => {
    for (const stack of [[], DEFAULT_STACK, FULL_STACK]) {
      const floors = sortTopDown(resolveFloorStack(stack as Division[]));
      expect(floors[0]?.isTop).toBe(true);
      expect(formatFloor(floors[0]!)).toBe('TOP');
      expect(floors.filter((f) => f.isTop)).toHaveLength(1);
    }
  });

  it('always creates the chief of staff, audit and risk offices', () => {
    const floors = resolveFloorStack([]);
    const keys = floors.flatMap((f) => f.divisions.map((d) => d.key));
    expect(keys).toContain('CHAIRMAN');
    expect(keys).toContain('AUDIT_RISK');
    expect(keys).toContain('DATA_VAULT');
  });

  it('merges audit into the chairman floor only until a conditional division appears', () => {
    const small = resolveFloorStack(DEFAULT_STACK);
    const chairman = small.find((f) => f.isTop)!;
    expect(chairman.divisions.map((d) => d.key)).toContain('AUDIT_RISK');

    const grown = resolveFloorStack([...DEFAULT_STACK, 'LEGAL']);
    const grownChairman = grown.find((f) => f.isTop)!;
    expect(grownChairman.divisions.map((d) => d.key)).not.toContain('AUDIT_RISK');
    expect(numberOf(grown, 'AUDIT_RISK')).toBe(Number(numberOf(grown, 'CHAIRMAN')) - 1);
  });

  it('shifts upper floors by one when a division is inserted', () => {
    const before = resolveFloorStack(DEFAULT_STACK);
    const after = resolveFloorStack([...DEFAULT_STACK, 'INFOSEC']);
    expect(numberOf(after, 'INFOSEC')).toBe(10);
    expect(Number(numberOf(after, 'EXECUTIVE_BOARD'))).toBe(Number(numberOf(before, 'EXECUTIVE_BOARD')) + 1);
    // Chairman rose by two: one for infosec, one for audit leaving its floor.
    expect(Number(numberOf(after, 'CHAIRMAN'))).toBe(Number(numberOf(before, 'CHAIRMAN')) + 2);
  });

  it('never assigns a dynamic floor below 10', () => {
    const floors = resolveFloorStack(FULL_STACK);
    for (const f of floors) {
      const dynamic = f.divisions.every((d) => d.fixedFloor === null);
      if (dynamic) expect(Number(f.floor)).toBeGreaterThanOrEqual(10);
    }
  });
});

describe('worked example from spec §220.3', () => {
  it('appointing a CISO adds a floor and splits audit off the chairman floor', () => {
    const before = resolveFloorStack(DEFAULT_STACK);
    const after = resolveFloorStack([...DEFAULT_STACK, 'INFOSEC']);

    expect(numberOf(before, 'CHAIRMAN')).toBe(12);

    expect(numberOf(after, 'INFOSEC')).toBe(10);
    expect(numberOf(after, 'EXECUTIVE_BOARD')).toBe(11);
    expect(numberOf(after, 'EXECUTIVE_STRATEGY')).toBe(12);
    expect(numberOf(after, 'AUDIT_RISK')).toBe(13);
    expect(numberOf(after, 'CHAIRMAN')).toBe(14);
  });
});
