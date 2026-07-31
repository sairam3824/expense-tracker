// Session handling for the single shared login.
//
// A session is a signed, expiring token stored in an httpOnly cookie:
//   base64url({ exp }) + "." + base64url(HMAC-SHA256(payload, SESSION_SECRET))
//
// Everything here uses Web Crypto rather than node:crypto so the same code runs
// in middleware (edge runtime) and in server actions (node runtime).

export const SESSION_COOKIE = "ledger_session";
const SESSION_DAYS = 30;

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function sign(payload: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload)
  );
  return toBase64Url(new Uint8Array(signature));
}

/** Length-independent, value-constant-time string comparison. */
export function timingSafeEqualString(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // Compare lengths without an early return so the loop below always runs.
  let mismatch = aBytes.length ^ bBytes.length;
  const max = Math.max(aBytes.length, bBytes.length);
  for (let i = 0; i < max; i++) {
    mismatch |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return mismatch === 0;
}

function sessionSecret(): string | null {
  const secret = process.env.SESSION_SECRET;
  return secret && secret.length >= 16 ? secret : null;
}

export async function createSessionToken(): Promise<string | null> {
  const secret = sessionSecret();
  if (!secret) return null;

  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ exp: Date.now() + SESSION_MAX_AGE * 1000 }))
  );
  return `${payload}.${await sign(payload, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined
): Promise<boolean> {
  const secret = sessionSecret();
  if (!secret || !token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await sign(payload, secret);
  if (!timingSafeEqualString(signature, expected)) return false;

  try {
    const { exp } = JSON.parse(fromBase64Url(payload)) as { exp?: number };
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

/** Constant-time check of the submitted username. */
export function usernameMatches(username: string): boolean {
  const expected = process.env.APP_USERNAME;
  if (!expected) return false;
  return timingSafeEqualString(username, expected);
}
