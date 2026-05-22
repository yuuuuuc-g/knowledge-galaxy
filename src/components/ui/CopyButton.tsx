"use client";

import { useEffect, useState } from "react";

const COPY_RESET_DELAY_MS = 2_000;

export interface CopyButtonProps {
  textToCopy: string;
}

export function CopyButton({ textToCopy }: CopyButtonProps) {
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) {
      return;
    }

    const timerId = window.setTimeout(() => {
      setIsCopied(false);
    }, COPY_RESET_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [isCopied]);

  async function handleCopy() {
    if (!textToCopy) {
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
    } catch {
      setIsCopied(false);
    }
  }

  return (
    <button
      aria-label={isCopied ? "Copied" : "Copy"}
      className={`absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded bg-transparent p-1 transition-colors ${
        isCopied ? "text-emerald-500" : "text-gray-500 hover:text-gray-300"
      }`}
      onClick={handleCopy}
      type="button"
    >
      {isCopied ? (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <rect height="14" rx="2" ry="2" width="14" x="8" y="8" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      )}
    </button>
  );
}
