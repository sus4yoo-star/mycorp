import { timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { getCurrentCompany } from '@mycorp24/db';
import { getServerClient, getSessionUser } from '../../../../lib/supabase/server';
import { getServiceClient } from '../../../../lib/supabase/service';
import { isSupabaseConfigured } from '../../../../lib/supabase/config';
import { runIntelligence } from '../../../../lib/intelligence';

/**
 * Run an intelligence pass — spec §156, §158.
 *
 * Two callers, two very different levels of trust:
 *
 *   - A signed-in founder running it for their own company. Scoped by row level
 *     security like every other request.
 *   - The scheduler, holding MYCORP24_CRON_SECRET, running it for every company.
 *     This one uses the service role and so has no safety net; it is allowed
 *     because there is no user session at 6am and the work is read-only against
 *     the outside world.
 *
 * Long enough to need the extended budget: several sites are fetched and a
 * model call follows.
 */
export const maxDuration = 300;

function isScheduler(request: NextRequest): boolean {
  const expected = process.env['MYCORP24_CRON_SECRET'];
  if (!expected) return false;

  const header = request.headers.get('x-mycorp24-cron') ?? '';
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  // Compare in constant time, and never let a length mismatch throw.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'supabase is not configured' }, { status: 503 });
  }

  if (isScheduler(request)) {
    const service = getServiceClient();
    const { data: companies, error } = await service.from('companies').select('id, name');
    if (error) {
      return NextResponse.json({ error: 'could not list companies' }, { status: 500 });
    }

    const results = [];
    for (const company of companies ?? []) {
      try {
        results.push(await runIntelligence(service, company.id, company.name));
      } catch (err) {
        // One company failing must not stop the rest. The failure is already
        // recorded against that company's run.
        results.push({
          companyId: company.id,
          competitorsChecked: 0,
          signalsFound: 0,
          proposalsCreated: 0,
          errors: [err instanceof Error ? err.message : 'unknown failure'],
          sanitised: [],
        });
      }
    }
    return NextResponse.json({ ran: results.length, results });
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'authentication required' }, { status: 401 });

  const db = await getServerClient();
  const current = await getCurrentCompany(db, user.id);
  if (!current) return NextResponse.json({ error: 'no company' }, { status: 409 });

  try {
    const result = await runIntelligence(db, current.companyId, current.companyName);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'collection failed' },
      { status: 500 },
    );
  }
}
