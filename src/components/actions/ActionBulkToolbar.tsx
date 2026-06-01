"use client";

import type { BulkActionType } from "@/lib/actions/types";

export function ActionBulkToolbar({
  selectedCount,
  canEscalate,
  disabled,
  onBulk,
}: Readonly<{
  selectedCount: number;
  canEscalate: boolean;
  disabled: boolean;
  onBulk: (operation: BulkActionType) => void;
}>) {
  if (selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 px-4 py-2">
      <span className="text-xs font-medium text-indigo-900">{selectedCount} selected</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onBulk("complete")}
        className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
      >
        Complete
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onBulk("dismiss")}
        className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium disabled:opacity-50"
      >
        Dismiss
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onBulk("snooze")}
        className="rounded-md border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900 disabled:opacity-50"
      >
        Snooze 24h
      </button>
      {canEscalate ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onBulk("escalate")}
          className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 disabled:opacity-50"
        >
          Escalate
        </button>
      ) : null}
    </div>
  );
}
