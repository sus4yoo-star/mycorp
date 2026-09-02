import { redirect } from 'next/navigation';
import { isSupabaseConfigured } from '../../lib/supabase/config';
import { getSessionUser } from '../../lib/supabase/server';
import SetupNotice from '../../components/SetupNotice';
import SignupForm from './SignupForm';

export default async function SignupPage() {
  if (!isSupabaseConfigured()) return <SetupNotice what="회원가입" />;
  // Already inside. Showing the sign-up form here would invite a second account.
  if (await getSessionUser()) redirect('/hq');
  return (
    <main className="wrap" style={{ paddingBlock: '3.5rem', maxWidth: '34rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.4rem' }}>회사 설립</h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.75rem' }}>
        이메일과 비밀번호만 있으면 됩니다. 다음 화면에서 회사를 만듭니다.
      </p>
      <SignupForm />
    </main>
  );
}
