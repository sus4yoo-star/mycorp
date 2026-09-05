import Link from 'next/link';
import { divisionMeta, type Division } from '@mycorp24/agent-types';
import { formatAddress } from '@mycorp24/business-logic';
import {
  getCurrentCompany,
  listFinishedTasks,
  listOpenTasks,
  type TaskRow,
} from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
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

      {task.status === 'AWAITING_APPROVAL' && (
        <p className="hint" style={{ margin: '0.75rem 0 0' }}>
          <Link href="/approvals">결재실에서 결정하기</Link>
        </p>
      )}
    </div>
  );
}

export default async function WorkPage() {
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
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 2rem' }}>
        {open.length > 0
          ? `${addr}, 진행 중인 업무 ${open.length}건입니다.`
          : `${addr}, 진행 중인 업무는 없습니다. 비서실장에게 지시하시면 시작됩니다.`}
      </p>

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
