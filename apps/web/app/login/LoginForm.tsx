'use client';

import { useState } from 'react';
import { explainSignInError } from '@mycorp24/auth';
import { getBrowserClient } from '../../lib/supabase/client';

/**
 * Magic-link sign in.
 *
 * No password, so there is no password to leak, reuse or reset. Spec §116 adds
 * Google and Apple next; biometrics gate sensitive approvals, not sign-in.
 */
export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState('sending');
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
    <form className="composer" onSubmit={submit} style={{ flexDirection: 'column', gap: '0.75rem' }}>
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="you@company.com"
        aria-label="이메일 주소"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={state === 'sending'}
      />
      <button type="submit" disabled={state === 'sending'}>
        {state === 'sending' ? '보내는 중…' : '로그인 링크 받기'}
      </button>
      {state === 'error' && <p className="hint error">{message}</p>}
    </form>
  );
}
