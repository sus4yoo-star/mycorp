import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatAddress } from '@mycorp24/business-logic';
import { decideApproval, getCurrentCompany, listPendingApprovals } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import SetupNotice from '../../components/SetupNotice';

/**
 * Executive approval room — spec §112, 12F 결재실.
 *
 * Only the founder decides. That is enforced by the database policy on
 * `approvals` (founder-only UPDATE), not by hiding the buttons: hiding a button
 * is a UI convenience, and this is a security boundary. The check below exists
 * to give a clear message, not to be the defence.
 *
 * Every decision appends an audit event (§220.4) so the internal audit office
 * can compare what was approved against what was executed (§209).
 */

async function decide(formData: FormData) {
  'use server';

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/approvals');

  const approvalId = String(formData.get('approvalId') ?? '');
  const decision = String(formData.get('decision') ?? '') === 'REJECT' ? 'REJECT' : 'APPROVE';
  const note = String(formData.get('note') ?? '').trim();

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  await decideApproval(db, {
    companyId: current.companyId,
    approvalId,
    userId: user.id,
    decision,
    ...(note ? { note } : {}),
  });

  revalidatePath('/approvals');
}

export default async function Approvals() {
  if (!isSupabaseConfigured()) return <SetupNotice what="결재실" />;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/approvals');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  const pending = await listPendingApprovals(db, current.companyId);
  const addr = formatAddress(current.founder);
  const isFounder = current.role === 'FOUNDER';

  return (
    <main className="wrap" style={{ paddingBlock: '2.5rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>결재실</h1>
      <p className="rule-line" style={{ margin: '0 0 1.75rem' }}>
        AI prepares. &nbsp;Founder approves. &nbsp;Company executes.
      </p>

      {pending.length === 0 ? (
        <p style={{ color: 'var(--ink-soft)' }}>
          {addr}, 지금 결재 대기 중인 안건은 없습니다.
        </p>
      ) : (
        <>
          <p style={{ color: 'var(--ink-soft)', marginTop: 0 }}>
            {addr}, 결재 대기 {pending.length}건입니다.
          </p>
          <div className="cards" style={{ flexDirection: 'column' }}>
            {pending.map((a) => (
              <article className="card" key={a.id} style={{ width: '100%' }}>
                <div className="card-label">{a.action}</div>
                <div className="card-row">
                  <strong>{a.title}</strong>
                  {a.amount !== null && (
                    <span className="mono">
                      {Number(a.amount).toLocaleString('ko-KR')}
                      {a.currency === 'KRW' ? '원' : ` ${a.currency ?? ''}`}
                    </span>
                  )}
                </div>
                <p style={{ margin: '0.35rem 0 0.75rem', color: 'var(--ink-soft)' }}>
                  {a.summary}
                </p>

                {isFounder ? (
                  <form action={decide} className="decision">
                    <input type="hidden" name="approvalId" value={a.id} />
                    <input
                      type="text"
                      name="note"
                      placeholder="수정 지시 (선택)"
                      aria-label="결재 의견"
                      maxLength={500}
                    />
                    <button type="submit" name="decision" value="APPROVE">
                      승인
                    </button>
                    <button type="submit" name="decision" value="REJECT" className="ghost">
                      반려
                    </button>
                  </form>
                ) : (
                  <p className="hint">결재는 회장님만 하실 수 있습니다.</p>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
