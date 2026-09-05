import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import Link from 'next/link';
import {
  composeEveningBriefing,
  composeMorningBriefing,
  computeMomentum,
  isSeoulEvening,
  seoulDayStart,
  type CompetitorChange,
  type FounderDecision,
  type ProposalSummary,
} from '@mycorp24/business-logic';
import {
  closeFounderTask,
  countRecentWork,
  decideProposal,
  getCurrentCompany,
  listCompetitors,
  listOpenFounderTasks,
  listOpenProposals,
  listOpenTasks,
  listPendingApprovals,
  listUnreportedSignals,
} from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import SetupNotice from '../../components/SetupNotice';

/**
 * Morning briefing — spec §194.
 *
 * The page the founder opens first. It leads with what only they can decide,
 * then what the company did overnight, then what it noticed, then what it
 * proposes doing about it.
 *
 * Signals are deliberately *not* marked as reported by rendering this page.
 * Marking on read means a brief glanced at on a phone silently consumes the
 * only notice the founder was going to get.
 */

const dayssince = (iso: string): number =>
  Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);

/**
 * Morning or evening — decided by the clock, overridable by the founder.
 *
 * §195: the evening report is shorter because the founder is done for the day.
 * It was written and tested months ago and never rendered anywhere, so
 * "YOU CLOCK OUT. WE DON'T." was a claim with no screen behind it. The clock
 * itself lives in business-logic, where it can be tested.
 */

async function closeTask(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/briefing');

  const taskId = String(formData.get('taskId') ?? '');
  const status = String(formData.get('status') ?? '') === 'DROPPED' ? 'DROPPED' : 'DONE';

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  await closeFounderTask(db, current.companyId, taskId, status);
  revalidatePath('/briefing');
}

async function decide(formData: FormData) {
  'use server';
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/briefing');

  const proposalId = String(formData.get('proposalId') ?? '');
  const status = String(formData.get('status') ?? '') === 'DECLINED' ? 'DECLINED' : 'ACCEPTED';

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  await decideProposal(db, current.companyId, proposalId, status);
  revalidatePath('/briefing');
}

