import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refresh the Supabase session on every request and gate the private routes.
 *
 * Server components cannot write cookies, so the refreshed session has to be
 * written here or the founder is signed out the moment the access token
 * expires.
 */

const PRIVATE = ['/hq', '/approvals', '/chat', '/work', '/onboarding', '/connect', '/briefing', '/competitors'];

export async function middleware(request: NextRequest) {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
  const key = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? '';

  // Without configuration there is no session to refresh and nothing to
  // protect; the pages themselves render a setup notice.
  if (!url || !key) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  if (!data.user && PRIVATE.some((p) => path === p || path.startsWith(`${p}/`))) {
    const login = request.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', path);
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
