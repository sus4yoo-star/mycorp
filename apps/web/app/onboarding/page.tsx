import { redirect } from 'next/navigation';
import { ORG_PRESETS, type IndustryPreset } from '@mycorp24/business-logic';
import { foundCompany, getCurrentCompany } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import SetupNotice from '../../components/SetupNotice';

/**
 * Company founding — spec §167, §214.
 *
 * Three questions, no more. The founder is here to start a company, not to fill
 * in a form. Everything else the organization needs is seeded from the preset
 * and can be changed later (§215).
 */

const PRESETS: IndustryPreset[] = ['LOCAL_BUSINESS', 'CREATOR', 'SOLO_SAAS'];

async function create(formData: FormData) {
  'use server';

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/onboarding');

  const companyName = String(formData.get('companyName') ?? '').trim();
  const ownerDisplayName = String(formData.get('ownerDisplayName') ?? '').trim();
  const preferredTitle = String(formData.get('preferredTitle') ?? '회장님').trim();
  const rawPreset = String(formData.get('preset') ?? '');
  const preset: IndustryPreset = (PRESETS as string[]).includes(rawPreset)
    ? (rawPreset as IndustryPreset)
    : 'LOCAL_BUSINESS';

  if (!companyName || !ownerDisplayName) {
    redirect('/onboarding?error=missing');
  }

  const db = await getServerClient();
  await foundCompany(db, {
    userId: user.id,
    companyName,
    ownerDisplayName,
    preferredTitle: preferredTitle || '회장님',
    preset,
  });

  redirect('/hq');
}

export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice what="회사 설립" />;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/onboarding');

  const db = await getServerClient();
  const existing = await getCurrentCompany(db, user.id);
  if (existing) redirect('/hq');

  const { error } = await searchParams;

  return (
    <main className="wrap" style={{ paddingBlock: '3rem', maxWidth: '38rem' }}>
      <h1 style={{ fontSize: '1.7rem', margin: '0 0 0.4rem' }}>회사를 설립합니다</h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 2rem' }}>
        세 가지만 알려주시면 됩니다. 나머지는 비서실장이 준비합니다.
      </p>

      {error === 'missing' && (
        <p className="hint error" style={{ marginBottom: '1rem' }}>
          회사명과 성함을 입력해 주십시오.
        </p>
      )}

      <form action={create} className="chat" style={{ gap: '1.25rem' }}>
        <label className="field">
          <span>회사명</span>
          <input name="companyName" required maxLength={80} placeholder="예: 블루커피" />
        </label>

        <label className="field">
          <span>성함</span>
          <input name="ownerDisplayName" required maxLength={40} placeholder="예: 유상철" />
        </label>

        <label className="field">
          <span>어떻게 불러드릴까요?</span>
          <input name="preferredTitle" defaultValue="회장님" maxLength={20} />
          <small>회장님 · 대표님 · 사장님 · Founder · Boss — 언제든 바꿀 수 있습니다.</small>
        </label>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>업종</legend>
          <div className="suggestions" style={{ marginTop: '0.5rem' }}>
            {PRESETS.map((p, i) => (
              <label key={p} className="choice">
                <input type="radio" name="preset" value={p} defaultChecked={i === 0} />
                <span>{ORG_PRESETS[p].ko}</span>
              </label>
            ))}
          </div>
          <small>
            필요 없는 부서는 만들지 않습니다. 회사가 커지면 비서실장이 조직 신설을
            먼저 제안합니다.
          </small>
        </fieldset>

        <button type="submit" className="cta" style={{ border: 0, cursor: 'pointer' }}>
          설립하기
        </button>
      </form>
    </main>
  );
}
