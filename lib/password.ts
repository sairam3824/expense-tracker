import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

// Password verification for the single shared login.
//
// scrypt is deliberate: it is memory-hard, so an attacker with a GPU or ASIC
// gains far less than they would against PBKDF2 or a bare SHA-256. The stored
// value is a self-describing string, so the cost parameters can be raised later
// without invalidating existing hashes.
//
// This module is Node-only (node:crypto) and must never be imported by
// proxy.ts, which runs on the edge runtime. The proxy only ever checks the
// session signature, which uses Web Crypto in lib/auth.ts.
//
// Format: scrypt$N$r$p$<salt base64>$<derived key base64>
//
// scripts/hash-password.mjs generates these and MUST produce the same format.

// promisify() resolves to scrypt's 3-argument overload and drops the one that
// takes options, so the cost parameters need the signature spelled out.
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

// N=65536, r=8, p=1 costs roughly 64 MB and ~150ms per attempt — painful to
// brute force, unnoticeable on a login screen.
const N = 65536;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 256 * 1024 * 1024;

// Ceilings so a malformed or hostile env var can't ask for a hash that
// exhausts memory and takes the app down.
const MAX_N = 1 << 20;
const MAX_R = 32;
const MAX_P = 16;

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  params: { N: number; r: number; p: number }
): Promise<Buffer> {
  // NFKC so the same password typed on different keyboards/platforms — where
  // an accented character may arrive pre-composed or decomposed — still matches.
  return scryptAsync(password.normalize("NFKC"), salt, keyLength, {
    ...params,
    maxmem: MAX_MEM,
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return [
    "scrypt",
    N,
    R,
    P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, rawN, rawR, rawP, saltB64, keyB64] = parts;
  const params = { N: Number(rawN), r: Number(rawR), p: Number(rawP) };

  const sane =
    Number.isInteger(params.N) && params.N > 1 && params.N <= MAX_N &&
    (params.N & (params.N - 1)) === 0 && // scrypt requires N to be a power of 2
    Number.isInteger(params.r) && params.r > 0 && params.r <= MAX_R &&
    Number.isInteger(params.p) && params.p > 0 && params.p <= MAX_P;
  if (!sane) return false;

  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(keyB64, "base64");
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const actual = await derive(password, salt, expected.length, params);
    // Lengths always match here (we derive to expected.length), so
    // timingSafeEqual won't throw.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** True once a username and a password *hash* are configured. */
export function authConfigured(): boolean {
  const secret = process.env.SESSION_SECRET;
  return Boolean(
    process.env.APP_USERNAME &&
      process.env.APP_PASSWORD_HASH &&
      secret &&
      secret.length >= 16
  );
}

/** Flags a leftover plaintext password so the migration isn't missed. */
export function plaintextPasswordStillSet(): boolean {
  return Boolean(process.env.APP_PASSWORD);
}
