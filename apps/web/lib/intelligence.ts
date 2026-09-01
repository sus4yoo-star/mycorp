import 'server-only';

import {
  checkAll,
  generateProposals,
  isReportable,
  type CompanyContext,
  type ScoredSignal,
  type WatchTarget,
} from '@mycorp24/intelligence';
import { createAiProvider } from '@mycorp24/ai-gateway';
import {
  appendAuditEvent,
  createProposals,
  finishIntelligenceRun,
  getConstitution,
  getSnapshots,
  listCompanyMemory,
  listCompetitors,
  listRecentlyDeclined,
  recordSignals,
  saveSnapshot,
  startIntelligenceRun,
  type Db,
} from '@mycorp24/db';

/**
 * One intelligence pass for one company — spec §156, §158, §161.
 *
 * Watch the competitors the founder asked us to watch, record what changed, and
 * propose what to do about it. Nothing here executes anything: proposals go to
 * the founder, and acting on one goes through the tool gateway afterwards.
 *
 * Every run is logged, including a run that found nothing and a run that
 * failed. "No signals today" and "we could not check today" are the same to a
 * founder unless we write down which happened (§151).
 */

export interface CollectionResult {
  readonly companyId: string;
  readonly competitorsChecked: number;
  readonly signalsFound: number;
  readonly proposalsCreated: number;
  readonly errors: readonly string[];
  readonly sanitised: readonly string[];
}

export async function runIntelligence(
  db: Db,
  companyId: string,
  companyName: string,
): Promise<CollectionResult> {
  const runId = await startIntelligenceRun(db, companyId);
  const errors: string[] = [];
  const sanitised: string[] = [];
  let signalsFound = 0;
  let proposalsCreated = 0;

  try {
    const competitors = (await listCompetitors(db, companyId)).filter(
      (c) => c.watching && c.website,
    );

    if (competitors.length === 0) {
      await finishIntelligenceRun(db, runId, {
        competitorsChecked: 0,
        signalsFound: 0,
        proposalsCreated: 0,
        errors: [],
        sanitised: [],
      });
      return { companyId, competitorsChecked: 0, signalsFound: 0, proposalsCreated: 0, errors: [], sanitised: [] };
    }

    const snapshots = new Map(
      (await getSnapshots(db, companyId)).map((s) => [s.competitor_id, s]),
    );

    const targets: WatchTarget[] = competitors.map((c) => {
      const prev = snapshots.get(c.id);
      return {
        competitorId: c.id,
        competitor: c.name,
        url: c.website!,
        ...(prev
          ? {
              previous: {
                fingerprint: prev.fingerprint,
                text: prev.content,
                prices: prev.prices,
                takenAt: prev.taken_at,
              },
            }
          : {}),
      };
    });

    const results = await checkAll(targets);
    const byId = new Map(competitors.map((c) => [c.id, c]));
    const fresh: (ScoredSignal & { competitor: string; competitorId: string })[] = [];

    for (const r of results) {
      const competitor = byId.get(r.competitorId);
      if (!competitor) continue;

      if (r.error) {
        errors.push(`${competitor.name}: ${r.error}`);
        continue;
      }
      for (const s of r.sanitised) {
        sanitised.push(`${competitor.name}: ${s}`);
      }
      if (r.snapshot) {
        await saveSnapshot(db, {
          companyId,
          competitorId: r.competitorId,
          url: competitor.website!,
          fingerprint: r.snapshot.fingerprint,
          content: r.snapshot.text,
          prices: r.snapshot.prices,
        });
      }
      if (r.signal) {
        fresh.push({ ...r.signal, competitor: competitor.name, competitorId: r.competitorId });
      }
    }

    if (fresh.length > 0) {
      await recordSignals(
        db,
        companyId,
        fresh.map((s) => ({
          competitorId: s.competitorId,
          kind: s.kind,
          summary: s.summary,
          significance: s.significance,
          evidence: s.evidence,
        })),
      );
      signalsFound = fresh.length;
    }

    // A page that tried to talk to the model is itself worth knowing about.
    if (sanitised.length > 0) {
      await appendAuditEvent(db, {
        companyId,
        actor: 'intelligence',
        action: 'EXTERNAL_CONTENT:SANITISED',
        outcome: 'ALLOWED',
        reason: sanitised.slice(0, 5).join('; '),
      });
    }

    // Only what would actually reach the founder is worth spending a model call on.
    const reportable = fresh.filter(isReportable);
    if (reportable.length > 0) {
      const memory = await listCompanyMemory(db, companyId);
      const constitution = await getConstitution(db, companyId);

      const company: CompanyContext = {
        companyName,
        decisions: memory
          .filter((m) => m.kind === 'DECISION' || m.source === 'FOUNDER')
          .map((m) => m.statement),
        ...(constitution?.prohibitions ? { prohibitions: constitution.prohibitions } : {}),
        ...(constitution?.principles ? { principles: constitution.principles } : {}),
        ...(constitution?.goals ? { goals: constitution.goals } : {}),
        locale: 'ko-KR',
      };

      const outcome = await generateProposals(createAiProvider(), {
        company,
        signals: reportable,
        recentlyDeclined: await listRecentlyDeclined(db, companyId),
      });

      proposalsCreated = await createProposals(
        db,
        companyId,
        outcome.proposals.map((p) => ({
          type: p.type,
          title: p.title,
          background: p.background,
          recommendation: p.recommendation,
          expectedEffect: p.expectedEffect,
          risk: p.risk,
          priority: p.priority,
        })),
      );

      // A proposal the model made that the company's own decisions forbid is
      // not a silent drop — the founder should know the model suggested it.
      for (const r of outcome.rejected) {
        await appendAuditEvent(db, {
          companyId,
          actor: 'intelligence',
          action: 'PROPOSAL:REJECTED',
          outcome: 'DENIED',
          reason: `${r.title} — ${r.reason}`,
        });
      }
    }

    await finishIntelligenceRun(db, runId, {
      competitorsChecked: competitors.length,
      signalsFound,
      proposalsCreated,
      errors,
      sanitised,
    });

    return {
      companyId,
      competitorsChecked: competitors.length,
      signalsFound,
      proposalsCreated,
      errors,
      sanitised,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown failure';
    errors.push(message);
    // Close the run even on failure, so a crashed pass is visible rather than
    // leaving a run that looks like it is still going.
    await finishIntelligenceRun(db, runId, {
      competitorsChecked: 0,
      signalsFound,
      proposalsCreated,
      errors,
      sanitised,
    }).catch(() => undefined);
    throw err;
  }
}
