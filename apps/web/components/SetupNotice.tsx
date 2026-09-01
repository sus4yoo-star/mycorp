/**
 * Shown when Supabase is not configured.
 *
 * The alternative — crashing — would teach a contributor nothing and make the
 * product look broken. This says exactly what is missing and how to fix it.
 */
export default function SetupNotice({ what }: { what: string }) {
  return (
    <main className="wrap" style={{ paddingBlock: '3rem' }}>
      <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>설정이 필요합니다</h1>
      <p style={{ color: 'var(--ink-soft)', maxWidth: '40rem' }}>
        {what}을 사용하려면 Supabase 연결이 필요합니다. 아직 구성되지 않았습니다.
      </p>
      <ol style={{ color: 'var(--ink-soft)', maxWidth: '40rem', lineHeight: 1.9 }}>
        <li>Supabase 프로젝트를 만듭니다.</li>
        <li>
          <code>supabase/migrations/0001_init.sql</code>을 적용합니다
          (<code>supabase db push</code>).
        </li>
        <li>
          <code>.env.example</code>을 <code>.env.local</code>로 복사하고
          <code> NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를 채웁니다.
        </li>
      </ol>
      <p className="rule-line">
        RLS 정책은 <code>pnpm test:db</code>로 로컬에서 검증할 수 있습니다.
      </p>
    </main>
  );
}
