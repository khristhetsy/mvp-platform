"use client";

import { useState } from "react";

/** Company summary on a speaker card — clamps to ~2 lines with a more/less toggle. */
export function CompanySummary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 150;
  return (
    <div className="mt-2 rounded-md border border-[var(--border-subtle)] bg-[var(--indigo-soft)]/40 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Company</p>
      <p
        className={`mt-0.5 text-sm text-[var(--text-secondary)] ${open ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {long && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 text-xs font-medium text-[var(--blue)] hover:underline"
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
