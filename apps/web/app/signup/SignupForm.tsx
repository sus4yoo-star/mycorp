'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { explainSignInError } from '@mycorp24/auth';
import { getBrowserClient } from '../../lib/supabase/client';

/**
 * Sign up — spec §116.
 *
 * Email and password rather than a magic link, because a link is only as
 * reachable as the mail sender behind it, and the founder should not need a
 * working inbox to get into their own company.
 *
 * Supabase decides whether a new account gets a session immediately or has to
 * confirm by mail. Both are handled: with a session we go straight to setting
 * the company up, and without one we say plainly that a mail has been sent —
 * and that it may not arrive until the sender is configured, which is true and
 * is exactly what a founder staring at an empty inbox needs to be told.
 */
export default function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'working' | 'confirm' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const tooShort = password.length > 0 && password.length < 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 8) return;
    setState('working');
    try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;

      if (data.session) {
        router.push('/onboarding');
        router.refresh();
        return;
      }
      setState('confirm');
    } catch (err) {
      setState('error');
      setMessage(explainSignInError(err).message);
    }
  }

  if (state === 'confirm') {
    return (
      <div className="card">
        <div className="card-label">확인 메일 발송</div>
        <div className="card-row">
          {email}로 확인 메일을 보냈습니다. 메일함의 링크를 눌러 주십시오.
        </div>
        <p className="hint" style={{ marginTop: '0.75rem' }}>
          메일이 오지 않는다면 메일 발송 설정(SMTP)이 아직 되어 있지 않은 것입니다.
          기다리셔도 오지 않습니다.
        </p>
      </div>
    );
  }

  return (
    <form className="composer" onSubmit={submit} style={{ flexDirection: 'column', gap: '0.75rem' }}>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        aria-label="이메일 주소"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'working'}
      />
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="비밀번호 (8자 이상)"
        aria-label="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={state === 'working'}
      />
      <button type="submit" disabled={state === 'working' || password.length < 8}>
        {state === 'working' ? '만드는 중…' : '회사 만들기'}
      </button>
      {tooShort && <p className="hint">비밀번호는 8자 이상이어야 합니다.</p>}
      {state === 'error' && <p className="hint error">{message}</p>}
      <p className="hint">
        이미 계정이 있으십니까? <Link href="/login">로그인</Link>
      </p>
    </form>
  );
}
