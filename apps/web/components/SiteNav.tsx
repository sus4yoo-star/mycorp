'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isSupabaseConfigured } from '../lib/supabase/config';
import { getBrowserClient } from '../lib/supabase/client';

/**
 * The rooms of the company, shown to whoever is entitled to walk into them.
 *
 * Signed out, the full set was on display and every link bounced to the sign-in
 * form. Six doors that do not open is not a menu; on the landing page, where
 * most visitors have never heard of the product, it reads as broken.
 *
 * The session is read in the browser rather than on the server so the landing
 * page stays static — a marketing page should not be rendered per request to
 * decide which links to draw. The cost is that the private links appear a beat
 * after load for a signed-in founder, which is the right way round: the wrong
 * nav for a moment beats a slower first paint for everyone.
 */

const ROOMS = [
  { href: '/briefing', label: '보고' },
  { href: '/chat', label: '비서실' },
  { href: '/approvals', label: '결재실' },
  { href: '/competitors', label: '경쟁사' },
  { href: '/connect', label: '연결' },
  { href: '/hq', label: '본사' },
] as const;

export default function SiteNav() {
  // `null` means "not known yet" and draws neither set, so a signed-out
  // visitor never sees the private links flash past.
  const [signedIn, setSignedIn] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setSignedIn(false);
      return;
    }
    const supabase = getBrowserClient();
    let alive = true;

    supabase.auth
      .getUser()
      .then(({ data }) => alive && setSignedIn(Boolean(data.user)))
      .catch(() => alive && setSignedIn(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setSignedIn(Boolean(session));
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <nav>
      <Link href="/">홈</Link>
      {signedIn === true && ROOMS.map((r) => <Link key={r.href} href={r.href}>{r.label}</Link>)}
      {signedIn === false && <Link href="/login">출근</Link>}
    </nav>
  );
}
