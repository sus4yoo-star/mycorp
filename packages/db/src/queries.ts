import type { SupabaseClient } from '@supabase/supabase-js';
import type { FounderIdentity } from '@mycorp24/types';
import type { Division, ExecutiveRole } from '@mycorp24/agent-types';
import { resolvePreset, staffFor, type IndustryPreset } from '@mycorp24/business-logic';
import type { AgentRow, ApprovalRow, Database, MembershipRoleRow, TaskRow } from './database.types';

/**
 * Data access.
 *
 * Every function takes a client rather than creating one, so the same queries
 * serve the web app, the mobile app and server-side jobs. Which client is
 * passed decides what the caller may see: an anon-key client carries the user's
 * session and is filtered by row level security; the service-role client
 * bypasses it and must never be handed a request-scoped path.
 *
 * These functions do not re-implement the security rules. The database enforces
 * them (supabase/migrations/0001_init.sql, verified by scripts/db-test.sh); the
 * checks here exist to produce a good error rather than a silent empty result.
 */

export type Db = SupabaseClient<Database>;

export class DbError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'DbError';
  }
}

/**
 * Narrow a postgrest result to its data, or throw.
 *
 * The parameter is constrained on the whole result rather than on `data` alone.
 * A postgrest response is a union of a success shape and an error shape, and
 * inferring a type variable through `{ data: T | null }` also resolves against
 * the error branch, collapsing `T` to `never`. Indexing the union with
 * `R['data']` and stripping null avoids that.
 */
const unwrap = <R extends { data: unknown; error: unknown }>(
  res: R,
  what: string,
): NonNullable<R['data']> => {
  if (res.error) throw new DbError(`${what} failed`, res.error);
  if (res.data === null || res.data === undefined) {
    throw new DbError(`${what} returned nothing`);
  }
  return res.data as NonNullable<R['data']>;
};

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export interface CurrentCompany {
  readonly companyId: string;
  readonly companyName: string;
  readonly role: MembershipRoleRow;
  readonly founder: FounderIdentity;
}

/**
 * The company the signed-in user is currently operating.
 *
 * Returns null rather than throwing when the user has no company yet — that is
 * onboarding, not an error.
 */
