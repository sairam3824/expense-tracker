import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in — Ledger" };

export default function LoginPage() {
  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-ink text-ink font-display text-xl">
            ₹
          </span>
          <h1 className="font-display text-[22px] text-ink mt-4">Ledger</h1>
          <p className="text-[13px] text-ink-soft font-body mt-1">
            Sign in to see your accounts
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
