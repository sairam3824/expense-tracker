"use client";

import { useEffect, useState } from "react";
import { formatPlain } from "@/lib/format";

/**
 * Copies a balance to the clipboard as plain digits (e.g. "7,650"), so it can
 * be pasted straight into a message or another app.
 */
export default function CopyButton({
  amount,
  label,
  className = "",
}: {
  amount: number;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const text = formatPlain(amount);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Safari denies clipboard access outside a secure context; fall back to
      // the legacy path so this still works on http://localhost over LAN.
      const field = document.createElement("textarea");
      field.value = text;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } catch {
        /* nothing else to try — leave the button unchanged */
      }
      document.body.removeChild(field);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label} balance`}
      /* 44px hit area (the glyph inside stays small) — touch-target minimum */
      className={`inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-soft transition-colors active:bg-ink/10 ${className}`}
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M20 6 9 17l-5-5"
            stroke="var(--color-stamp-green)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect
            x="9" y="9" width="11" height="11" rx="2"
            stroke="currentColor" strokeWidth="2"
          />
          <path
            d="M5 15V5a2 2 0 0 1 2-2h10"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          />
        </svg>
      )}
      <span className="sr-only" role="status">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
