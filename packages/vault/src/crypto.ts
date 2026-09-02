import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

/**
 * Credential encryption — spec §110, §187.
 *
 * OAuth access and refresh tokens are stored encrypted. Passwords are never
 * stored at all, in any form (§94, §111).
 *
 * AES-256-GCM: authenticated encryption, so a tampered ciphertext fails to
 * decrypt rather than decrypting to something attacker-chosen. The nonce is
 * random per encryption and stored alongside; the auth tag is appended to the
 * ciphertext.
 *
 * The key never leaves the server. It lives in MYCORP24_CREDENTIAL_KEY and the
 * database column holds only ciphertext (`integration_credentials`, which has
 * row level security enabled and no policy at all — see supabase/README.md).
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VaultError';
  }
}

export interface SealedCredential {
  /** Ciphertext with the GCM auth tag appended. */
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
  readonly keyVersion: number;
}

/** Generate a key for MYCORP24_CREDENTIAL_KEY. Base64, 32 bytes. */
export const generateKey = (): string => randomBytes(KEY_BYTES).toString('base64');

export function parseKey(base64: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(base64, 'base64');
  } catch {
    throw new VaultError('MYCORP24_CREDENTIAL_KEY is not valid base64');
  }
  if (key.length !== KEY_BYTES) {
    throw new VaultError(
      `MYCORP24_CREDENTIAL_KEY must decode to ${KEY_BYTES} bytes, got ${key.length}`,
    );
  }
  return key;
}

/**
 * `aad` binds the ciphertext to its owner. Passing the company id means a row
 * moved to another company fails to decrypt instead of silently working.
 */
export function seal(
  plaintext: string,
  key: Buffer,
  aad: string,
  keyVersion = 1,
): SealedCredential {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext: Buffer.concat([body, tag]), nonce, keyVersion };
}

export function open(sealed: SealedCredential, key: Buffer, aad: string): string {
  const buf = Buffer.from(sealed.ciphertext);
  if (buf.length < TAG_BYTES) throw new VaultError('ciphertext is too short to contain a tag');

  const body = buf.subarray(0, buf.length - TAG_BYTES);
  const tag = buf.subarray(buf.length - TAG_BYTES);

  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.nonce));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    // Deliberately vague: whether the key, the nonce, the aad or the ciphertext
    // is wrong is not something a caller should be able to distinguish.
    throw new VaultError('credential could not be decrypted');
  }
}

/** Constant-time comparison for OAuth state and similar opaque tokens. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

// ---------------------------------------------------------------------------
// Postgres bytea interchange
// ---------------------------------------------------------------------------

/**
 * PostgREST represents `bytea` as a hex string (`\x0badc0de`) in both
 * directions. Encoding here rather than at each call site keeps the one place
 * that can silently corrupt a credential small enough to test.
 */
export const toPgHex = (bytes: Uint8Array): string =>
  `\\x${Buffer.from(bytes).toString('hex')}`;

export function fromPgHex(value: string): Uint8Array {
  if (!value.startsWith('\\x')) {
    throw new VaultError('expected a postgres hex-encoded bytea value');
  }
  const hex = value.slice(2);
  if (hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
    throw new VaultError('bytea value is not valid hex');
  }
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
