"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  authConfigured,
  createSessionToken,
  credentialsMatch,
} from "@/lib/auth";
import { supabase } from "@/lib/supabase-server";
import { isCategory } from "@/lib/categories";
import { classifyExpense } from "@/lib/categorize";
import type { CategoryGuess } from "@/lib/categorize";

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
      error:
        "Login isn't configured. Set APP_USERNAME, APP_PASSWORD and SESSION_SECRET in your environment.",
    };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (throttled(username || "anonymous")) {
    return { error: "Too many attempts. Wait a few minutes and try again." };
  }

  if (!credentialsMatch(username, password)) {
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

export async function addEntry(
  _previous: EntryState,
  formData: FormData
): Promise<EntryState> {
  const date = String(formData.get("date") ?? "");
  const expense = String(formData.get("expense") ?? "").trim();
  const accountId = String(formData.get("account_id") ?? "");
  const amount = Number(formData.get("amount"));
  const kind = formData.get("kind") === "income" ? "income" : "spend";
  const rawCategory = String(formData.get("category") ?? "Other");

  if (!expense) return { error: "Give the entry a description.", ok: false };
  if (!accountId) return { error: "Pick an account.", ok: false };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter an amount greater than zero.", ok: false };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "Pick a valid date.", ok: false };
  }

  // Income isn't part of the budget split, so it never carries a category.
  const category = kind === "income"
    ? "Other"
    : isCategory(rawCategory)
      ? rawCategory
      : "Other";

  const { error } = await supabase.from("transactions").insert({
    date,
    expense,
    account_id: accountId,
    amount,
    kind,
    category,
  });

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

export async function suggestCategory(expense: string): Promise<CategoryGuess> {
  return classifyExpense(expense);
}
