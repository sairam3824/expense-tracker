#!/usr/bin/env node
// Generates an APP_PASSWORD_HASH value.
//
//   npm run hash-password
//
// Keep the parameters and the output format in step with lib/password.ts —
// the self-check below fails loudly if they ever drift apart.

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import process from "node:process";

const scryptAsync = promisify(scrypt);

const N = 65536;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const MAX_MEM = 256 * 1024 * 1024;

const derive = (password, salt, keyLength, params) =>
  scryptAsync(password.normalize("NFKC"), salt, keyLength, {
    ...params,
    maxmem: MAX_MEM,
  });

async function hash(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, { N, r: R, p: P });
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

async function verify(password, stored) {
  const [tag, n, r, p, saltB64, keyB64] = stored.split("$");
  if (tag !== "scrypt") return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await derive(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(actual, expected);
}

const CTRL_C = 3;
const CTRL_D = 4;
const BACKSPACE = 8;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;
const DELETE = 127;

/** Reads a line from the terminal without echoing it. */
function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    if (!stdin.isTTY) {
      reject(new Error("No terminal available — run this interactively."));
      return;
    }

    stdout.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let value = "";
    const finish = (result) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      stdout.write("\n");
      result();
    };

    const onData = (chunk) => {
      for (const char of chunk) {
        const code = char.codePointAt(0);

        if (code === LINE_FEED || code === CARRIAGE_RETURN || code === CTRL_D) {
          finish(() => resolve(value));
          return;
        }
        if (code === CTRL_C) {
          finish(() => process.exit(1));
          return;
        }
        if (code === BACKSPACE || code === DELETE) {
          value = value.slice(0, -1);
          continue;
        }
        // Printable characters only — ignore arrow keys and other escapes.
        if (code >= 32 && code !== DELETE) value += char;
      }
    };

    stdin.on("data", onData);
  });
}

const password = await readSecret("New password: ");
if (password.length < 8) {
  console.error("  Too short — use at least 8 characters (12+ recommended).");
  process.exit(1);
}

const again = await readSecret("Confirm:      ");
if (password !== again) {
  console.error("  Passwords don't match.");
  process.exit(1);
}

process.stdout.write("Hashing (scrypt, ~64MB)…\n");
const stored = await hash(password);

// The hash must verify, and a wrong password must not.
if (!(await verify(password, stored)) || (await verify(password + "x", stored))) {
  console.error("  Self-check FAILED — do not use this hash.");
  process.exit(1);
}

console.log("\n  Self-check passed. Put this in .env.local and in Vercel:\n");
console.log(`APP_PASSWORD_HASH=${stored}\n`);
console.log("  Then delete APP_PASSWORD — it is no longer read.\n");
