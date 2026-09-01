import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getCurrentCompany, listCompetitors, listUnreportedSignals } from '@mycorp24/db';
import { isPrivateHost } from '@mycorp24/intelligence';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { runIntelligence } from '../../lib/intelligence';
import SetupNotice from '../../components/SetupNotice';

/**
 * Competitor watchlist — spec §157, §158.
 *
 * The founder names who to watch; the company watches them. Signals gathered
 * here feed the morning briefing and the proposal engine.
 */

async function addCompetitor(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/competitors');

  const name = String(formData.get('name') ?? '').trim();
  const websiteRaw = String(formData.get('website') ?? '').trim();
  if (!name) redirect('/competitors?error=name');

  // Validate here as well as in the watcher: a bad URL saved now is a failing
  // check every morning until someone notices.
  let website: string | null = null;
  if (websiteRaw) {
    try {
      const url = new URL(websiteRaw.startsWith('http') ? websiteRaw : `https://${websiteRaw}`);
      if (!['http:', 'https:'].includes(url.protocol) || isPrivateHost(url.hostname)) {
        redirect('/competitors?error=url');
      }
      website = url.toString();
    } catch {
      redirect('/competitors?error=url');
    }
  }

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  const res = await db.from('competitors').insert({
    company_id: current.companyId,
    name,
    ...(website ? { website } : {}),
  });
  if (res.error) redirect('/competitors?error=duplicate');

  revalidatePath('/competitors');
}

async function removeCompetitor(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/competitors');

  const id = String(formData.get('id') ?? '');
  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  await db.from('competitors').delete().eq('id', id).eq('company_id', current.companyId);
  revalidatePath('/competitors');
}

async function checkNow() {
  'use server';
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/competitors');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  await runIntelligence(db, current.companyId, current.companyName);
  revalidatePath('/competitors');
  revalidatePath('/briefing');
}

export default async function Competitors({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice what="경쟁사 관찰" />;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/competitors');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  const [competitors, signals] = await Promise.all([
    listCompetitors(db, current.companyId),
    listUnreportedSignals(db, current.companyId, 20),
  ]);
  const { error } = await searchParams;

  const signalsByCompetitor = new Map<string, typeof signals>();
  for (const s of signals) {
    const list = signalsByCompetitor.get(s.competitor_id) ?? [];
    list.push(s);
    signalsByCompetitor.set(s.competitor_id, list);
  }

  return (
    <main className="wrap" style={{ paddingBlock: '2.5rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>경쟁사</h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.75rem' }}>
        공개된 페이지만 확인합니다. 로그인하거나 보호장치를 우회하지 않습니다.
      </p>

      {error && (
        <p className="hint error" style={{ marginBottom: '1rem' }}>
          {error === 'name'
            ? '경쟁사 이름을 입력해 주십시오.'
            : error === 'url'
              ? '확인할 수 있는 공개 주소가 아닙니다.'
              : '이미 등록된 경쟁사입니다.'}
        </p>
      )}

      <form action={addCompetitor} className="decision" style={{ marginBottom: '1.5rem' }}>
        <input type="text" name="name" placeholder="경쟁사 이름" maxLength={80} required />
        <input type="text" name="website" placeholder="https://…  (선택)" maxLength={300} />
        <button type="submit">등록</button>
      </form>

      {competitors.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)' }}>
          아직 등록된 경쟁사가 없습니다. 등록하시면 매일 아침 변화를 확인해 보고드립니다.
        </p>
      ) : (
        <>
          <div className="cards" style={{ flexDirection: 'column' }}>
            {competitors.map((c) => {
              const found = signalsByCompetitor.get(c.id) ?? [];
              return (
                <article className="card" key={c.id} style={{ width: '100%' }}>
                  <div className="card-row">
                    <strong>{c.name}</strong>
                    <span className="mono">
                      {c.last_checked_at
                        ? new Date(c.last_checked_at).toLocaleDateString('ko-KR')
                        : c.website
                          ? '확인 전'
                          : '주소 없음'}
                    </span>
                  </div>
                  {c.website && (
                    <p style={{ margin: '0.2rem 0 0.5rem', fontSize: '0.82rem' }}>
                      <span className="mono">{c.website}</span>
                    </p>
                  )}
                  {found.length > 0 && (
                    <ul className="plain" style={{ marginBottom: '0.6rem' }}>
                      {found.map((s) => (
                        <li key={s.id} style={{ fontSize: '0.87rem' }}>
                          <span className="mono">[{s.significance}/5]</span> {s.summary}
                        </li>
                      ))}
                    </ul>
                  )}
                  <form action={removeCompetitor} className="decision">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="ghost">
                      관찰 중단
                    </button>
                  </form>
                </article>
              );
            })}
          </div>

          <form action={checkNow} style={{ marginTop: '1.5rem' }}>
            <button type="submit" className="cta" style={{ border: 0, cursor: 'pointer' }}>
              지금 확인
            </button>
          </form>
          <p style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
            매일 아침 자동으로 확인합니다. 위 버튼은 지금 한 번 더 돌립니다.
          </p>
        </>
      )}
    </main>
  );
}
