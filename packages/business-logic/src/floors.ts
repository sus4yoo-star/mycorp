import {
  DIVISION_META,
  divisionMeta,
  type Division,
  type DivisionMeta,
} from '@mycorp24/agent-types';

/**
 * HQ floor resolution — spec §220.3.
 *
 * The tower is not a fixed 12 floors. Rules:
 *   1. `1F`–`9F`, `B1`, `B2` keep the same number in every company.
 *   2. `10F` and above are dynamic: only divisions the company actually has
 *      get a floor.
 *   3. The chairman floor is always the top floor, whatever its number.
 *   4. Audit & Risk sits directly below the chairman — but only gets a
 *      dedicated floor once the company has at least one conditional division
 *      (legal, infosec, technology, product, global, R&D, corporate affairs).
 *      In a small company it shares the chairman floor, which is what the
 *      12-floor default stack in spec 01 shows.
 */

export type FloorNumber = number | 'B1' | 'B2';

export interface Floor {
  readonly floor: FloorNumber;
  readonly label: string;
  /** True for the chairman floor. Rendered as `TOP` rather than a number. */
  readonly isTop: boolean;
  readonly divisions: readonly DivisionMeta[];
}

/** Divisions that only exist when the company has grown into them. */
const CONDITIONAL_UPPER: readonly Division[] = [
  'LEGAL',
  'INFOSEC',
  'TECHNOLOGY',
  'PRODUCT',
  'GLOBAL',
  'RND',
  'CORPORATE_AFFAIRS',
];

const isFixed = (m: DivisionMeta): boolean => m.fixedFloor !== null;

/**
 * @param present divisions the company has. Always-present divisions are added
 *                automatically, so a caller may pass only what it configured.
 */
export function resolveFloorStack(present: Iterable<Division>): Floor[] {
  const set = new Set<Division>(present);
  for (const m of DIVISION_META) if (m.alwaysPresent) set.add(m.key);

  const hasConditionalUpper = CONDITIONAL_UPPER.some((d) => set.has(d));
  const mergeAuditIntoChairman = !hasConditionalUpper;
  if (mergeAuditIntoChairman) set.delete('AUDIT_RISK');

  // DIVISION_META is ordered top-down. Dynamic floors are numbered from the
  // bottom of the dynamic group upward, starting at 10.
  const dynamic = DIVISION_META.filter((m) => !isFixed(m) && set.has(m.key));
  const numbered = new Map<Division, number>();
  let n = 10;
  for (let i = dynamic.length - 1; i >= 0; i -= 1) {
    numbered.set(dynamic[i]!.key, n);
    n += 1;
  }

  const floors: Floor[] = [];

  for (const m of dynamic) {
    const divisions = [m];
    if (m.key === 'CHAIRMAN' && mergeAuditIntoChairman) {
      divisions.push(divisionMeta('AUDIT_RISK'));
    }
    floors.push({
      floor: numbered.get(m.key)!,
      label: m.en,
      isTop: m.key === 'CHAIRMAN',
      divisions,
    });
  }

  for (const m of DIVISION_META) {
    if (!isFixed(m) || !set.has(m.key)) continue;
    floors.push({ floor: m.fixedFloor!, label: m.en, isTop: false, divisions: [m] });
  }

  return floors;
}

const RANK: Record<string, number> = { B1: -1, B2: -2 };
const rank = (f: FloorNumber): number => (typeof f === 'number' ? f : RANK[f]!);

/** Top floor first, basements last — the order the building is drawn in. */
export const sortTopDown = (floors: readonly Floor[]): Floor[] =>
  [...floors].sort((a, b) => rank(b.floor) - rank(a.floor));

/** `20F` / `B1` / `TOP` — spec §220.3 renders the chairman floor as TOP. */
export const formatFloor = (f: Floor): string =>
  f.isTop ? 'TOP' : typeof f.floor === 'number' ? `${f.floor}F` : f.floor;