export async function getCurrentCompany(db: Db, userId: string): Promise<CurrentCompany | null> {
  // Two queries rather than an embedded select: the generated Relationships are
  // empty, so an embed would not be type-checked and would fail at runtime
  // instead of at compile time.
  const { data, error } = await db
    .from('memberships')
    .select('company_id, role')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new DbError('lookup of the current company failed', error);
  if (!data) return null;

  const { data: company, error: companyError } = await db
    .from('companies')
    .select('id, name, locale')
    .eq('id', data.company_id)
    .maybeSingle();

  if (companyError) throw new DbError('loading the company failed', companyError);
  if (!company) return null;

  const { data: identity } = await db
    .from('founder_identities')
    .select('*')
    .eq('company_id', data.company_id)
    .maybeSingle();

  return {
    companyId: data.company_id,
    companyName: company.name,
    role: data.role,
    founder: {
      ownerDisplayName: identity?.owner_display_name ?? '',
      preferredTitle: identity?.preferred_title ?? '회장님',
      locale: identity?.locale ?? company.locale,
      addressForm: identity?.address_form ?? 'title_only',
      ...(identity?.preferred_nickname ? { preferredNickname: identity.preferred_nickname } : {}),
      ...(identity?.custom_address ? { customAddress: identity.custom_address } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Onboarding — spec §214, §220.9
// ---------------------------------------------------------------------------

export interface FoundCompanyInput {
  readonly userId: string;
  readonly companyName: string;
  readonly preset: IndustryPreset;
  readonly ownerDisplayName: string;
  readonly preferredTitle: string;
  readonly locale?: string;
}

/**
 * Create a company and seed its organization from a preset.
 *
 * The preset is a seed, not a cage (§215). Two rules hold whatever the preset:
 * the chief of staff, internal audit and enterprise risk offices always exist,
 * and investor relations is never created automatically (§220.9).
 *
 * Seeding runs after the founder membership exists, so every insert below is
 * already covered by row level security.
 */
export async function foundCompany(db: Db, input: FoundCompanyInput): Promise<string> {
  // The company, the founder membership and the founder identity are created by
  // a single security-definer function (supabase/migrations/0002_found_company.sql).
  // Doing it as three client calls would leave a window in which the company
  // exists with no members and could be claimed by whoever learns its id.
  const { data: companyId, error } = await db.rpc('found_company', {
    p_name: input.companyName,
    p_owner_display_name: input.ownerDisplayName,
    p_preferred_title: input.preferredTitle,
    p_preset: input.preset,
    p_locale: input.locale ?? 'ko-KR',
  });

  if (error) throw new DbError('founding the company', error);
  if (!companyId) throw new DbError('founding the company returned no id');

  // From here the caller is already the founder, so every insert below is
  // covered by the ordinary row level security policies.
  const preset = resolvePreset(input.preset);

  const divisionRows = (preset.divisions as readonly Division[]).map((d) => ({
    company_id: companyId,
    division_key: d,
  }));
  if (divisionRows.length > 0) {
    const res = await db.from('divisions').insert(divisionRows);
    if (res.error) throw new DbError('seeding divisions', res.error);
  }

  const executiveRows = preset.executives.map((role: ExecutiveRole) => ({
    company_id: companyId,
    role,
  }));
  if (executiveRows.length > 0) {
    const res = await db.from('executives').insert(executiveRows);
    if (res.error) throw new DbError('appointing executives', res.error);
  }

  const policyRes = await db.from('approval_policies').insert(DEFAULT_POLICIES(companyId));
  if (policyRes.error) throw new DbError('seeding the approval policy', policyRes.error);

  await staffCompany(db, companyId, preset.divisions);

  return companyId;
}

/**
 * Put staff in the divisions the company has — spec §132, §214.
 *
 * Idempotent by name and division, so it can be run again on a company founded
 * before there was a roster, and run twice without hiring anybody twice. It is
 * separate from founding for that reason: a company with floors and no staff is
 * a state that already exists in the wild and has to be repairable.
 */
export async function staffCompany(
  db: Db,
  companyId: string,
  divisions: readonly Division[],
): Promise<number> {
  const wanted = staffFor(divisions);
  if (wanted.length === 0) return 0;

  const { data: existing, error } = await db
    .from('agents')
    .select('display_name, division_key')
    .eq('company_id', companyId);
  if (error) throw new DbError('reading the roster', error);

  const already = new Set((existing ?? []).map((a) => `${a.division_key}:${a.display_name}`));
  const missing = wanted.filter((a) => !already.has(`${a.division}:${a.displayName}`));
  if (missing.length === 0) return 0;

  const res = await db.from('agents').insert(
    missing.map((a) => ({
      company_id: companyId,
      display_name: a.displayName,
      division_key: a.division,
      reports_to: a.reportsTo,
      skills: [...a.skills],
      clearance: a.clearance,
    })),
  );
  if (res.error) throw new DbError('hiring the staff', res.error);
  return missing.length;
}

/** The company's staff, top division first. */
export async function listAgents(db: Db, companyId: string): Promise<readonly AgentRow[]> {
  const res = await db
    .from('agents')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('division_key', { ascending: true })
    .order('display_name', { ascending: true });
  return unwrap(res, 'reading the roster');
}

/**
 * Starting approval policy — spec §112, §113.
 *
 * Conservative on purpose. A new founder should discover that MYCORP24 asks
 * before spending their money, not discover that it did not.
 */
const DEFAULT_POLICIES = (companyId: string) =>
  [
    { action: 'REPLY_REVIEW', mode: 'ASK' as const },
    { action: 'PUBLISH_POST', mode: 'ASK' as const },
    { action: 'SEND_CUSTOMER_MESSAGE', mode: 'ASK' as const },
    { action: 'SEND_EMAIL', mode: 'ASK' as const },
    { action: 'CHANGE_AD_BUDGET', mode: 'ASK' as const },
    { action: 'SPEND_MONEY', mode: 'ASK' as const },
    { action: 'CHANGE_PRICE', mode: 'ASK' as const },
    { action: 'CANCEL_RESERVATION', mode: 'ASK' as const },
    { action: 'SIGN_CONTRACT', mode: 'BLOCK' as const },
    { action: 'BULK_CUSTOMER_DATA', mode: 'BLOCK' as const },
    { action: 'DELETE_CRITICAL_DATA', mode: 'BLOCK' as const },
  ].map((p) => ({ company_id: companyId, ...p }));

// ---------------------------------------------------------------------------
// Approvals — spec §112
// ---------------------------------------------------------------------------

export const listPendingApprovals = async (db: Db, companyId: string): Promise<ApprovalRow[]> =>
  unwrap(
    await db
      .from('approvals')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'PENDING')
      .order('created_at', { ascending: true }),
    'listing pending approvals',
  );

export async function decideApproval(
  db: Db,
  input: {
    readonly companyId: string;
    readonly approvalId: string;
    readonly userId: string;
    readonly decision: 'APPROVE' | 'REJECT';
    readonly note?: string;
  },
): Promise<ApprovalRow> {
  const { data, error } = await db
    .from('approvals')
    .update({
      status: input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      decided_by: input.userId,
      decided_at: new Date().toISOString(),
      ...(input.note ? { decision_note: input.note } : {}),
    })
    .eq('id', input.approvalId)
    .eq('company_id', input.companyId)
    .eq('status', 'PENDING')
    .select('*')
    .maybeSingle();

  if (error) throw new DbError('deciding the approval', error);
  if (!data) {
    // Either the row is gone, already decided, or the caller is not the
    // founder — row level security filtered it out. Do not guess which.
    throw new DbError('the approval could not be decided; it may already be decided, or you may not be the founder');
  }

  await appendAuditEvent(db, {
    companyId: input.companyId,
    actor: input.userId,
    action: `APPROVAL:${input.decision}`,
    outcome: input.decision === 'APPROVE' ? 'ALLOWED' : 'DENIED',
    reason: data.title,
  });

  return data;
}

// ---------------------------------------------------------------------------
// Audit — spec §220.4
// ---------------------------------------------------------------------------

export async function appendAuditEvent(
  db: Db,
  event: {
    readonly companyId: string;
    readonly actor: string;
    readonly action: string;
    readonly outcome: 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'EXECUTED' | 'FAILED';
    readonly reason?: string;
    readonly integration?: string;
  },
): Promise<void> {
  const res = await db.from('audit_events').insert({
    company_id: event.companyId,
    actor: event.actor,
    action: event.action,
    outcome: event.outcome,
    ...(event.reason ? { reason: event.reason } : {}),
    ...(event.integration ? { integration: event.integration } : {}),
  });
  // An audit write must never be swallowed. If we cannot record what happened,
  // the internal audit office (§209) is auditing a partial record.
  if (res.error) throw new DbError('appending the audit event', res.error);
}

export const listDivisions = async (db: Db, companyId: string): Promise<Division[]> => {
  const rows = unwrap(
    await db.from('divisions').select('division_key').eq('company_id', companyId),
    'listing divisions',
  );
  return rows.map((r) => r.division_key as Division);
};

export const listApprovalPolicies = async (db: Db, companyId: string) =>
  unwrap(
    await db.from('approval_policies').select('*').eq('company_id', companyId),
    'listing approval policies',
  );

export async function upsertApprovalPolicy(
  db: Db,
  input: {
    readonly companyId: string;
    readonly action: string;
    readonly mode: 'AUTO' | 'ASK' | 'BLOCK';
    readonly autoBelowAmount?: number;
    readonly currency?: string;
  },
): Promise<void> {
  const res = await db.from('approval_policies').upsert(
    {
      company_id: input.companyId,
      action: input.action,
      mode: input.mode,
      auto_below_amount: input.autoBelowAmount?.toString() ?? null,
      currency: input.currency ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id,action' },
  );
  if (res.error) throw new DbError('saving the approval policy', res.error);
}

// ---------------------------------------------------------------------------
// Integrations — spec §80, §105, §110
// ---------------------------------------------------------------------------

export const listCatalog = async (db: Db) =>
  unwrap(
    await db.from('integrations_catalog').select('*').order('display_name'),
    'listing the integration catalog',
  );

export const listConnections = async (db: Db, companyId: string) =>
  unwrap(
    await db.from('integration_connections').select('*').eq('company_id', companyId),
    'listing integration connections',
  );

/**
 * Record a completed connection.
 *
 * The credential itself is written separately by the vault through the service
 * role: `integration_credentials` has row level security enabled and no policy,
 * so a user-scoped client cannot touch it (spec §110, §187).
 */
export async function upsertConnection(
  db: Db,
  input: {
    readonly companyId: string;
    readonly catalogId: string;
    readonly status: string;
    readonly connectedBy: string;
    readonly externalAccount?: string;
    readonly scopes?: readonly string[];
  },
): Promise<string> {
  const row = unwrap(
    await db
      .from('integration_connections')
      .upsert(
        {
          company_id: input.companyId,
          catalog_id: input.catalogId,
          status: input.status,
          connected_by: input.connectedBy,
          connected_at: new Date().toISOString(),
          ...(input.externalAccount ? { external_account: input.externalAccount } : {}),
          scopes: [...(input.scopes ?? [])],
        },
        { onConflict: 'company_id,catalog_id' },
      )
      .select('id')
      .single(),
    'recording the connection',
  );
  return row.id;
}

export async function removeConnection(
  db: Db,
  companyId: string,
  catalogId: string,
): Promise<void> {
  const res = await db
    .from('integration_connections')
    .delete()
    .eq('company_id', companyId)
    .eq('catalog_id', catalogId);
  if (res.error) throw new DbError('removing the connection', res.error);
}

// ---------------------------------------------------------------------------
// OAuth handshake state — spec §111
// ---------------------------------------------------------------------------

export async function createOAuthState(
  db: Db,
  input: {
    readonly state: string;
    readonly companyId: string;
    readonly userId: string;
    readonly provider: string;
    readonly codeVerifier?: string;
    readonly redirectTo?: string;
  },
): Promise<void> {
  // Opportunistic cleanup; expiry is enforced on read, so this is hygiene only.
  await db.rpc('prune_oauth_states', {});

  const res = await db.from('oauth_states').insert({
    state: input.state,
    company_id: input.companyId,
    user_id: input.userId,
    provider: input.provider,
    ...(input.codeVerifier ? { code_verifier: input.codeVerifier } : {}),
    ...(input.redirectTo ? { redirect_to: input.redirectTo } : {}),
  });
  if (res.error) throw new DbError('starting the OAuth handshake', res.error);
}

export interface ConsumedState {
  readonly companyId: string;
  readonly provider: string;
  readonly codeVerifier: string | null;
  readonly redirectTo: string | null;
}

/**
 * Consume a handshake: read it, then delete it, so a replayed callback cannot
 * be used twice. Expiry is checked here rather than trusted to cleanup.
 *
 * Returns null for anything that does not belong to this user — row level
 * security already scopes the read to them, so a mismatch is indistinguishable
 * from a forgery and is treated as one.
 */
export async function consumeOAuthState(
  db: Db,
  state: string,
  provider: string,
): Promise<ConsumedState | null> {
  // Delete and read in one statement. Selecting first and deleting after leaves
  // a window where two requests both read the row before either removes it, so
  // the state would be single-use only most of the time — and "most of the
  // time" is not a property a replay defence can be built on. Row level
  // security already confines these rows to the user who created them
  // (0003_oauth_states.sql), so this closes the gap rather than being the only
  // thing holding it shut; a later policy change must not turn it into one.
  const { data, error } = await db
    .from('oauth_states')
    .delete()
    .eq('state', state)
    .select('*')
    .maybeSingle();

  if (error) throw new DbError('reading the OAuth handshake', error);
  if (!data) return null;

  if (data.provider !== provider) return null;
  if (Date.parse(data.expires_at) <= Date.now()) return null;

  return {
    companyId: data.company_id,
    provider: data.provider,
    codeVerifier: data.code_verifier,
    redirectTo: data.redirect_to,
  };
}

/**
 * Raise an approval for the founder — spec §112.
 *
 * Called when the tool gateway's policy check says ASK. The agent has already
 * prepared the work; this is the point at which it stops and waits. Creating
 * the row and auditing the pause are one operation: an approval nobody can see
 * is the same as an action silently dropped.
 */
export async function requestApproval(
  db: Db,
  input: {
    readonly companyId: string;
    readonly action: string;
    readonly title: string;
    readonly summary: string;
    readonly amount?: number;
    readonly currency?: string;
    readonly requestedBy?: string;
  },
): Promise<ApprovalRow> {
  const row = unwrap(
    await db
      .from('approvals')
      .insert({
        company_id: input.companyId,
        action: input.action,
        title: input.title,
        summary: input.summary,
        ...(input.amount !== undefined ? { amount: String(input.amount) } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.requestedBy ? { requested_by: input.requestedBy } : {}),
      })
      .select('*')
      .single(),
    'requesting approval',
  );

  await appendAuditEvent(db, {
    companyId: input.companyId,
    actor: input.requestedBy ?? 'system',
    action: `APPROVAL:REQUEST:${input.action}`,
    outcome: 'PENDING_APPROVAL',
    reason: input.title,
  });

  return row;
}

/** True when an equivalent request is already waiting, so we do not stack duplicates. */
export async function hasPendingApproval(
  db: Db,
  companyId: string,
  action: string,
  title: string,
): Promise<boolean> {
  const { data, error } = await db
    .from('approvals')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'PENDING')
    .eq('action', action)
    .eq('title', title)
    .limit(1);
  if (error) throw new DbError('checking for a pending approval', error);
  return (data?.length ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Company memory and the constitution — spec §138–140
// ---------------------------------------------------------------------------

/**
 * The active memory an agent must read before acting.
 *
 * A founder decision outranks an agent's inference, so decisions come first:
 * whatever truncates this list keeps the statements that were actually stated.
 */
export const listCompanyMemory = async (db: Db, companyId: string) =>
  unwrap(
    await db
      .from('company_memory')
      .select('*')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('source', { ascending: true })
      .order('created_at', { ascending: false }),
    'reading company memory',
  );

export const getConstitution = async (db: Db, companyId: string) => {
  const { data, error } = await db
    .from('company_constitution')
    .select('*')
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw new DbError('reading the company constitution', error);
  return data;
};

export async function rememberDecision(
  db: Db,
  input: {
    readonly companyId: string;
    readonly statement: string;
    readonly detail?: string;
    readonly kind?: 'BUSINESS' | 'BRAND' | 'DECISION' | 'PREFERENCE' | 'FAILURE' | 'SUCCESS';
    readonly source?: 'FOUNDER' | 'AGENT';
  },
): Promise<void> {
  const res = await db.from('company_memory').insert({
    company_id: input.companyId,
    kind: input.kind ?? 'DECISION',
    statement: input.statement,
    source: input.source ?? 'FOUNDER',
    ...(input.detail ? { detail: input.detail } : {}),
  });
  if (res.error) throw new DbError('recording the decision', res.error);
}

/**
 * Replace a decision without forgetting it was replaced.
 *
 * §139: a reversal is itself worth remembering — it is what stops an agent
 * proposing the reversed thing again next quarter.
 */
export async function supersedeMemory(
  db: Db,
  oldId: string,
  statement: string,
  detail?: string,
): Promise<string> {
  const { data, error } = await db.rpc('supersede_memory', {
    p_old: oldId,
    p_statement: statement,
    ...(detail ? { p_detail: detail } : {}),
  });
  if (error) throw new DbError('superseding the memory', error);
  if (!data) throw new DbError('superseding the memory returned no id');
  return data;
}

// ---------------------------------------------------------------------------
// Founder tasks — spec §163, §164
// ---------------------------------------------------------------------------

export const listOpenFounderTasks = async (db: Db, companyId: string) =>
  unwrap(
    await db
      .from('founder_tasks')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'OPEN')
      .order('created_at', { ascending: true }),
    'listing founder tasks',
  );

export async function closeFounderTask(
  db: Db,
  companyId: string,
  taskId: string,
  status: 'DONE' | 'DROPPED',
): Promise<void> {
  const res = await db
    .from('founder_tasks')
    .update({ status, completed_at: new Date().toISOString() })
    .eq('id', taskId)
    .eq('company_id', companyId);
  if (res.error) throw new DbError('closing the founder task', res.error);
}

// ---------------------------------------------------------------------------
// Competitors and proposals — spec §157, §158, §161
// ---------------------------------------------------------------------------

export const listCompetitors = async (db: Db, companyId: string) =>
  unwrap(
    await db.from('competitors').select('*').eq('company_id', companyId).order('name'),
    'listing competitors',
  );

/** Signals the founder has not been told about yet, most significant first. */
export const listUnreportedSignals = async (db: Db, companyId: string, limit = 10) =>
  unwrap(
    await db
      .from('competitor_signals')
      .select('*')
      .eq('company_id', companyId)
      .is('reported_at', null)
      .order('significance', { ascending: false })
      .order('detected_at', { ascending: false })
      .limit(limit),
    'listing competitor signals',
  );

export async function markSignalsReported(db: Db, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const res = await db
    .from('competitor_signals')
    .update({ reported_at: new Date().toISOString() })
    .in('id', [...ids]);
  if (res.error) throw new DbError('marking signals as reported', res.error);
}

export const listOpenProposals = async (db: Db, companyId: string) =>
  unwrap(
    await db
      .from('proposals')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'OPEN')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: false }),
    'listing proposals',
  );

export async function decideProposal(
  db: Db,
  companyId: string,
  proposalId: string,
  status: 'ACCEPTED' | 'DECLINED',
): Promise<void> {
  const res = await db
    .from('proposals')
    .update({ status, decided_at: new Date().toISOString() })
    .eq('id', proposalId)
    .eq('company_id', companyId)
    .eq('status', 'OPEN');
  if (res.error) throw new DbError('deciding the proposal', res.error);
}

// ---------------------------------------------------------------------------
// Competitor snapshots and collection runs — spec §158
// ---------------------------------------------------------------------------

export const getSnapshots = async (db: Db, companyId: string) =>
  unwrap(
    await db.from('competitor_snapshots').select('*').eq('company_id', companyId),
    'loading competitor snapshots',
  );

export async function saveSnapshot(
  db: Db,
  input: {
    readonly companyId: string;
    readonly competitorId: string;
    readonly url: string;
    readonly fingerprint: string;
    readonly content: string;
    readonly prices: readonly number[];
  },
): Promise<void> {
  const res = await db.from('competitor_snapshots').upsert(
    {
      competitor_id: input.competitorId,
      company_id: input.companyId,
      url: input.url,
      fingerprint: input.fingerprint,
      // Capped upstream; the column is not a place to keep whole pages.
      content: input.content.slice(0, 40_000),
      prices: [...input.prices],
      taken_at: new Date().toISOString(),
    },
    { onConflict: 'competitor_id' },
  );
  if (res.error) throw new DbError('saving the competitor snapshot', res.error);
}

export async function recordSignals(
  db: Db,
  companyId: string,
  signals: readonly {
    readonly competitorId: string;
    readonly kind: string;
    readonly summary: string;
    readonly significance: number;
    readonly evidence: Readonly<Record<string, unknown>>;
  }[],
): Promise<void> {
  if (signals.length === 0) return;
  const res = await db.from('competitor_signals').insert(
    signals.map((s) => ({
      company_id: companyId,
      competitor_id: s.competitorId,
      kind: s.kind,
      summary: s.summary,
      significance: s.significance,
      evidence: s.evidence as Record<string, unknown>,
    })),
  );
  if (res.error) throw new DbError('recording competitor signals', res.error);
}

export async function createProposals(
  db: Db,
  companyId: string,
  proposals: readonly {
    readonly type: string;
    readonly title: string;
    readonly background: string;
    readonly recommendation: string;
    readonly expectedEffect?: string;
    readonly risk?: string;
    readonly priority: number;
  }[],
): Promise<number> {
  if (proposals.length === 0) return 0;
  const res = await db.from('proposals').insert(
    proposals.map((p) => ({
      company_id: companyId,
      proposal_type: p.type,
      title: p.title,
      background: p.background,
      recommendation: p.recommendation,
      ...(p.expectedEffect ? { expected_effect: p.expectedEffect } : {}),
      ...(p.risk ? { risk: p.risk } : {}),
      priority: p.priority,
    })),
  );
  if (res.error) throw new DbError('creating proposals', res.error);
  return proposals.length;
}

export const listRecentlyDeclined = async (db: Db, companyId: string, limit = 10) => {
  const rows = unwrap(
    await db
      .from('proposals')
      .select('title')
      .eq('company_id', companyId)
      .eq('status', 'DECLINED')
      .order('decided_at', { ascending: false })
      .limit(limit),
    'listing declined proposals',
  );
  return rows.map((r) => r.title);
};

/**
 * Open a run record before doing the work, close it after.
 *
 * A failed run must leave a trace: "no signals today" and "we could not check
 * today" are the same to a founder unless we wrote down which happened (§151).
 */
export async function startIntelligenceRun(db: Db, companyId: string): Promise<number> {
  const row = unwrap(
    await db.from('intelligence_runs').insert({ company_id: companyId }).select('id').single(),
    'starting the intelligence run',
  );
  return row.id;
}

export async function finishIntelligenceRun(
  db: Db,
  runId: number,
  result: {
    readonly competitorsChecked: number;
    readonly signalsFound: number;
    readonly proposalsCreated: number;
    readonly errors: readonly string[];
    readonly sanitised: readonly string[];
  },
): Promise<void> {
  const res = await db
    .from('intelligence_runs')
    .update({
      finished_at: new Date().toISOString(),
      competitors_checked: result.competitorsChecked,
      signals_found: result.signalsFound,
      proposals_created: result.proposalsCreated,
      errors: [...result.errors],
      sanitised: [...result.sanitised],
    })
    .eq('id', runId);
  if (res.error) throw new DbError('finishing the intelligence run', res.error);
}

// ---------------------------------------------------------------------------
// Work — spec §112, §164
// ---------------------------------------------------------------------------

/**
 * Open a task from something the founder actually said.
 *
 * `instruction` is required rather than optional: work the company invented for
 * itself and work the founder asked for must be told apart, and the only
 * reliable way is to record the sentence that started it (§151).
 */
export async function createTask(
  db: Db,
  input: {
    readonly companyId: string;
    readonly title: string;
    readonly instruction: string;
    readonly divisionKey: string;
    readonly agentId?: string;
  },
): Promise<TaskRow> {
  const res = await db
    .from('tasks')
    .insert({
      company_id: input.companyId,
      title: input.title,
      instruction: input.instruction,
      division_key: input.divisionKey,
      ...(input.agentId ? { agent_id: input.agentId } : {}),
      status: 'IN_PROGRESS' as const,
    })
    .select('*')
    .single();
  return unwrap(res, 'opening the task');
}

/** Record the draft and where it now waits. */
export async function deliverTask(
  db: Db,
  input: {
    readonly taskId: string;
    readonly companyId: string;
    readonly deliverable: string;
    readonly approvalId?: string;
  },
): Promise<TaskRow> {
  const res = await db
    .from('tasks')
    .update({
      deliverable: input.deliverable,
      delivered_at: new Date().toISOString(),
      // Work that needs a decision waits for one; work that does not is done.
      status: input.approvalId ? ('AWAITING_APPROVAL' as const) : ('DONE' as const),
      ...(input.approvalId ? { approval_id: input.approvalId } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.taskId)
    .eq('company_id', input.companyId)
    .select('*')
    .single();
  return unwrap(res, 'delivering the task');
}

/** Stop the task and say why, in words the founder can act on. */
export async function blockTask(
  db: Db,
  input: { readonly taskId: string; readonly companyId: string; readonly reason: string },
): Promise<TaskRow> {
  const res = await db
    .from('tasks')
    .update({
      status: 'BLOCKED' as const,
      detail: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.taskId)
    .eq('company_id', input.companyId)
    .select('*')
    .single();
  return unwrap(res, 'blocking the task');
}

/** The task an approval was raised for, if the work still waits on it. */
export async function taskForApproval(
  db: Db,
  companyId: string,
  approvalId: string,
): Promise<TaskRow | null> {
  const res = await db
    .from('tasks')
    .select('*')
    .eq('company_id', companyId)
    .eq('approval_id', approvalId)
    .eq('status', 'AWAITING_APPROVAL')
    .maybeSingle();
  const { data, error } = res;
  if (error) throw new DbError('reading the task behind the approval', error);
  return data ?? null;
}

/**
 * Close out a task the founder has decided on.
 *
 * DONE is reserved for work that actually happened. Approved work the company
 * could not carry out ends BLOCKED with the reason, because telling a founder
 * something is done when nothing left the building is the one failure this
 * product cannot survive (§151).
 */
export async function settleTask(
  db: Db,
  input: {
    readonly taskId: string;
    readonly companyId: string;
    readonly status: 'DONE' | 'CANCELLED' | 'BLOCKED';
    readonly detail: string;
  },
): Promise<TaskRow> {
  const res = await db
    .from('tasks')
    .update({
      status: input.status,
      detail: input.detail,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.taskId)
    .eq('company_id', input.companyId)
    .eq('status', 'AWAITING_APPROVAL')
    .select('*')
    .single();
  return unwrap(res, 'closing the task');
}

/**
 * The founder disposes of work the company could not finish.
 *
 * A BLOCKED task had no way out. It sat in 진행 중 forever, inflating the count
 * of what is supposedly in hand — the same lie in the other direction. Either
 * the founder did it themselves, or they are dropping it; both are endings, and
 * both are theirs to declare.
 *
 * Handled work is marked FOUNDER-owned because that is who did it. It also
 * satisfies the deliverable constraint honestly: there is no company output to
 * show, and claiming one would be the invention we are avoiding.
 */
export async function resolveBlockedTask(
  db: Db,
  input: {
    readonly taskId: string;
    readonly companyId: string;
    readonly outcome: 'HANDLED' | 'DROPPED';
    readonly detail: string;
  },
): Promise<TaskRow> {
  const handled = input.outcome === 'HANDLED';
  const res = await db
    .from('tasks')
    .update({
      status: handled ? ('DONE' as const) : ('CANCELLED' as const),
      ...(handled ? { owner_kind: 'FOUNDER' as const } : {}),
      detail: input.detail,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.taskId)
    .eq('company_id', input.companyId)
    .eq('status', 'BLOCKED')
    .select('*')
    .single();
  return unwrap(res, 'closing the blocked task');
}

/**
 * What the company actually did since a given moment.
 *
 * The morning briefing used to pass zeroes here, which was honest when no work
 * existed and became an under-report the moment it did: a founder was never
 * told about work their company finished while they slept.
 *
 * `agents` counts the staff who finished something, not the roster. "직원 5명이
 * 1건 완료했습니다" would be true and still misleading.
 */
export async function countRecentWork(
  db: Db,
  companyId: string,
  sinceIso: string,
): Promise<{ readonly completed: number; readonly agents: number; readonly blocked: number }> {
  const res = await db
    .from('tasks')
    .select('status, agent_id, owner_kind')
    .eq('company_id', companyId)
    .eq('owner_kind', 'AGENT')
    .in('status', ['DONE', 'BLOCKED'])
    .gte('updated_at', sinceIso);

  const rows = unwrap(res, 'counting recent work');
  const done = rows.filter((r) => r.status === 'DONE');
  const workers = new Set(done.map((r) => r.agent_id).filter((id): id is string => id !== null));

  return {
    completed: done.length,
    agents: workers.size,
    blocked: rows.filter((r) => r.status === 'BLOCKED').length,
  };
}

/** Everything still in flight, newest first. */
export async function listOpenTasks(db: Db, companyId: string): Promise<readonly TaskRow[]> {
  const res = await db
    .from('tasks')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['TODO', 'IN_PROGRESS', 'AWAITING_APPROVAL', 'BLOCKED'])
    .order('created_at', { ascending: false })
    .limit(50);
  return unwrap(res, 'reading the work in progress');
}

/**
 * Recently settled work, so the founder can see what the company did.
 *
 * Cancelled work belongs here too. Rejecting something used to make it vanish
 * from every screen, which reads as the company deleting the evidence rather
 * than the founder having decided.
 */
export async function listFinishedTasks(db: Db, companyId: string): Promise<readonly TaskRow[]> {
  const res = await db
    .from('tasks')
    .select('*')
    .eq('company_id', companyId)
    .in('status', ['DONE', 'CANCELLED'])
    .order('updated_at', { ascending: false })
    .limit(20);
  return unwrap(res, 'reading finished work');
}
