import Link from 'next/link';
import type { Division } from '@mycorp24/agent-types';
import {
  ORG_PRESETS,
  formatAddress,
  formatFloor,
  resolveFloorStack,
  resolvePreset,
  sortTopDown,
  type IndustryPreset,
} from '@mycorp24/business-logic';
import {
  getCurrentCompany,
  listAgents,
  listDivisions,
  listPendingApprovals,
  staffCompany,
  type AgentRow,
} from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';

/**
 * HQ building view.
 *
 * Floor numbers are computed by `resolveFloorStack` (spec §220.3), never
 * hardcoded: 1F-9F, B1 and B2 are fixed, 10F and above are dynamic, and the
 * chairman floor is always the top.
 *
 * With Supabase configured and a founder signed in this renders their real
 * organization. Without it, the preset switcher shows how the tower grows —
 * labelled as a preview so nobody mistakes it for their company.
 */

const PRESET_ORDER: IndustryPreset[] = ['LOCAL_BUSINESS', 'CREATOR', 'SOLO_SAAS'];

const isPreset = (v: string | undefined): v is IndustryPreset =>
  v !== undefined && (PRESET_ORDER as string[]).includes(v);

interface View {
  readonly title: string;
  readonly divisions: Division[];
  readonly subtitle: string;
  readonly live: boolean;
  /** Staff by division. Empty for the preview: a preview has no employees. */
  readonly staff: ReadonlyMap<string, readonly AgentRow[]>;
}

const byDivision = (agents: readonly AgentRow[]): ReadonlyMap<string, readonly AgentRow[]> => {
  const map = new Map<string, AgentRow[]>();
  for (const a of agents) {
    const list = map.get(a.division_key) ?? [];
    list.push(a);
    map.set(a.division_key, list);
  }
  return map;
};

async function load(preset: IndustryPreset): Promise<View> {
  if (isSupabaseConfigured()) {
    const user = await getSessionUser();
    if (user) {
      const db = await getServerClient();
      const current = await getCurrentCompany(db, user.id);
      if (current) {
        const [divisions, pending] = await Promise.all([
          listDivisions(db, current.companyId),
          listPendingApprovals(db, current.companyId),
        ]);

        // Companies founded before there was a roster have floors and nobody in
        // them, and the roster grows as the product does. This is idempotent —
        // it hires only what is missing — so the organisation on screen is the
        // one the company is entitled to rather than the one it happened to get
        // on the day it was founded.
        await staffCompany(db, current.companyId, divisions);
        const agents = await listAgents(db, current.companyId);

        const addr = formatAddress(current.founder);
        const waiting =
          pending.length > 0
            ? `결재 대기 ${pending.length}건`
            : '결재 대기 없음';
        return {
          title: current.companyName,
          divisions,
          subtitle: `${addr}, 직원 ${agents.length}명 · ${waiting}입니다.`,
          live: true,
          staff: byDivision(agents),
        };
      }
    }
  }

  const p = resolvePreset(preset);
  return {
    title: '본사',
    divisions: [...p.divisions],
    subtitle: `${p.ko} · 임원 ${p.executives.length}명`,
    live: false,
    staff: new Map(),
  };
}

export default async function HQ({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset: raw } = await searchParams;
  const key: IndustryPreset = isPreset(raw) ? raw : 'LOCAL_BUSINESS';
  const view = await load(key);
  const floors = sortTopDown(resolveFloorStack(view.divisions));

  return (
    <main className="wrap" style={{ paddingBlock: '3rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>{view.title}</h1>
      <p className="rule-line" style={{ margin: '0 0 0.4rem' }}>
        {floors.length}개 층
      </p>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 2rem' }}>{view.subtitle}</p>

      {!view.live && (
        <div className="switcher">
          {PRESET_ORDER.map((p) => (
            <Link
              key={p}
              href={`/hq?preset=${p}`}
              aria-current={p === key ? 'page' : undefined}
            >
              {ORG_PRESETS[p].ko}
            </Link>
          ))}
        </div>
      )}

      <table className="floors">
        <thead>
          <tr>
            <th>층</th>
            <th>Division</th>
            <th>부서</th>
            {view.live && <th>담당</th>}
          </tr>
        </thead>
        <tbody>
          {floors.map((f) => (
            <tr key={String(f.floor)} className={f.isTop ? 'top' : undefined}>
              <td className="num">{formatFloor(f)}</td>
              <td>{f.divisions.map((d) => d.en).join(' · ')}</td>
              <td className="ko">{f.divisions.map((d) => d.ko).join(' · ')}</td>
              {view.live && (
                <td className="ko">
                  {f.divisions
                    .flatMap((d) => view.staff.get(d.key) ?? [])
                    .map((a) => a.display_name)
                    .join(' · ') || '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
        {view.live
          ? '층수는 회사마다 다릅니다. 부서가 신설되면 층이 삽입되고 타워가 자랍니다. 회장실은 언제나 최상층입니다.'
          : '미리보기입니다. 업종을 바꾸면 타워가 달라집니다. 로그인하시면 실제 회사의 본사가 표시됩니다.'}
      </p>
    </main>
  );
}
