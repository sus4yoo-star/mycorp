import 'server-only';

import { CredentialVault, fromPgHex, toPgHex, type CredentialBackend } from '@mycorp24/vault';
import { getServiceClient } from './supabase/service';

/**
 * Credential storage backed by Supabase — spec §110, §187.
 *
 * `integration_credentials` has row level security enabled and no policy at
 * all, so only the service role can reach it. That is deliberate: a stored
 * OAuth token is not something a browser session should ever be able to read,
 * even for its own company.
 *
 * Everything stored here is ciphertext. The key lives in
 * MYCORP24_CREDENTIAL_KEY and never touches the database.
 */
const backend: CredentialBackend = {
  async load(companyId, connectionId) {
    const db = getServiceClient();
    const { data, error } = await db
      .from('integration_credentials')
      .select('ciphertext, nonce, key_version, expires_at')
      .eq('company_id', companyId)
      .eq('connection_id', connectionId)
      .maybeSingle();

    if (error) throw new Error(`loading the credential failed: ${error.message}`);
    if (!data) return null;

    return {
      ciphertext: fromPgHex(data.ciphertext),
      nonce: fromPgHex(data.nonce),
      keyVersion: data.key_version,
      expiresAt: data.expires_at,
    };
  },

  async save(companyId, connectionId, row) {
    const db = getServiceClient();
    const { error } = await db.from('integration_credentials').upsert(
      {
        connection_id: connectionId,
        company_id: companyId,
        ciphertext: toPgHex(row.ciphertext),
        nonce: toPgHex(row.nonce),
        key_version: row.keyVersion,
        expires_at: row.expiresAt ?? null,
        rotated_at: new Date().toISOString(),
      },
      { onConflict: 'connection_id' },
    );
    if (error) throw new Error(`saving the credential failed: ${error.message}`);
  },

  async remove(companyId, connectionId) {
    const db = getServiceClient();
    const { error } = await db
      .from('integration_credentials')
      .delete()
      .eq('company_id', companyId)
      .eq('connection_id', connectionId);
    if (error) throw new Error(`revoking the credential failed: ${error.message}`);
  },
};

export function getVault(): CredentialVault {
  const key = process.env['MYCORP24_CREDENTIAL_KEY'];
  if (!key) {
    throw new Error(
      'MYCORP24_CREDENTIAL_KEY is required to store integration credentials. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }
  return new CredentialVault(key, backend);
}

export const isVaultConfigured = (): boolean =>
  Boolean(process.env['MYCORP24_CREDENTIAL_KEY'] && process.env['SUPABASE_SERVICE_ROLE_KEY']);
