import { open, parseKey, seal, VaultError } from './crypto';

/**
 * Credential storage.
 *
 * The store never returns ciphertext to a caller and never accepts a key from
 * one. Callers ask for a token; whether it was encrypted, rotated or refreshed
 * is not their concern.
 */

export interface StoredCredential {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt?: string;
  readonly scopes?: readonly string[];
}

export interface CredentialRow {
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly keyVersion: number;
  readonly expiresAt?: string | null;
}

/** The persistence the vault needs. Implemented over Supabase in the app. */
export interface CredentialBackend {
  load(companyId: string, connectionId: string): Promise<CredentialRow | null>;
  save(companyId: string, connectionId: string, row: CredentialRow): Promise<void>;
  remove(companyId: string, connectionId: string): Promise<void>;
}

export class CredentialVault {
  private readonly key: Buffer;

  constructor(
    keyBase64: string,
    private readonly backend: CredentialBackend,
  ) {
    this.key = parseKey(keyBase64);
  }

  /** Bind ciphertext to its owner so a row moved between companies fails. */
  private aad(companyId: string, connectionId: string): string {
    return `${companyId}:${connectionId}`;
  }

  async put(
    companyId: string,
    connectionId: string,
    credential: StoredCredential,
  ): Promise<void> {
    if (!credential.accessToken) throw new VaultError('an access token is required');
    const sealed = seal(
      JSON.stringify(credential),
      this.key,
      this.aad(companyId, connectionId),
    );
    await this.backend.save(companyId, connectionId, {
      ciphertext: sealed.ciphertext,
      nonce: sealed.nonce,
      keyVersion: sealed.keyVersion,
      expiresAt: credential.expiresAt ?? null,
    });
  }

  async get(companyId: string, connectionId: string): Promise<StoredCredential | null> {
    const row = await this.backend.load(companyId, connectionId);
    if (!row) return null;
    const json = open(
      { ciphertext: row.ciphertext, nonce: row.nonce, keyVersion: row.keyVersion },
      this.key,
      this.aad(companyId, connectionId),
    );
    return JSON.parse(json) as StoredCredential;
  }

  /**
   * Revoking a connection removes the credential — spec §110 ("Connection
   * revoke 기능"). Deleting the row is the whole operation: there is no
   * soft-delete, because a token we still hold is a token that can still be
   * used.
   */
  async revoke(companyId: string, connectionId: string): Promise<void> {
    await this.backend.remove(companyId, connectionId);
  }

  /** True when the stored credential has expired or is about to. */
  static isExpiring(credential: StoredCredential, withinSeconds = 60): boolean {
    if (!credential.expiresAt) return false;
    const at = Date.parse(credential.expiresAt);
    if (!Number.isFinite(at)) return false;
    return at - Date.now() <= withinSeconds * 1000;
  }
}
