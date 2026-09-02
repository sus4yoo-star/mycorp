import { NextResponse } from 'next/server';
import type { FounderIdentity } from '@mycorp24/types';
import { route as routeUtterance, type RouterContext } from '@mycorp24/chat';
import { getCurrentCompany, listPendingApprovals } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/config';

/**
 * Chief of staff chat endpoint.
 *
 * The router classifies and replies; it never executes. `nextStep` says what
 * would happen next, and anything touching the outside world is handed to the
 * tool gateway, where permission, risk and approval policy are enforced.
 *
 * With a signed-in founder the context is their real company, filtered by row
 * level security. Without Supabase configured it falls back to an obviously
 * labelled demo so the chat is explorable — but the reply is still honest about
 * what is and is not connected (§151).
 */

const DEMO_FOUNDER: FounderIdentity = {
  ownerDisplayName: '유상철',
  preferredTitle: '회장님',
  locale: 'ko-KR',
  addressForm: 'title_only',
};

const demoContext = (): RouterContext => ({
  founder: DEMO_FOUNDER,
  connectedProviders: new Set(['GMAIL', 'GOOGLE_CALENDAR']),
  pendingApprovals: [
    { id: 'apr_1', title: 'Meta 광고 증액안', amount: 300_000, currency: 'KRW' },
    { id: 'apr_2', title: '주말 가격 변경안' },
  ],
  workingAgentCount: 31,
});

async function liveContext(): Promise<RouterContext | null> {
  if (!isSupabaseConfigured()) return null;
  const user = await getSessionUser();
  if (!user) return null;

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) return null;

  const pending = await listPendingApprovals(db, current.companyId);

  return {
    founder: current.founder,
    // No integration adapters have shipped yet, so nothing is connected. Saying
    // so is the point: the chief of staff must not claim otherwise (§151).
    connectedProviders: new Set<string>(),
    pendingApprovals: pending.map((a) => ({
      id: a.id,
      title: a.title,
      ...(a.amount !== null ? { amount: Number(a.amount) } : {}),
      ...(a.currency !== null ? { currency: a.currency } : {}),
    })),
    workingAgentCount: 0,
  };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? (body as { message: unknown }).message
      : undefined;

  if (typeof message !== 'string' || message.trim().length === 0) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: 'message is too long' }, { status: 413 });
  }

  const live = await liveContext();
  const result = routeUtterance(message, live ?? demoContext());
  return NextResponse.json({ ...result, live: live !== null });
}
