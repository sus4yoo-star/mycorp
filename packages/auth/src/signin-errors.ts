/**
 * Turn a Supabase sign-in failure into something the founder can act on.
 *
 * The raw strings are English, written for the developer who wired the project
 * up. A founder who reads "email rate limit exceeded" on the login screen
 * learns nothing: not that the limit is two messages an hour across the whole
 * project, not that waiting is the remedy, and not that this is a setting
 * somebody has to change rather than something they did wrong.
 *
 * Matching is on substrings and error codes because Supabase words these
 * differently across versions. An unrecognised failure keeps its own message
 * rather than being flattened into "something went wrong" — an honest unknown
 * error is more useful than a confident wrong one.
 */

export interface SignInFailure {
  /** What to show the founder. */
  readonly message: string;
  /** Whether trying the same thing again could work. */
  readonly retryable: boolean;
}

const UNKNOWN = '로그인 링크를 보내지 못했습니다.';

export function explainSignInError(raw: unknown): SignInFailure {
  const text =
    raw instanceof Error
      ? raw.message
      : typeof raw === 'string'
        ? raw
        : '';
  const code =
    typeof raw === 'object' && raw !== null && 'code' in raw
      ? String((raw as { code: unknown }).code)
      : '';
  // Supabase writes the same failure as prose in `message` and as a snake_case
  // code — "email rate limit exceeded" and `over_email_send_rate_limit`. Flatten
  // the separators so one substring matches both spellings.
  const hay = `${code} ${text}`.toLowerCase().replace(/[_-]+/g, ' ');

  if (hay.includes('rate limit') || hay.includes('too many requests') || hay.includes('429')) {
    return {
      message:
        '메일 발송 한도에 걸렸습니다. 잠시 후 다시 시도해 주십시오. ' +
        '한도가 반복해서 걸린다면 메일 발송 설정(SMTP)을 손봐야 합니다.',
      retryable: true,
    };
  }

  // The built-in mail service refuses any address outside the project team, so
  // this one never resolves itself by waiting.
  if (hay.includes('not authorized') || hay.includes('not allowed for this email')) {
    return {
      message:
        '이 주소로는 메일을 보낼 수 없습니다. ' +
        '메일 발송 설정(SMTP)이 아직 되어 있지 않아 일부 주소로만 발송됩니다.',
      retryable: false,
    };
  }

  if (hay.includes('signups not allowed') || hay.includes('signup is disabled')) {
    return { message: '지금은 신규 가입이 닫혀 있습니다.', retryable: false };
  }

  // Deliberately says neither which half was wrong nor whether the address is
  // registered: that answer would let anyone enumerate who has an account.
  if (hay.includes('invalid login credentials') || hay.includes('invalid credentials')) {
    return { message: '이메일 또는 비밀번호가 맞지 않습니다.', retryable: true };
  }

  if (hay.includes('already registered') || hay.includes('user already exists')) {
    return {
      message: '이미 가입된 이메일입니다. 로그인해 주십시오.',
      retryable: false,
    };
  }

  if (hay.includes('weak password') || hay.includes('password should be')) {
    return { message: '비밀번호가 너무 짧습니다. 8자 이상으로 정해 주십시오.', retryable: true };
  }

  // Confirmation mail goes through the same sender that is not set up yet, so
  // telling the founder to check their inbox would send them somewhere empty.
  if (hay.includes('email not confirmed') || hay.includes('not confirmed')) {
    return {
      message:
        '메일 확인이 끝나지 않은 계정입니다. 확인 메일이 오지 않는다면 ' +
        '메일 발송 설정(SMTP)이 아직 되어 있지 않은 것입니다.',
      retryable: false,
    };
  }

  if (hay.includes('invalid email') || hay.includes('unable to validate email')) {
    return { message: '이메일 주소를 다시 확인해 주십시오.', retryable: true };
  }

  if (hay.includes('failed to fetch') || hay.includes('networkerror')) {
    return { message: '네트워크에 연결하지 못했습니다. 다시 시도해 주십시오.', retryable: true };
  }

  return { message: text.trim() || UNKNOWN, retryable: true };
}
