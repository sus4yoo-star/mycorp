import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@mycorp24/db';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config';

/**
 * Request-scoped client carrying the signed-in user's session.
 *
 * Everything it reads is filtered by row level security, so a bug here leaks
 * nothing: the database is the enforcement point
 * (supabase/migrations/0001_init.sql, verified by scripts/db-test.sh).
 */
export async function getServerClient() {
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) {
            store.set(name, value, options);
          }
        } catch {
          // Called from a server component, where cookies are read-only.
          // Middleware refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}

/** The signed-in user, or null. Never throws for an anonymous visitor. */
export async function getSessionUser() {
  const db = await getServerClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
