import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatAddress } from '@mycorp24/business-logic';
import { decideApproval, getCurrentCompany, listPendingApprovals } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { settleApproval } from '../../lib/handover';
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

  const approval = await decideApproval(db, {
    companyId: current.companyId,
    approvalId,
    userId: user.id,
    decision,
    ...(note ? { note } : {}),
  });

  // The decision is not the end of it. Work that waited on this approval is
  // closed out now — carried out if it can be, and told plainly why not if it
  // cannot. Leaving it in 결재 대기 would read as the company losing the work.
  const settlement = await settleApproval(db, {
    companyId: current.companyId,
    userId: user.id,
    approval,
    decision,
    ...(note ? { note } : {}),
  });

  revalidatePath('/approvals');
  revalidatePath('/work');

  // Say what the decision actually caused. Without this the item simply
  // disappears from the room, which is the same silence the settlement above
  // exists to remove — one screen higher up.
  redirect(`/approvals?settled=${settlement.kind}`);
}

/** What each ending means, in the founder's words. */
const SETTLED_KO: Record<string, string> = {
  EXECUTED: '승인하신 대로 처리했습니다. 업무 화면에서 확인하실 수 있습니다.',
  CANNOT_EXECUTE:
    '승인은 기록했습니다. 다만 회사가 대신 실행하지 못했습니다 — 업무 화면에 이유가 적혀 있습니다.',
  CANCELLED: '반려하셨습니다. 해당 업무는 취소했습니다.',
  NO_TASK: '결재를 처리했습니다.',
};

export default async function Approvals({
  searchParams,
}: {
  searchParams: Promise<{ settled?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice what="결재실" />;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/approvals');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  const pending = await listPendingApprovals(db, current.companyId);
  const settled = SETTLED_KO[(await searchParams).settled ?? ''];
  const addr = formatAddress(current.founder);
  const isFounder = current.role === 'FOUNDER';

  return (
    <main className="wrap" style={{ paddingBlock: '2.5rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>결재실</h1>
      <p className="rule-line" style={{ margin: '0 0 1.75rem' }}>
        AI prepares. &nbsp;Founder approves. &nbsp;Company executes.
      </p>

      {settled && (
        <p className="hint" style={{ margin: '0 0 1.25rem' }}>
          {settled} <Link href="/work">업무 보기</Link>
        </p>
      )}

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
