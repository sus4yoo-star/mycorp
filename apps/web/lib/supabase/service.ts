import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@mycorp24/db';
import { SUPABASE_URL } from './config';

/**
 * Service-role client. Bypasses row level security.
 *
 * Reserved for work that legitimately has no user session: credential
 * decryption (§110, §187), scheduled agent runs, and audit reconciliation for
 * the internal audit office (§209).
 *
 * Never construct this on a path that serves a user request without first
 * establishing which company that request belongs to. Row level security is the
 * safety net everywhere else; here there is none.
 *
 * `server-only` makes bundling this into client code a build error rather than
 * a leaked key.
 */
export function getServiceClient() {
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!SUPABASE_URL || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL are required for service-role access',
    );
  }
  return createClient<Database>(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
