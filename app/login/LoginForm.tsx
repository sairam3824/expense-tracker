"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { login, type LoginState } from "@/app/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-6 w-full rounded-md bg-ink py-3.5 text-[15px] font-medium text-paper transition-opacity active:opacity-80 disabled:opacity-60"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm() {
  const next = useSearchParams().get("next") ?? "/";
  const [state, formAction] = useActionState<LoginState, FormData>(login, {
    error: null,
  });

  return (
    <form
      action={formAction}
      className="rounded-lg border border-rule/70 bg-card p-5 shadow-sm"
    >
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          Username
        </span>
        <input
          name="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink font-body focus:outline-none focus:ring-2 focus:ring-ink/40"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-[10px] uppercase tracking-[0.1em] text-ink-soft">
          Password
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-rule bg-paper px-3 py-3 text-[16px] text-ink font-body focus:outline-none focus:ring-2 focus:ring-ink/40"
        />
      </label>

      {state.error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-stamp-red/40 bg-stamp-red/10 px-3 py-2 text-[12px] text-stamp-red font-body"
        >
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
