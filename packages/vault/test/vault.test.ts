import { describe, expect, it } from 'vitest';
import {
  CredentialVault,
  VaultError,
  generateKey,
  open,
  parseKey,
  safeEqual,
  seal,
  type CredentialBackend,
  type CredentialRow,
} from '../src/index';

const KEY = generateKey();
const key = parseKey(KEY);

describe('credential encryption — spec §110, §187', () => {
  it('round-trips a token', () => {
    const sealed = seal('ya29.token', key, 'company:conn');
    expect(open(sealed, key, 'company:conn')).toBe('ya29.token');
  });

  it('never stores the plaintext in the ciphertext', () => {
    const sealed = seal('ya29.super-secret-token', key, 'company:conn');
    expect(Buffer.from(sealed.ciphertext).toString('utf8')).not.toContain('super-secret');
    expect(Buffer.from(sealed.ciphertext).toString('base64')).not.toContain('super-secret');
  });

  it('uses a fresh nonce every time', () => {
    const a = seal('same', key, 'company:conn');
    const b = seal('same', key, 'company:conn');
    expect(Buffer.from(a.nonce).equals(Buffer.from(b.nonce))).toBe(false);
    expect(Buffer.from(a.ciphertext).equals(Buffer.from(b.ciphertext))).toBe(false);
  });

  it('refuses a tampered ciphertext instead of decrypting it', () => {
    const sealed = seal('ya29.token', key, 'company:conn');
    const tampered = Buffer.from(sealed.ciphertext);
    tampered[0] = tampered[0]! ^ 0xff;
    expect(() => open({ ...sealed, ciphertext: tampered }, key, 'company:conn')).toThrow(VaultError);
  });

  it('refuses a credential moved to another company', () => {
    const sealed = seal('ya29.token', key, 'company-a:conn');
    expect(() => open(sealed, key, 'company-b:conn')).toThrow(VaultError);
  });

  it('refuses the wrong key', () => {
    const sealed = seal('ya29.token', key, 'company:conn');
    expect(() => open(sealed, parseKey(generateKey()), 'company:conn')).toThrow(VaultError);
  });

  it('rejects a key of the wrong length', () => {
    expect(() => parseKey(Buffer.alloc(16).toString('base64'))).toThrow(VaultError);
  });

  it('compares opaque tokens without leaking length-independent timing', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});

function memoryBackend(): CredentialBackend & { rows: Map<string, CredentialRow> } {
  const rows = new Map<string, CredentialRow>();
  return {
    rows,
    load: async (c, i) => rows.get(`${c}:${i}`) ?? null,
    save: async (c, i, row) => void rows.set(`${c}:${i}`, row),
    remove: async (c, i) => void rows.delete(`${c}:${i}`),
  };
}

describe('CredentialVault', () => {
  it('stores and returns a credential without exposing ciphertext', async () => {
    const backend = memoryBackend();
    const vault = new CredentialVault(KEY, backend);
    await vault.put('company-a', 'conn-1', {
      accessToken: 'ya29.access',
      refreshToken: '1//refresh',
      scopes: ['gmail.readonly'],
    });

    const stored = backend.rows.get('company-a:conn-1')!;
    expect(Buffer.from(stored.ciphertext).toString('utf8')).not.toContain('ya29');
    expect(Buffer.from(stored.ciphertext).toString('utf8')).not.toContain('refresh');

    const got = await vault.get('company-a', 'conn-1');
    expect(got).toEqual({
      accessToken: 'ya29.access',
      refreshToken: '1//refresh',
      scopes: ['gmail.readonly'],
    });
  });

  it('returns null for a connection that has none', async () => {
    const vault = new CredentialVault(KEY, memoryBackend());
    expect(await vault.get('company-a', 'missing')).toBeNull();
  });

  it('will not decrypt another company credential', async () => {
    const backend = memoryBackend();
    const vault = new CredentialVault(KEY, backend);
    await vault.put('company-a', 'conn-1', { accessToken: 'ya29.access' });

    // Simulate a row that ended up under the wrong company.
    backend.rows.set('company-b:conn-1', backend.rows.get('company-a:conn-1')!);
    await expect(vault.get('company-b', 'conn-1')).rejects.toThrow(VaultError);
  });

  it('revoking removes the credential outright', async () => {
    const backend = memoryBackend();
    const vault = new CredentialVault(KEY, backend);
    await vault.put('company-a', 'conn-1', { accessToken: 'ya29.access' });
    await vault.revoke('company-a', 'conn-1');
    expect(backend.rows.size).toBe(0);
    expect(await vault.get('company-a', 'conn-1')).toBeNull();
  });

  it('refuses to store an empty access token', async () => {
    const vault = new CredentialVault(KEY, memoryBackend());
    await expect(vault.put('c', 'x', { accessToken: '' })).rejects.toThrow(VaultError);
  });

  it('knows when a credential needs refreshing', () => {
    const soon = new Date(Date.now() + 30_000).toISOString();
    const later = new Date(Date.now() + 3_600_000).toISOString();
    expect(CredentialVault.isExpiring({ accessToken: 'a', expiresAt: soon })).toBe(true);
    expect(CredentialVault.isExpiring({ accessToken: 'a', expiresAt: later })).toBe(false);
    expect(CredentialVault.isExpiring({ accessToken: 'a' })).toBe(false);
  });
});

describe('postgres bytea interchange', () => {
  it('round-trips arbitrary bytes', async () => {
    const { fromPgHex, toPgHex } = await import('../src/crypto');
    const bytes = new Uint8Array([0, 1, 255, 128, 64, 0]);
    expect(fromPgHex(toPgHex(bytes))).toEqual(bytes);
  });

  it('survives a full seal → hex → open cycle', async () => {
    const { fromPgHex, toPgHex } = await import('../src/crypto');
    const sealed = seal('ya29.token', key, 'company:conn');
    const revived = {
      ciphertext: fromPgHex(toPgHex(sealed.ciphertext)),
      nonce: fromPgHex(toPgHex(sealed.nonce)),
      keyVersion: sealed.keyVersion,
    };
    expect(open(revived, key, 'company:conn')).toBe('ya29.token');
  });

  it('rejects a value that is not postgres hex', async () => {
    const { fromPgHex } = await import('../src/crypto');
    expect(() => fromPgHex('0badc0de')).toThrow(VaultError);
    expect(() => fromPgHex('\\xzz')).toThrow(VaultError);
    expect(() => fromPgHex('\\x0b0')).toThrow(VaultError);
  });
});
