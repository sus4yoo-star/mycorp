import Link from 'next/link';
import type { Division } from '@mycorp24/agent-types';
import {
  ORG_PRESETS,
  formatFloor,
  resolveFloorStack,
  resolvePreset,
  sortTopDown,
  type IndustryPreset,
} from '@mycorp24/business-logic';

/**
 * HQ building view.
 *
 * The floor numbers are not hardcoded. They come from `resolveFloorStack`,
 * which implements spec §220.3: 1F-9F, B1 and B2 are fixed, 10F and above are
 * dynamic, and the chairman floor is always the top floor. Switching preset
 * below shows the tower growing — the point of §136 and §214.
 */

const PRESET_ORDER: IndustryPreset[] = ['LOCAL_BUSINESS', 'CREATOR', 'SOLO_SAAS'];

const isPreset = (v: string | undefined): v is IndustryPreset =>
  v !== undefined && (PRESET_ORDER as string[]).includes(v);

export default async function HQ({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string }>;
}) {
  const { preset: raw } = await searchParams;
  const key: IndustryPreset = isPreset(raw) ? raw : 'LOCAL_BUSINESS';
  const preset = resolvePreset(key);
  const floors = sortTopDown(resolveFloorStack(preset.divisions as Division[]));

  return (
    <main className="wrap" style={{ paddingBlock: '3rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>본사</h1>
      <p className="rule-line" style={{ margin: '0 0 2rem' }}>
        {floors.length}개 층 · 임원 {preset.executives.length}명
        {preset.specialists.length > 0
          ? ` · Specialist ${preset.specialists.length}`
          : ''}
      </p>

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

      <table className="floors">
        <thead>
          <tr>
            <th>층</th>
            <th>Division</th>
            <th>부서</th>
          </tr>
        </thead>
        <tbody>
          {floors.map((f) => (
            <tr key={String(f.floor)} className={f.isTop ? 'top' : undefined}>
              <td className="num">{formatFloor(f)}</td>
              <td>{f.divisions.map((d) => d.en).join(' · ')}</td>
              <td className="ko">{f.divisions.map((d) => d.ko).join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
        층수는 회사마다 다릅니다. 1F–9F와 B1·B2는 어떤 회사에서도 번호가 같고,
        10F 이상은 회사가 임명한 임원 수만큼 존재합니다. 회장실은 층 번호와
        무관하게 언제나 최상층입니다.
      </p>
    </main>
  );
}
