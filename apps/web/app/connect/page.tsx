import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { MVP_CATALOG, OAUTH_PROVIDERS, getProvider } from '@mycorp24/integrations';
import {
  appendAuditEvent,
  getCurrentCompany,
  listConnections,
  removeConnection,
} from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../lib/supabase/server';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { getVault, isVaultConfigured } from '../../lib/vault';
import SetupNotice from '../../components/SetupNotice';

/**
 * Connect Center — spec §105, §150.
 *
 * Every card states what the connection can actually do. `Limited` and
 * `Not connected` are shown as plainly as `Connected`: the founder must never
 * be led to believe a capability exists because a logo is on the screen (§151).
 */

const catalogIdFor = (providerId: string) => providerId.toLowerCase().replace(/_/g, '-');

async function disconnect(formData: FormData) {
  'use server';

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/connect');

  const catalogId = String(formData.get('catalogId') ?? '');
  const connectionId = String(formData.get('connectionId') ?? '');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  // Remove the stored token first. A connection row without a credential is
  // harmless; a credential without a connection row is a token nobody is
  // watching (§110 — connection revoke).
  if (isVaultConfigured() && connectionId) {
    await getVault().revoke(current.companyId, connectionId);
  }
  await removeConnection(db, current.companyId, catalogId);

  await appendAuditEvent(db, {
    companyId: current.companyId,
    actor: user.id,
    action: 'INTEGRATION:DISCONNECT',
    outcome: 'EXECUTED',
    integration: catalogId,
  });

  revalidatePath('/connect');
}

const STATUS_KO: Record<string, string> = {
  FULL: '전체',
  READ_WRITE: '읽기·쓰기',
  READ_ONLY: '읽기 전용',
  PARTNER_REQUIRED: '파트너 계약 필요',
  BROWSER_ASSISTED: '브라우저 보조',
  MANUAL: '수동',
  UNAVAILABLE: '지원 안 됨',
};

export default async function Connect({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string; cancelled?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice what="연결 센터" />;

  const user = await getSessionUser();
  if (!user) redirect('/login?next=/connect');

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) redirect('/onboarding');

  const connections = await listConnections(db, current.companyId);
  const byCatalog = new Map(connections.map((c) => [c.catalog_id, c]));
  const { connected, error, cancelled } = await searchParams;

  return (
    <main className="wrap" style={{ paddingBlock: '2.5rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.35rem' }}>연결 센터</h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.75rem' }}>
        공식 API와 OAuth만 사용합니다. 비밀번호는 저장하지 않습니다.
      </p>

      {connected && (
        <p className="hint" style={{ marginBottom: '1rem' }}>
          {OAUTH_PROVIDERS[connected]?.displayName ?? connected} 연결이 완료되었습니다.
        </p>
      )}
      {cancelled && (
        <p className="hint" style={{ marginBottom: '1rem' }}>연결이 취소되었습니다.</p>
      )}
      {error && (
        <p className="hint error" style={{ marginBottom: '1rem' }}>
          {error === 'not_configured'
            ? '이 연동의 OAuth 클라이언트가 서버에 설정되어 있지 않습니다.'
            : error === 'invalid_state'
              ? '연결 요청이 만료되었거나 유효하지 않습니다. 다시 시도해 주십시오.'
              : '연결에 실패했습니다. 다시 시도해 주십시오.'}
        </p>
      )}

      <div className="cards" style={{ flexDirection: 'column' }}>
        {MVP_CATALOG.map((entry) => {
          const connection = byCatalog.get(entry.id);
          const provider = getProvider(entry.provider);
          const connectable = provider !== undefined;

          return (
            <article className="card" key={entry.id} style={{ width: '100%' }}>
              <div className="card-label">{entry.category}</div>
              <div className="card-row">
                <strong>{entry.displayName}</strong>
                <span className="mono">
                  {connection ? STATUS_KO[connection.status] ?? connection.status : '연결 안 됨'}
                </span>
              </div>
              <p style={{ margin: '0.3rem 0 0.6rem', color: 'var(--ink-soft)', fontSize: '0.85rem' }}>
                {entry.capabilities.join(' · ')}
                {entry.notes ? ` — ${entry.notes}` : ''}
              </p>

              {connection ? (
                <form action={disconnect} className="decision">
                  <input type="hidden" name="catalogId" value={entry.id} />
                  <input type="hidden" name="connectionId" value={connection.id} />
                  <button type="submit" className="ghost">
                    연결 해제
                  </button>
                </form>
              ) : connectable ? (
                <a className="cta" href={`/api/oauth/${entry.provider}/start`}>
                  연결하기
                </a>
              ) : (
                <p className="hint">
                  이 연동은 아직 구현되지 않았습니다. 지원한다고 가장하지 않습니다.
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p style={{ marginTop: '2rem', fontSize: '0.85rem', color: 'var(--ink-soft)' }}>
        연결된 토큰은 암호화되어 서버에만 저장됩니다. 브라우저 세션으로는 읽을 수
        없습니다.
      </p>
    </main>
  );
}
