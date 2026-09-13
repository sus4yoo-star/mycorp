import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { divisionMeta, type Division } from '@mycorp24/agent-types';
import { formatAddress } from '@mycorp24/business-logic';
import {
  appendAuditEvent,
  getCurrentCompany,
  listFinishedTasks,
  listOpenTasks,
  resolveBlockedTask,
  type TaskRow,
} from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { runInstruction } from '../../lib/work';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import SetupNotice from '../../components/SetupNotice';

/**
 * What the company is doing — spec §164.
 *
 * Work that only exists inside a chat transcript is work the founder has to
 * remember to look for. This is the page that answers "무슨 일이 되고 있나"
 * without asking anyone.
 *
 * Blocked work is shown first and says why. A company that quietly drops what
 * it could not do is worse than one that never started: the founder believes it
 * is in hand.
 */

const STATUS_KO: Record<TaskRow['status'], string> = {
  TODO: '대기',
  IN_PROGRESS: '작성 중',
  AWAITING_APPROVAL: '결재 대기',
  BLOCKED: '중단',
  DONE: '완료',
  CANCELLED: '취소',
};

const divisionKo = (key: string | null): string => {
  if (!key) return '—';
  try {
    return divisionMeta(key as Division).ko.split('·')[0] ?? key;
  } catch {
    return key;
  }
};

const when = (iso: string): string =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * The founder disposes of work the company could not finish.
 *
 * Without this a blocked task stays in 진행 중 for good and the count on this
 * page slowly stops meaning anything. Both endings are the founder's to
 * declare, and both are recorded — including "제가 했습니다", which is a fact
 * the company should know about its own founder's day (§209).
 */
async function resolve(formData: FormData) {
  'use server';

  // Every exit below either does the thing or says why. A bare `return` here
  // means the founder clicks and nothing happens, with nothing on screen —
  // indistinguishable from the button being broken.
  const user = await getSessionUser();
  if (!user) redirect('/login?next=/work');

  const taskId = String(formData.get('taskId') ?? '');
  const outcome = String(formData.get('outcome') ?? '') === 'HANDLED' ? 'HANDLED' : 'DROPPED';

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  const detail =
    outcome === 'HANDLED' ? '회장님이 직접 처리하셨습니다.' : '회장님이 접으셨습니다.';
  const settled = await resolveBlockedTask(db, {
    taskId,
    companyId: current.companyId,
    outcome,
    detail,
  });

  await appendAuditEvent(db, {
    companyId: current.companyId,
    actor: user.id,
    action: `WORK:FOUNDER:${outcome}`,
    // ALLOWED, not EXECUTED: the company executed nothing here. Either the
    // founder did it themselves or they dropped it, and both are decisions the
    // audit office should be able to tell apart from work the company did.
    outcome: 'ALLOWED',
    // The task's name, because this field is read as a reason. It held the
    // uuid, which tells whoever reads the trail nothing at all.
    reason: `${settled.title} — ${detail}`,
  });

  revalidatePath('/work');
}

/**
 * Give the same instruction again.
 *
 * A task blocked on "GMAIL이 연결되어 있지 않습니다" stays blocked after the
 * founder connects Gmail, because nothing re-reads it. Rather than inventing a
 * resume mechanism, this does what the founder would do: says the same thing
 * again, to a company that can now do more than it could. The old task is
 * cancelled so the same work is not counted twice.
 */
async function retry(formData: FormData) {
  'use server';

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/work');

  const taskId = String(formData.get('taskId') ?? '');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  // The instruction comes from the task row, not from a hidden input. The id
  // is company-scoped; the text was not, so the client could have sent any
  // instruction — and a paid model call — while the audit trail recorded
  // "회장님이 다시 지시하셨습니다" about the original.
  const original = (await listOpenTasks(db, current.companyId)).find((t) => t.id === taskId);
  const instruction = original?.instruction?.trim();
  if (!instruction) redirect('/work?error=gone');

  // Order matters. Cancelling first and then failing to place the work would
  // delete the only record that the founder ever asked for it — the exact
  // disappearance this screen exists to prevent. The old task is closed only
  // once a new one exists to carry the instruction.
  const outcome = await runInstruction(
    db,
    {
      companyId: current.companyId,
      companyName: current.companyName,
      address: formatAddress(current.founder),
    },
    instruction,
  );

  if (outcome.kind === 'DRAFTED' || outcome.kind === 'BLOCKED') {
    await resolveBlockedTask(db, {
      taskId,
      companyId: current.companyId,
      outcome: 'DROPPED',
      detail: '회장님이 다시 지시하셨습니다.',
    });
  }

  revalidatePath('/work');
}