export default async function Briefing({
  searchParams,
}: {
  searchParams: Promise<{ when?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice what="보고" />;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/briefing');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  // "밤사이" means the last day, measured rather than assumed.
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString();

  const [approvals, founderTasks, signals, competitors, proposals, work, today, open] =
    await Promise.all([
    listPendingApprovals(db, current.companyId),
    listOpenFounderTasks(db, current.companyId),
    listUnreportedSignals(db, current.companyId),
    listCompetitors(db, current.companyId),
    listOpenProposals(db, current.companyId),
    countRecentWork(db, current.companyId, since),
    countRecentWork(db, current.companyId, seoulDayStart().toISOString()),
    listOpenTasks(db, current.companyId),
  ]);

  // The one problem worth naming in an evening report: work that stopped and
  // said why. Newest first, because that is the one still fresh.
  const stuck = open.find((t) => t.status === 'BLOCKED' && t.detail);

  const competitorName = new Map(competitors.map((c) => [c.id, c.name]));

  const decisions: FounderDecision[] = founderTasks.map((t) => ({
    title: t.title,
    whyFounder: t.why_founder,
    estimateMinutes: t.estimate_minutes,
    ...(t.blocks ? { blocks: t.blocks } : {}),
    ageDays: dayssince(t.created_at),
  }));

  const changes: CompetitorChange[] = signals.map((s) => ({
    competitor: competitorName.get(s.competitor_id) ?? '경쟁사',
    summary: s.summary,
    significance: s.significance,
  }));

  const proposalSummaries: ProposalSummary[] = proposals.map((p) => ({
    title: p.title,
    type: p.proposal_type,
    priority: p.priority,
    ...(p.expected_effect ? { expectedEffect: p.expected_effect } : {}),
  }));

  // Only components we can actually measure are passed in. computeMomentum
  // excludes the rest rather than scoring them zero (§166).
  const momentum = computeMomentum({
    approvalAgeHours: approvals.map(
      (a) => (Date.now() - Date.parse(a.created_at)) / 3_600_000,
    ),
  });

  const asked = (await searchParams).when;
  const evening = asked === 'evening' || (asked !== 'morning' && isSeoulEvening());

  const lines = evening
    ? composeEveningBriefing({
        founder: current.founder,
        // Today's work, counted from midnight in Seoul rather than from a
        // rolling 24 hours: "오늘" has to mean the founder's today.
        completed: today.completed,
        // Still open and not started today. Old work that is still open is the
        // thing an evening report exists to surface.
        delayed: open.filter((t) => Date.parse(t.created_at) < seoulDayStart().getTime()).length,
        // The problem is quoted from the work itself. Nothing here is inferred:
        // if no task recorded a reason, the report says nothing about problems.
        ...(stuck?.detail ? { problem: stuck.detail } : {}),
        founderTodo: founderTasks.length + approvals.length,
      })
    : composeMorningBriefing({
        founder: current.founder,
        pendingApprovals: approvals.length,
        founderDecisions: decisions,
        // Real counts. Zeroes were honest while nothing could do work; now they
        // would hide work the company actually finished overnight.
        agentTasksCompleted: work.completed,
        activeAgents: work.agents,
        blockedWork: work.blocked,
        competitorChanges: changes,
        proposals: proposalSummaries,
        momentum,
      });

  return (
    <main className="wrap" style={{ paddingBlock: '2.5rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>{current.companyName}</h1>
      <p className="rule-line" style={{ margin: '0 0 1.75rem' }}>
        AI prepares. &nbsp;Founder approves. &nbsp;Company executes.
      </p>

      <p style={{ margin: '0 0 1.25rem', fontSize: '0.87rem' }}>
        <strong>{evening ? '오늘 업무 보고' : '아침 보고'}</strong>{' '}
        <Link href={evening ? '/briefing?when=morning' : '/briefing?when=evening'}>
          {evening ? '아침 보고 보기' : '오늘 업무 보고 보기'}
        </Link>
      </p>

      <section className="brief">
        {lines.map((l, i) => (
          <p key={i} className={`brief-line ${l.kind.toLowerCase()}`}>
            {l.text}
          </p>
        ))}
      </section>

      {founderTasks.length > 0 && (
        <>
          <h2 className="section-head">회장님만 하실 수 있는 일</h2>
          <div className="cards" style={{ flexDirection: 'column' }}>
            {founderTasks.map((t) => (
              <article className="card" key={t.id} style={{ width: '100%' }}>
                <div className="card-label">약 {t.estimate_minutes}분</div>
                <div className="card-row">
                  <strong>{t.title}</strong>
                  <span className="mono">{dayssince(t.created_at)}일째</span>
                </div>
                <p style={{ margin: '0.3rem 0 0.6rem', color: 'var(--ink-soft)', fontSize: '0.87rem' }}>
                  {t.why_founder}
                  {t.blocks ? ` · ${t.blocks}이(가) 함께 지연되고 있습니다.` : ''}
                </p>
                <form action={closeTask} className="decision">
                  <input type="hidden" name="taskId" value={t.id} />
                  <button type="submit" name="status" value="DONE">
                    완료
                  </button>
                  <button type="submit" name="status" value="DROPPED" className="ghost">
                    안 함
                  </button>
                </form>
              </article>
            ))}
          </div>
        </>
      )}

      {proposals.length > 0 && (
        <>
          <h2 className="section-head">비서실장 제안</h2>
          <div className="cards" style={{ flexDirection: 'column' }}>
            {proposals.map((p) => (
              <article className="card" key={p.id} style={{ width: '100%' }}>
                <div className="card-label">
                  {p.proposal_type} · 우선순위 {p.priority}
                </div>
                <div className="card-row">
                  <strong>{p.title}</strong>
                </div>
                {p.background && (
                  <p style={{ margin: '0.3rem 0', color: 'var(--ink-soft)', fontSize: '0.87rem' }}>
                    {p.background}
                  </p>
                )}
                {p.recommendation && (
                  <p style={{ margin: '0.3rem 0 0.6rem', fontSize: '0.9rem' }}>
                    {p.recommendation}
                  </p>
                )}
                <form action={decide} className="decision">
                  <input type="hidden" name="proposalId" value={p.id} />
                  <button type="submit" name="status" value="ACCEPTED">
                    진행
                  </button>
                  <button type="submit" name="status" value="DECLINED" className="ghost">
                    보류
                  </button>
                </form>
              </article>
            ))}
          </div>
        </>
      )}

      {approvals.length > 0 && (
        <p style={{ marginTop: '2rem' }}>
          <Link className="cta" href="/approvals">
            결재 {approvals.length}건 보기
          </Link>
        </p>
      )}

      {founderTasks.length === 0 && proposals.length === 0 && approvals.length === 0 && (
        <p style={{ color: 'var(--ink-soft)', marginTop: '1.5rem', fontSize: '0.87rem' }}>
          아직 회사가 관찰할 데이터가 없습니다. 연결 센터에서 서비스를 연결하시면
          비서실장이 먼저 보고하기 시작합니다.
        </p>
      )}
    </main>
  );
}
