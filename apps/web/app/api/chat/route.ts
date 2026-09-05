import { NextResponse } from 'next/server';
import type { FounderIdentity } from '@mycorp24/types';
import {
  buildBrief,
  route as routeUtterance,
  systemPrompt,
  userPrompt,
  type RouterContext,
  type RouterResult,
} from '@mycorp24/chat';
import { createAiProvider } from '@mycorp24/ai-gateway';
import { getCurrentCompany, listAgents, listPendingApprovals } from '@mycorp24/db';
import { formatAddress } from '@mycorp24/business-logic';
import { runInstruction } from '../../../lib/work';
import { getServerClient, getSessionUser } from '../../../lib/supabase/server';
import { isSupabaseConfigured } from '../../../lib/supabase/config';

/**
 * Chief of staff chat endpoint.
 *
 * The router classifies and replies; it never executes. `nextStep` says what
 * would happen next, and anything touching the outside world is handed to the
 * tool gateway, where permission, risk and approval policy are enforced.
 *
 * Two things this endpoint must not do, both of which it used to:
 *
 *   - Answer a stranger. It calls a paid model, so an open endpoint is a way to
 *     spend the founder's money from the outside. A signed-in founder is
 *     required whenever there is an auth system to sign in to.
 *   - Show invented data as if it were the company's. The demo context carries
 *     made-up approvals and a staffed floor; a founder who has signed up but
 *     not yet founded a company would have been shown those as their own. It is
 *     now reachable only when Supabase is not configured at all — a local
 *     exploration of the interface, where there is no company to misrepresent —
 *     and the model is not called there (§151).
 */

/**
 * An instruction can now become work, and work costs a second model call: one
 * to write the draft and one to say what happened. Well inside the limit, but
 * not inside the default.
 */
export const maxDuration = 120;

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

type Db = Awaited<ReturnType<typeof getServerClient>>;
type Current = NonNullable<Awaited<ReturnType<typeof getCurrentCompany>>>;

async function liveContext(db: Db, current: Current): Promise<RouterContext> {
  const [pending, agents] = await Promise.all([
    listPendingApprovals(db, current.companyId),
    listAgents(db, current.companyId),
  ]);

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
    // The real roster. This read 0 before anyone was ever hired, so the chief
    // of staff told a founder their AI company had nobody in it — which was
    // true, and was the bug.
    workingAgentCount: agents.length,
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

  // No Supabase means no accounts and nothing real to protect: the demo exists
  // so the interface can be looked at. It never reaches the model.
  if (!isSupabaseConfigured()) {
    const ctx = demoContext();
    return NextResponse.json({ ...routeUtterance(message, ctx), live: false });
  }

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'authentication required' }, { status: 401 });
  }

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) {
    // Answering with the demo here would hand a founder someone else's
    // invented approvals and call them their own.
    return NextResponse.json(
      {
        classification: { intent: 'UNKNOWN', entities: {}, confidence: 1 },
        reply: '아직 회사가 없습니다. 회사를 먼저 만들어 주십시오.',
        cards: [],
        nextStep: { kind: 'NAVIGATE', route: '/onboarding' },
        live: true,
      },
      { status: 200 },
    );
  }

  const ctx = await liveContext(db, current);
  const result = routeUtterance(message, ctx);

  // An instruction the router has no product action for is not nothing — it is
  // usually work. Only an instruction: a question about how something is done
  // must never start doing it, and only when the router found nothing, so
  // "결재할 거 있어?" stays a question about approvals rather than becoming a task.
  if (result.classification.intent === 'UNKNOWN' && result.classification.mood === 'INSTRUCTION') {
    const worked = await asWork(db, current, message, ctx);
    if (worked) return NextResponse.json({ ...worked, live: true });
  }

  const reply = await speak(message, result, ctx);
  return NextResponse.json({ ...result, reply, live: true });
}

/**
 * Turn an instruction into work, when it is work.
 *
 * Returns null when the company cannot place it, so the ordinary reply happens
 * instead of a task nobody owns. What it does place, it describes exactly: the
 * founder is told a draft is waiting, never that something was done.
 */
async function asWork(
  db: Db,
  current: Current,
  message: string,
  ctx: RouterContext,
): Promise<RouterResult | null> {
  const address = formatAddress(current.founder);
  const outcome = await runInstruction(
    db,
    { companyId: current.companyId, companyName: current.companyName, address },
    message,
  );

  if (outcome.kind === 'UNCLEAR') return null;

  if (outcome.kind === 'NO_DIVISION') {
    // §215: the company can grow a division, but not without being asked.
    const result: RouterResult = {
      classification: { intent: 'UNKNOWN', entities: {}, confidence: 1, mood: 'INSTRUCTION' },
      reply:
        `${address}, 그 일을 맡을 부서가 아직 없습니다. ` +
        `${outcome.wanted} 부서를 신설하면 처리할 수 있습니다.`,
      cards: [],
      nextStep: { kind: 'NAVIGATE', route: '/hq' },
    };
    return { ...result, reply: await speak(message, result, ctx) };
  }

  if (outcome.kind === 'BLOCKED') {
    const result: RouterResult = {
      classification: { intent: 'UNKNOWN', entities: {}, confidence: 1, mood: 'INSTRUCTION' },
      reply: `${address}, 진행하지 못했습니다. ${outcome.reason}`,
      cards: [],
      nextStep: { kind: 'NAVIGATE', route: '/work' },
    };
    return { ...result, reply: await speak(message, result, ctx) };
  }

  const result: RouterResult = {
    classification: { intent: 'UNKNOWN', entities: {}, confidence: 1, mood: 'INSTRUCTION' },
    reply: outcome.needsApproval
      ? `${address}, 초안을 준비했습니다. 결재실에서 확인하시고 결정해 주십시오.`
      : `${address}, 정리해 두었습니다. 업무 화면에서 보실 수 있습니다.`,
    cards: [],
    nextStep: { kind: 'NAVIGATE', route: outcome.needsApproval ? '/approvals' : '/work' },
  };
  return { ...result, reply: await speak(message, result, ctx) };
}

/**
 * Put the router's decision into the chief of staff's own words.
 *
 * The decision is already made and is not sent back for revision: `nextStep`
 * and the cards come from the router, and only the sentences change here. So
 * the model cannot talk the product into an action, and a model outage costs
 * the founder some fluency rather than the use of their company.
 */
async function speak(
  utterance: string,
  result: RouterResult,
  ctx: RouterContext,
): Promise<string> {
  if (!process.env['ANTHROPIC_API_KEY']) return result.reply;

  try {
    const brief = buildBrief(utterance, result, ctx);
    const answer = await createAiProvider().complete({
      system: systemPrompt(brief),
      messages: [{ role: 'user', content: userPrompt(brief) }],
      tier: 'ROUTINE',
      // No maxTokens here on purpose. Thinking is on by default and is spent
      // from the same budget, so a ceiling sized for a three-sentence answer
      // can be consumed before a single word is written — and the reply comes
      // back with no text at all. Brevity is the prompt's job, not the cap's;
      // output is billed on what is actually produced.
    });
    const text = answer.text.trim();
    // A refusal, an empty answer, or one cut off mid-sentence is not a reply.
    // Fall back rather than show the founder a blank or half-finished turn.
    return answer.refusal || text.length === 0 || answer.stopReason === 'max_tokens'
      ? result.reply
      : text;
  } catch {
    return result.reply;
  }
}
