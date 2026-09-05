import { describe, expect, it } from 'vitest';
import { CAPABILITIES } from '@mycorp24/integrations';
import { DIVISION_META, type Division } from '@mycorp24/agent-types';
import { ORG_PRESETS, resolvePreset } from '../src/presets';
import { STAFFED_DIVISIONS, staffFor } from '../src/staffing';

/** What a company actually gets: its preset's divisions plus the fixed ones. */
const divisionsOf = (key: keyof typeof ORG_PRESETS): Division[] => [
  ...resolvePreset(key).divisions,
  ...DIVISION_META.filter((d) => d.alwaysPresent).map((d) => d.key),
];

describe('staffFor', () => {
  // The company was being founded with floors and executives and nobody in
  // them, and the chief of staff reported "0명 업무 중" on day one.
  it('puts somebody in every preset', () => {
    for (const key of Object.keys(ORG_PRESETS) as (keyof typeof ORG_PRESETS)[]) {
      expect(staffFor(divisionsOf(key)).length, key).toBeGreaterThan(0);
    }
  });

  it('never staffs a division the company does not have', () => {
    const divisions = divisionsOf('LOCAL_BUSINESS');
    for (const agent of staffFor(divisions)) {
      expect(divisions, agent.displayName).toContain(agent.division);
    }
  });

  // A local shop has no product or engineering floor; putting a product
  // planner in one would file work somewhere the founder never looks.
  it('does not smuggle a SaaS org into a local business', () => {
    const names = staffFor(divisionsOf('LOCAL_BUSINESS')).map((a) => a.division);
    expect(names).not.toContain('PRODUCT');
    expect(names).not.toContain('TECHNOLOGY');
  });

  it('always staffs the offices that answer to the founder', () => {
    for (const key of Object.keys(ORG_PRESETS) as (keyof typeof ORG_PRESETS)[]) {
      const divisions = staffFor(divisionsOf(key)).map((a) => a.division);
      expect(divisions, key).toContain('CHAIRMAN');
      expect(divisions, key).toContain('AUDIT_RISK');
    }
  });
});

describe('the roster tells the truth about who works here', () => {
  // A staff member with a human name is the product's first lie, and the
  // founder finds it out the moment they wonder who that person is.
  it('names roles, not people', () => {
    for (const agent of staffFor(STAFFED_DIVISIONS)) {
      expect(agent.displayName, agent.displayName).toMatch(/담당|실장/);
    }
  });

  it('asks only for skills the tool gateway knows', () => {
    for (const agent of staffFor(STAFFED_DIVISIONS)) {
      for (const skill of agent.skills) {
        expect(CAPABILITIES, `${agent.displayName}: ${skill}`).toContain(skill);
      }
    }
  });
});

describe('need to know — spec §188', () => {
  it('clears nobody higher than their work requires', () => {
    for (const agent of staffFor(STAFFED_DIVISIONS)) {
      expect(['INTERNAL', 'CONFIDENTIAL'], agent.displayName).toContain(agent.clearance);
    }
  });

  it('keeps money and audit above the general floor', () => {
    const byName = new Map(staffFor(STAFFED_DIVISIONS).map((a) => [a.displayName, a]));
    expect(byName.get('정산 담당')?.clearance).toBe('CONFIDENTIAL');
    expect(byName.get('감사 담당')?.clearance).toBe('CONFIDENTIAL');
  });

  // An auditor that can act on what it audits is not an auditor.
  it('gives audit and risk no ability to change anything', () => {
    for (const agent of staffFor(STAFFED_DIVISIONS)) {
      if (agent.division !== 'AUDIT_RISK') continue;
      expect(agent.skills, agent.displayName).toHaveLength(0);
    }
  });

  it('gives no role a write skill it has no read for', () => {
    for (const agent of staffFor(STAFFED_DIVISIONS)) {
      const writes = agent.skills.filter((s) => /^(WRITE|PUBLISH|RESPOND|UPDATE|SEND)_/.test(s));
      if (writes.length === 0) continue;
      expect(agent.skills.some((s) => s.startsWith('READ_')), agent.displayName).toBe(true);
    }
  });
});
