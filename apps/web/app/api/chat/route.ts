import { NextResponse } from 'next/server';
import type { FounderIdentity } from '@mycorp24/types';
import { route as routeUtterance, type RouterContext } from '@mycorp24/chat';

/**
 * Chief of staff chat endpoint.
 *
 * The router classifies and replies; it never executes. `nextStep` tells the
 * caller what would happen next, and anything that touches the outside world
 * goes through the tool gateway from a server action, not from here.
 *
 * The demo context below stands in for the founder's company until auth and
 * Supabase are wired up. It is obviously fake and labelled as such, so nobody
 * mistakes it for live data.
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

  const result = routeUtterance(message, demoContext());
  return NextResponse.json(result);
}
