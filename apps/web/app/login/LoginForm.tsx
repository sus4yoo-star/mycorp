'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { explainSignInError } from '@mycorp24/auth';
import { getBrowserClient } from '../../lib/supabase/client';

/**
 * Sign in — spec §116.
 *
 * Password first. A magic link is only as reachable as the mail sender behind
 * it, and until one is configured a link-only sign-in locks the founder out of
 * their own company. The link is kept as the way back in when a password is
 * forgotten, which is the job it is actually good at.
 */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/hq';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'working' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length === 0) return;
    setState('working');
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      router.push(target);
      router.refresh();
    } catch (err) {
      setState('error');
      setMessage(explainSignInError(err).message);
    }
  }

  async function sendLink() {
    if (!email.trim()) {
      setState('error');
      setMessage('먼저 이메일 주소를 입력해 주십시오.');
      return;
    }
    setState('working');
    try {
      const supabase = getBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
      setState('sent');
    } catch (err) {
      setState('error');
      setMessage(explainSignInError(err).message);
    }
  }

  if (state === 'sent') {
    return (
      <div className="card">
        <div className="card-label">전송 완료</div>
        <div className="card-row">
          {email}로 로그인 링크를 보냈습니다. 메일함을 확인해 주십시오.
        </div>
      </div>
    );
  }

  return (
    <form className="composer" onSubmit={signIn} style={{ flexDirection: 'column', gap: '0.75rem' }}>
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
        autoComplete="current-password"
        placeholder="비밀번호"
        aria-label="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={state === 'working'}
      />
      <button type="submit" disabled={state === 'working'}>
        {state === 'working' ? '들어가는 중…' : '출근'}
      </button>
      {state === 'error' && <p className="hint error">{message}</p>}
      <p className="hint">
        계정이 없으십니까? <Link href="/signup">회원가입</Link>
        {' · '}
        <button
          type="button"
          onClick={sendLink}
          disabled={state === 'working'}
          style={{
            background: 'none',
            border: 0,
            padding: 0,
            font: 'inherit',
            color: 'inherit',
            textDecoration: 'underline',
            cursor: 'pointer',
          }}
        >
          비밀번호 대신 메일 링크로
        </button>
      </p>
    </form>
  );
}
