import { NextResponse, type NextRequest } from 'next/server';
import { getServerClient } from '../../../lib/supabase/server';

/**
 * Magic-link landing. Exchanges the code for a session, then sends the founder
 * on to whatever they were trying to reach.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = request.nextUrl.searchParams.get('next') ?? '/hq';

  // Only same-origin relative paths, so a crafted link cannot bounce the
  // founder to another site carrying a fresh session.
  const target = next.startsWith('/') && !next.startsWith('//') ? next : '/hq';

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  const supabase = await getServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=exchange_failed', request.url));
  }

  return NextResponse.redirect(new URL(target, request.url));
}
