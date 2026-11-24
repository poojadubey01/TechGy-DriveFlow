import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, keylen: number, opts: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

/** scrypt password hash, stored as "scrypt$N$r$p$salt$hash" so the cost can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password.normalize('NFKC'), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return ['scrypt', N, R, P, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !n || !r || !p || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scryptAsync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A random opaque token (sessions, visit tokens). Only its sha256 is stored. */
export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('base64url');
}

export function newCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Characters that can't be confused with each other (no 0/o, 1/l/i). */
const SHARE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** 12-character unguessable share code (~59 bits). */
export function newShareId(): string {
  let out = '';
  for (let i = 0; i < 12; i++) out += SHARE_ALPHABET[randomInt(0, SHARE_ALPHABET.length)];
  return out;
}

export function isShareId(value: string) {
  return /^[a-z2-9]{12}$/.test(value);
}

/** Encrypts and signs secrets at rest (Google refresh tokens) with AES-256-GCM. */
export class Secrets {
  private readonly key: Buffer;
  private readonly macKey: Buffer;

  constructor(base64Key: string) {
    const raw = Buffer.from(base64Key, 'base64');
    if (raw.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes');
    // Separate keys for encryption and for code hashing, both derived from the one secret.
    this.key = createHmac('sha256', raw).update('driveflow:encrypt').digest();
    this.macKey = createHmac('sha256', raw).update('driveflow:mac').digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
  }

  decrypt(sealed: string): string {
    const [v, iv, tag, body] = sealed.split('.');
    if (v !== 'v1' || !iv || !tag || !body) throw new Error('Unreadable secret');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(body, 'base64url')), decipher.final()]).toString('utf8');
  }

  /** Keyed hash for short codes, so a leaked table can't be brute-forced offline. */
  mac(value: string): string {
    return createHmac('sha256', this.macKey).update(value).digest('base64url');
  }

  macEquals(value: string, expected: string): boolean {
    const a = Buffer.from(this.mac(value));
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
