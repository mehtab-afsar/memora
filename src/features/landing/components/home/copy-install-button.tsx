"use client";

import { useState } from "react";

export function CopyInstallButton({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="mt-[22px] inline-flex items-center gap-3 rounded-lg border border-[var(--line)] bg-[var(--paper-2)] px-3 py-2 text-sm text-[var(--ink-2)]">
      <code className="font-[family-name:var(--font-home-mono)]">{command}</code>
      <button
        type="button"
        className="font-[family-name:var(--font-home-sans)] text-[var(--indigo)]"
        onClick={() => {
          navigator.clipboard.writeText(command).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }).catch(() => {});
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
