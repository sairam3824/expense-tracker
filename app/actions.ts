"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSessionToken,
  usernameMatches,
} from "@/lib/auth";
import {
  authConfigured,
  plaintextPasswordStillSet,
  verifyPassword,
} from "@/lib/password";
import { supabase } from "@/lib/supabase-server";
import { CATEGORY_NAMES, isCategory } from "@/lib/categories";
import { classifyExpense } from "@/lib/categorize";
import type { CategoryGuess } from "@/lib/categorize";
import type { TransactionKind } from "@/lib/types";

// ── Auth ────────────────────────────────────────────────────────────────────

export type LoginState = { error: string | null };

// A small in-memory throttle. It resets on redeploy and isn't shared across
// serverless instances, but it's enough to make guessing tedious on a
// single-user app.
const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function throttled(key: string): boolean {
  const now = Date.now();
  const record = attempts.get(key);
  if (!record || now - record.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return false;
  }
  record.count += 1;
  return record.count > MAX_ATTEMPTS;
}

export async function login(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  if (!authConfigured()) {
    return {
      error: plaintextPasswordStillSet()
        ? "APP_PASSWORD is no longer used. Run `npm run hash-password` and set APP_PASSWORD_HASH instead."
        : "Login isn't configured. Set APP_USERNAME, APP_PASSWORD_HASH and SESSION_SECRET in your environment.",
    };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (throttled(username || "anonymous")) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  // Both checks always run, and the scrypt work happens even when the username
  // is wrong. Short-circuiting would make a bad username return noticeably
  // faster than a bad password, revealing which one was correct.
  const userOk = usernameMatches(username);
  const passwordOk = await verifyPassword(
    password,
    process.env.APP_PASSWORD_HASH!
  );

  if (!userOk || !passwordOk) {
    return { error: "Wrong username or password." };
  }

  const token = await createSessionToken();
  if (!token) return { error: "Couldn't start a session. Check SESSION_SECRET." };

  attempts.delete(username);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  // Only allow same-site paths, so ?next= can't be used as an open redirect.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ── Entries ─────────────────────────────────────────────────────────────────

export type EntryState = { error: string | null; ok: boolean };

function readKind(value: FormDataEntryValue | null): TransactionKind {
  if (value === "income") return "income";
  if (value === "transfer") return "transfer";
  return "spend";
}

/**
 * Creates an entry, or edits one when the form carries an `id`.
 *
 * One action rather than two because the validation is identical and the two
 * would drift apart otherwise — an edit that skipped a rule the insert
 * enforces is exactly how a bad row gets into the ledger.
 */
export async function saveEntry(
  _previous: EntryState,
  formData: FormData
): Promise<EntryState> {
  const id = String(formData.get("id") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const toAccountId = String(formData.get("to_account_id") ?? "").trim();
  const amount = Number(formData.get("amount"));
  const kind = readKind(formData.get("kind"));
  const rawCategory = String(formData.get("category") ?? "Other");

  // A transfer describes itself — the two account names are the description —
  // so it's the one kind that doesn't need you to type anything.
  const typed = String(formData.get("expense") ?? "").trim();
  const expense = typed || (kind === "transfer" ? "Transfer" : "");

  if (!expense) return { error: "Give the entry a description.", ok: false };
  if (!accountId) {
    return {
      error: kind === "transfer" ? "Pick the account to move from." : "Pick an account.",
      ok: false,
    };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero.", ok: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Pick a valid date.", ok: false };
  }

  if (kind === "transfer") {
    if (!toAccountId) {
      return { error: "Pick the account to move money into.", ok: false };
    }
    if (toAccountId === accountId) {
      return { error: "Pick two different accounts to move between.", ok: false };
    }
  }

  // Only spending carries a category: income isn't a budget line, and a
  // transfer is the same money in both places rather than money spent.
  const category =
    kind === "spend" && isCategory(rawCategory) ? rawCategory : "Other";

  const row = {
    date,
    expense,
    account_id: accountId,
    // Must be nulled out and not merely left alone: switching an existing
    // transfer to a spend has to clear the destination, or the row fails the
    // table's transfer check.
    to_account_id: kind === "transfer" ? toAccountId : null,
    amount,
    kind,
    category,
  };

  const { error } = id
    ? await supabase.from("transactions").update(row).eq("id", id)
    : await supabase.from("transactions").insert(row);

  if (error) return { error: error.message, ok: false };

  revalidatePath("/");
  return { error: null, ok: true };
}

export async function deleteEntry(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/");
  return { error: null };
}

// ── Budgets ─────────────────────────────────────────────────────────────────

export type BudgetState = { error: string | null; ok: boolean };

/**
 * Saves every category's monthly cap in one go. Fields arrive as
 * `budget:<Category Name>`; a blank or zero means "no cap", which is stored as
 * the absence of a row rather than a zero, so "capped at ₹0" and "not capped"
 * can never be confused.
 */
export async function saveBudgets(
  _previous: BudgetState,
  formData: FormData
): Promise<BudgetState> {
  const keep: { category: string; amount: number; updated_at: string }[] = [];
  const drop: string[] = [];
  const now = new Date().toISOString();

  for (const category of CATEGORY_NAMES) {
    const raw = String(formData.get(`budget:${category}`) ?? "").trim();

    if (raw === "") {
      drop.push(category);
      continue;
    }

    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: `Enter a valid amount for ${category}.`, ok: false };
    }

    if (amount === 0) drop.push(category);
    else keep.push({ category, amount, updated_at: now });
  }

  if (keep.length > 0) {
    const { error } = await supabase
      .from("budgets")
      .upsert(keep, { onConflict: "category" });
    if (error) return { error: error.message, ok: false };
  }

  if (drop.length > 0) {
    const { error } = await supabase
      .from("budgets")
      .delete()
      .in("category", drop);
    if (error) return { error: error.message, ok: false };
  }

  revalidatePath("/");
  return { error: null, ok: true };
}

export async function suggestCategory(expense: string): Promise<CategoryGuess> {
  return classifyExpense(expense);
}
