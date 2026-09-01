/**
 * Database shape, kept in step with supabase/migrations/0001_init.sql by hand.
 *
 * Regenerate against a real project with:
 *   supabase gen types typescript --linked > packages/db/src/database.types.ts
 *
 * Until the project exists this file is the contract. If you change the
 * migration, change this too — a drift here is a runtime error, not a type
 * error, which is the worst kind.
 */

export type SecurityLevelRow =
  | 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'SECRET' | 'TOP_SECRET';
export type ApprovalModeRow = 'AUTO' | 'ASK' | 'BLOCK';
export type ApprovalStatusRow = 'PENDING' | 'APPROVED' | 'REJECTED' | 'AMENDED';
export type MembershipRoleRow = 'FOUNDER' | 'MEMBER' | 'VIEWER';
export type AuditOutcomeRow =
  | 'ALLOWED' | 'DENIED' | 'PENDING_APPROVAL' | 'EXECUTED' | 'FAILED';

export type CompanyRow = {
  id: string;
  name: string;
  industry: string | null;
  preset: string;
  locale: string;
  slogan: string | null;
  logo_url: string | null;
  founded_on: string | null;
  created_at: string;
};

export type MembershipRow = {
  user_id: string;
  company_id: string;
  role: MembershipRoleRow;
  created_at: string;
};

export type FounderIdentityRow = {
  company_id: string;
  user_id: string;
  owner_display_name: string;
  preferred_title: string;
  preferred_nickname: string | null;
  address_form: 'title_only' | 'name_title' | 'name_only' | 'custom';
  custom_address: string | null;
  locale: string;
};

export type DivisionRow = {
  id: string;
  company_id: string;
  division_key: string;
  created_at: string;
};

export type ExecutiveRow = {
  id: string;
  company_id: string;
  role: string;
  display_name: string | null;
  appointed_at: string;
};

export type ApprovalRow = {
  id: string;
  company_id: string;
  action: string;
  title: string;
  summary: string;
  amount: string | null;
  currency: string | null;
  requested_by: string | null;
  status: ApprovalStatusRow;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
};

export type ApprovalPolicyRow = {
  company_id: string;
  action: string;
  mode: ApprovalModeRow;
  auto_below_amount: string | null;
  currency: string | null;
  updated_at: string;
};

export type IntegrationCatalogRow = {
  id: string;
  provider: string;
  category: string;
  display_name: string;
  auth_type: string;
  capabilities: string[];
  approval_required: boolean;
  webhook_supported: boolean;
  mobile_supported: boolean;
  status: string;
  notes: string | null;
};

export type IntegrationConnectionRow = {
  id: string;
  company_id: string;
  catalog_id: string;
  status: string;
  connected_by: string | null;
  connected_at: string;
  last_health_at: string | null;
  external_account: string | null;
  scopes: string[];
};

export type IntegrationCredentialRow = {
  connection_id: string;
  company_id: string;
  /** PostgREST renders bytea as a `\x…` hex string in both directions. */
  ciphertext: string;
  nonce: string;
  key_version: number;
  expires_at: string | null;
  rotated_at: string;
};

export type OAuthStateRow = {
  state: string;
  company_id: string;
  user_id: string;
  provider: string;
  code_verifier: string | null;
  redirect_to: string | null;
  created_at: string;
  expires_at: string;
};

export type AuditEventRow = {
  id: number;
  company_id: string;
  at: string;
  actor: string;
  action: string;
  outcome: AuditOutcomeRow;
  reason: string | null;
  integration: string | null;
  payload_digest: string | null;
};

/**
 * `Relationships: []` is what generated types emit for a table whose embedded
 * relations we do not rely on. Keep the empty tuple: widening it to a named
 * relationship without also declaring it makes every select resolve to `never`.
 */
type Table<Row, Insert = Row, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      companies: Table<CompanyRow, Pick<CompanyRow, 'name'> & Partial<CompanyRow>>;
      memberships: Table<MembershipRow, Pick<MembershipRow, 'user_id' | 'company_id'> & Partial<MembershipRow>>;
      founder_identities: Table<
        FounderIdentityRow,
        Pick<FounderIdentityRow, 'company_id' | 'user_id' | 'owner_display_name'> &
          Partial<FounderIdentityRow>
      >;
      divisions: Table<DivisionRow, Pick<DivisionRow, 'company_id' | 'division_key'> & Partial<DivisionRow>>;
      executives: Table<ExecutiveRow, Pick<ExecutiveRow, 'company_id' | 'role'> & Partial<ExecutiveRow>>;
      approvals: Table<
        ApprovalRow,
        Pick<ApprovalRow, 'company_id' | 'action' | 'title' | 'summary'> & Partial<ApprovalRow>
      >;
      approval_policies: Table<
        ApprovalPolicyRow,
        Pick<ApprovalPolicyRow, 'company_id' | 'action' | 'mode'> & Partial<ApprovalPolicyRow>
      >;
      integrations_catalog: Table<IntegrationCatalogRow>;
      integration_connections: Table<
        IntegrationConnectionRow,
        Pick<IntegrationConnectionRow, 'company_id' | 'catalog_id'> &
          Partial<IntegrationConnectionRow>
      >;
      integration_credentials: Table<
        IntegrationCredentialRow,
        Pick<IntegrationCredentialRow, 'connection_id' | 'company_id' | 'ciphertext' | 'nonce'> &
          Partial<IntegrationCredentialRow>
      >;
      oauth_states: Table<
        OAuthStateRow,
        Pick<OAuthStateRow, 'state' | 'company_id' | 'user_id' | 'provider'> &
          Partial<OAuthStateRow>
      >;
      audit_events: Table<
        AuditEventRow,
        Pick<AuditEventRow, 'company_id' | 'actor' | 'action' | 'outcome'> & Partial<AuditEventRow>
      >;
    };
    // `{ [_ in never]: never }` is the empty-object form generated types use.
    // `Record<string, never>` looks equivalent and is not: it fails to satisfy
    // postgrest's GenericSchema, which silently collapses every query to never.
    Views: { [_ in never]: never };
    Functions: {
      is_company_member: { Args: { target: string }; Returns: boolean };
      is_company_founder: { Args: { target: string }; Returns: boolean };
      prune_oauth_states: { Args: Record<string, never>; Returns: undefined };
      found_company: {
        Args: {
          p_name: string;
          p_owner_display_name: string;
          p_preferred_title?: string;
          p_preset?: string;
          p_locale?: string;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