function Task({ task }: { task: TaskRow }) {
  return (
    <div className="card" style={{ marginBottom: '0.75rem' }}>
      <div className="card-label">
        {STATUS_KO[task.status]} · {divisionKo(task.division_key)} · {when(task.created_at)}
      </div>
      <div className="card-row" style={{ fontWeight: 600 }}>{task.title}</div>

      {task.instruction && (
        <p className="hint" style={{ margin: '0.35rem 0 0' }}>
          지시: {task.instruction}
        </p>
      )}

      {/* How it ended, in the words that were recorded — approved and carried
          out, approved and stuck, or turned down. Showing only the blocked
          case left an approved-but-undeliverable task looking like a success. */}
      {task.detail && task.status !== 'AWAITING_APPROVAL' && (
        <p
          className={task.status === 'DONE' ? 'hint' : 'hint error'}
          style={{ margin: '0.5rem 0 0' }}
        >
          {task.detail}
        </p>
      )}

      {task.deliverable && (
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            margin: '0.75rem 0 0',
            font: 'inherit',
            color: 'var(--ink)',
          }}
        >
          {task.deliverable}
        </pre>
      )}

      {task.status === 'BLOCKED' && (
        <form action={resolve} className="decision" style={{ marginTop: '0.75rem' }}>
          <input type="hidden" name="taskId" value={task.id} />
          <button type="submit" name="outcome" value="HANDLED" className="ghost">
            제가 직접 처리했습니다
          </button>
          <button type="submit" name="outcome" value="DROPPED" className="ghost">
            이 건은 접겠습니다
          </button>
        </form>
      )}

      {task.status === 'BLOCKED' && task.instruction && (
        <form action={retry} style={{ marginTop: '0.5rem' }}>
          <input type="hidden" name="taskId" value={task.id} />
          <button type="submit" className="ghost">다시 지시하기</button>
        </form>
      )}

      {task.status === 'AWAITING_APPROVAL' && (
        <p className="hint" style={{ margin: '0.75rem 0 0' }}>
          <Link href="/approvals">결재실에서 결정하기</Link>
        </p>
      )}
    </div>
  );
}

// Retrying re-drafts, which means a model call. The default function timeout
// would cut it off halfway and leave the founder with a cancelled task and no
// new one — the worst of both.
export const maxDuration = 120;

/**
 * What the founder is told at the top of the screen.
 *
 * Blocked work was counted as 진행 중, so three stopped tasks read as
 * "진행 중인 업무 3건입니다" directly above three cards labelled 중단 — the
 * inflated in-hand count that `resolveBlockedTask` exists to stop, printed in
 * the header of the page that fixes it.
 */
function headline(addr: string, tasks: readonly TaskRow[]): string {
  const stopped = tasks.filter((t) => t.status === 'BLOCKED').length;
  const running = tasks.length - stopped;

  if (running === 0 && stopped === 0) {
    return `${addr}, 진행 중인 업무는 없습니다. 비서실장에게 지시하시면 시작됩니다.`;
  }
  if (stopped === 0) return `${addr}, 진행 중인 업무 ${running}건입니다.`;
  if (running === 0) return `${addr}, 멈춘 업무가 ${stopped}건 있습니다.`;
  return `${addr}, 진행 중 ${running}건, 멈춘 업무 ${stopped}건입니다.`;
}

export default async function WorkPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice what="업무" />;

  const user = await getSessionUser();
  if (!user) return <SetupNotice what="업무" />;

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) {
    return (
      <main className="wrap" style={{ paddingBlock: '3rem' }}>
        <h1 style={{ fontSize: '1.6rem' }}>업무</h1>
        <p>아직 회사가 없습니다. <Link href="/onboarding">회사를 먼저 만들어 주십시오.</Link></p>
      </main>
    );
  }

  const [open, done] = await Promise.all([
    listOpenTasks(db, current.companyId),
    listFinishedTasks(db, current.companyId),
  ]);

  const addr = formatAddress(current.founder);
  // Blocked work first: it is the only kind that needs the founder to know.
  const ordered = [...open].sort((a, b) => Number(b.status === 'BLOCKED') - Number(a.status === 'BLOCKED'));

  return (
    <main className="wrap" style={{ paddingBlock: '3rem', maxWidth: '46rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>업무</h1>

      {(await searchParams).error === 'gone' && (
        <p className="hint error" style={{ margin: '0 0 1rem' }}>
          그 업무를 찾지 못했습니다. 이미 정리되었을 수 있습니다.
        </p>
      )}
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 2rem' }}>{headline(addr, ordered)}</p>

      {ordered.map((t) => <Task key={t.id} task={t} />)}

      {done.length > 0 && (
        <>
          <h2 style={{ fontSize: '1rem', margin: '2.5rem 0 0.75rem' }}>마무리</h2>
          {done.map((t) => <Task key={t.id} task={t} />)}
        </>
      )}

      {open.length === 0 && done.length === 0 && (
        <p className="hint">
          <Link href="/chat">비서실</Link>에서 &ldquo;리뷰 답변 준비해&rdquo;처럼 지시해 보십시오.
        </p>
      )}
    </main>
  );
}
