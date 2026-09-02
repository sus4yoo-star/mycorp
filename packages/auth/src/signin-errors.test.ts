import { describe, expect, it } from 'vitest';
import { explainSignInError } from './signin-errors';

describe('explainSignInError', () => {
  it('explains the rate limit rather than repeating it', () => {
    const r = explainSignInError(new Error('email rate limit exceeded'));
    expect(r.message).toContain('한도');
    expect(r.message).not.toContain('rate limit');
    expect(r.retryable).toBe(true);
  });

  it('reads the code as well as the message', () => {
    const r = explainSignInError({ code: 'over_email_send_rate_limit', message: '' });
    expect(r.retryable).toBe(true);
    expect(r.message).toContain('한도');
  });

  // Waiting fixes a rate limit. It never fixes an address the mail service
  // refuses, so telling the founder to try again would be a lie.
  it('does not offer a retry for an address that will never be accepted', () => {
    const r = explainSignInError(new Error('Email address not authorized'));
    expect(r.retryable).toBe(false);
    expect(r.message).toContain('SMTP');
  });

  it('keeps an unrecognised message instead of inventing one', () => {
    const r = explainSignInError(new Error('database is on fire'));
    expect(r.message).toBe('database is on fire');
  });

  it('falls back when there is no message at all', () => {
    expect(explainSignInError(undefined).message).toBe('로그인 링크를 보내지 못했습니다.');
    expect(explainSignInError(new Error('   ')).message).toBe('로그인 링크를 보내지 못했습니다.');
  });

  it('answers in Korean for every failure it claims to know', () => {
    const hangul = /[\uAC00-\uD7A3]/;
    for (const raw of [
      'Email rate limit exceeded',
      'Email address not authorized',
      'Signups not allowed for otp',
      'Unable to validate email address: invalid format',
      'Failed to fetch',
    ]) {
      expect(explainSignInError(new Error(raw)).message).toMatch(hangul);
    }
  });
});

describe('explainSignInError — password sign in and sign up', () => {
  // Saying "no such account" or "wrong password" tells an attacker which
  // addresses are registered. One message covers both.
  it('does not reveal which half of the credentials was wrong', () => {
    const r = explainSignInError(new Error('Invalid login credentials'));
    expect(r.message).toContain('이메일 또는 비밀번호');
    expect(r.message).not.toMatch(/없는 계정|가입되지|등록되지/);
  });

  it('sends an existing account to sign in rather than to retry', () => {
    const r = explainSignInError(new Error('User already registered'));
    expect(r.retryable).toBe(false);
    expect(r.message).toContain('로그인');
  });

  it('says how long the password must be', () => {
    const r = explainSignInError({ code: 'weak_password', message: 'Password should be at least 6 characters' });
    expect(r.message).toContain('8자');
    expect(r.retryable).toBe(true);
  });

  // Pointing at an inbox that will stay empty is worse than saying nothing.
  it('names the real blocker for an unconfirmed account', () => {
    const r = explainSignInError(new Error('Email not confirmed'));
    expect(r.message).toContain('SMTP');
    expect(r.retryable).toBe(false);
  });
});
