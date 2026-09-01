import { isSupabaseConfigured } from '../../lib/supabase/config';
import SetupNotice from '../../components/SetupNotice';
import LoginForm from './LoginForm';

export default function LoginPage() {
  if (!isSupabaseConfigured()) return <SetupNotice what="로그인" />;
  return (
    <main className="wrap" style={{ paddingBlock: '3.5rem', maxWidth: '34rem' }}>
      <h1 style={{ fontSize: '1.6rem', margin: '0 0 0.4rem' }}>출근</h1>
      <p style={{ color: 'var(--ink-soft)', margin: '0 0 1.75rem' }}>
        이메일로 로그인 링크를 보내드립니다. 비밀번호는 없습니다.
      </p>
      <LoginForm />
    </main>
  );
}
